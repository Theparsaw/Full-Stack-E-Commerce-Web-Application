const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const app = require("../server");
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const ReturnRequest = require("../models/ReturnRequest");

const uniqueSuffix = Date.now();
const salesManagerEmail = `stock-restore-${uniqueSuffix}@example.com`;
const testProductId = `p-restore-${uniqueSuffix}`;

let salesManagerToken;
let returnRequestId;
let orderId;
let initialStock = 5;
let returnQuantity = 2;

beforeAll(async () => {
  const password = await bcrypt.hash("ManagerPass123!", 10);

  // 1. Setup Sales Manager
  await User.create({
    name: "Stock Restore Admin",
    email: salesManagerEmail,
    password,
    role: "sales_manager",
  });

  const managerRes = await request(app).post("/api/auth/login").send({
    email: salesManagerEmail,
    password: "ManagerPass123!",
  });
  salesManagerToken = managerRes.body.token;

  // 2. Setup a Product to track its stock
  await Product.create({
    productId: testProductId,
    categoryId: "electronics",
    name: "Refund Test Item",
    model: "Restore-X",
    serialNumber: `SN-RESTORE-${uniqueSuffix}`,
    description: "Testing stock restoration",
    quantityInStock: initialStock, // Starts at 5
    price: 50.00,
    warrantyStatus: "1 year",
    distributorInfo: "Test Distributor",
  });

  const order = await Order.create({
    userId: new mongoose.Types.ObjectId().toString(),
    cartId: `cart-restore-${uniqueSuffix}`,
    items: [{
      productId: testProductId,
      name: "Refund Test Item",
      unitPrice: 50,
      quantity: returnQuantity,
    }],
    totalPrice: 100,
    status: "paid",
    paidAt: new Date(),
  });
  orderId = order._id;

  // 3. Setup a pending Return Request for that product
  const returnReq = await ReturnRequest.create({
    userId: new mongoose.Types.ObjectId(),
    orderId,
    items: [{ productId: testProductId, name: "Refund Test Item", unitPrice: 50, quantity: returnQuantity }],
    reason: "Changed mind",
    refundAmount: 100, // 50 * 2
    status: "pending",
  });
  returnRequestId = returnReq._id;
});

afterAll(async () => {
  await ReturnRequest.findByIdAndDelete(returnRequestId);
  await ReturnRequest.deleteMany({
    reason: { $in: ["Missing product rollback", "Order item rollback", "Concurrent approval", "Partial approval"] },
  });
  await Order.findByIdAndDelete(orderId);
  await Order.deleteMany({ cartId: { $regex: `restore-${uniqueSuffix}` } });
  await Product.deleteMany({ productId: { $regex: `restore.*${uniqueSuffix}` } });
  await User.deleteOne({ email: salesManagerEmail });
  await mongoose.connection.close();
});

describe("Refund Approval and Stock Restore", () => {
  test("Approving a refund successfully increments product quantityInStock", async () => {
    // 1. Sales manager approves the refund
    const res = await request(app)
      .patch(`/api/returns/${returnRequestId}/approve`)
      .set("Authorization", `Bearer ${salesManagerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    // 2. Verify the status changed to approved
    const updatedReq = await ReturnRequest.findById(returnRequestId);
    expect(updatedReq.status).toBe("approved");

    const updatedOrder = await Order.findById(orderId);
    expect(updatedOrder.items[0].status).toBe("returned");
    expect(updatedOrder.items[0].returnedQuantity).toBe(returnQuantity);

    // 3. MOST IMPORTANT: Verify the stock went up!
    const product = await Product.findOne({ productId: testProductId });
    // Initial was 5, returned 2, new stock should be 7.
    expect(product.quantityInStock).toBe(initialStock + returnQuantity); 
  });

  test("Approving a partial refund tracks returned quantity without fully returning the order item", async () => {
    const partialProductId = `p-restore-partial-${uniqueSuffix}`;
    await Product.create({
      productId: partialProductId,
      categoryId: "electronics",
      name: "Partial Refund Test Item",
      model: "Restore-P",
      serialNumber: `SN-RESTORE-PARTIAL-${uniqueSuffix}`,
      description: "Testing partial return tracking",
      quantityInStock: 4,
      price: 35,
      warrantyStatus: "1 year",
      distributorInfo: "Test Distributor",
    });

    const partialOrder = await Order.create({
      userId: new mongoose.Types.ObjectId().toString(),
      cartId: `cart-restore-partial-${uniqueSuffix}`,
      items: [{
        productId: partialProductId,
        name: "Partial Refund Test Item",
        unitPrice: 35,
        quantity: 3,
      }],
      totalPrice: 105,
      status: "paid",
      paidAt: new Date(),
    });

    const partialReturnReq = await ReturnRequest.create({
      userId: new mongoose.Types.ObjectId(),
      orderId: partialOrder._id,
      items: [{ productId: partialProductId, name: "Partial Refund Test Item", unitPrice: 35, quantity: 1 }],
      reason: "Partial approval",
      refundAmount: 35,
      status: "pending",
    });

    const res = await request(app)
      .patch(`/api/returns/${partialReturnReq._id}/approve`)
      .set("Authorization", `Bearer ${salesManagerToken}`);

    expect(res.statusCode).toBe(200);

    const updatedOrder = await Order.findById(partialOrder._id);
    expect(updatedOrder.items[0].returnedQuantity).toBe(1);
    expect(updatedOrder.items[0].status).toBe("active");

    const product = await Product.findOne({ productId: partialProductId });
    expect(product.quantityInStock).toBe(5);
  });

  test("Approving an already approved refund does not duplicate stock restoration", async () => {
    // Try to approve it a second time
    const res = await request(app)
      .patch(`/api/returns/${returnRequestId}/approve`)
      .set("Authorization", `Bearer ${salesManagerToken}`);

    // Should ideally return a 400 bad request since it's already approved
    expect(res.statusCode).toBe(400); 

    // Verify stock did NOT go up again
    const product = await Product.findOne({ productId: testProductId });
    expect(product.quantityInStock).toBe(initialStock + returnQuantity); // Still 7
  });

  test("Approving a refund fails consistently when a product is missing", async () => {
    const missingOrder = await Order.create({
      userId: new mongoose.Types.ObjectId().toString(),
      cartId: `cart-restore-missing-${uniqueSuffix}`,
      items: [{
        productId: `missing-${testProductId}`,
        name: "Missing Refund Test Item",
        unitPrice: 25,
        quantity: 1,
      }],
      totalPrice: 25,
      status: "paid",
      paidAt: new Date(),
    });

    const missingReturnReq = await ReturnRequest.create({
      userId: new mongoose.Types.ObjectId(),
      orderId: missingOrder._id,
      items: [{
        productId: `missing-${testProductId}`,
        name: "Missing Refund Test Item",
        unitPrice: 25,
        quantity: 1,
      }],
      reason: "Missing product rollback",
      refundAmount: 25,
      status: "pending",
    });

    const res = await request(app)
      .patch(`/api/returns/${missingReturnReq._id}/approve`)
      .set("Authorization", `Bearer ${salesManagerToken}`);

    expect(res.statusCode).toBe(404);

    const unchangedReq = await ReturnRequest.findById(missingReturnReq._id);
    expect(unchangedReq.status).toBe("pending");

    const unchangedOrder = await Order.findById(missingOrder._id);
    expect(unchangedOrder.items[0].status).toBe("active");
  });

  test("Approval rolls back stock when order item status update fails", async () => {
    const rollbackProductId = `p-restore-rollback-${uniqueSuffix}`;
    await Product.create({
      productId: rollbackProductId,
      categoryId: "electronics",
      name: "Rollback Refund Test Item",
      model: "Restore-R",
      serialNumber: `SN-RESTORE-ROLLBACK-${uniqueSuffix}`,
      description: "Testing transaction rollback",
      quantityInStock: 8,
      price: 45,
      warrantyStatus: "1 year",
      distributorInfo: "Test Distributor",
    });

    const rollbackOrder = await Order.create({
      userId: new mongoose.Types.ObjectId().toString(),
      cartId: `cart-restore-rollback-${uniqueSuffix}`,
      items: [{
        productId: `different-${rollbackProductId}`,
        name: "Different Refund Test Item",
        unitPrice: 45,
        quantity: 1,
      }],
      totalPrice: 45,
      status: "paid",
      paidAt: new Date(),
    });

    const rollbackReturnReq = await ReturnRequest.create({
      userId: new mongoose.Types.ObjectId(),
      orderId: rollbackOrder._id,
      items: [{ productId: rollbackProductId, name: "Rollback Refund Test Item", unitPrice: 45, quantity: 1 }],
      reason: "Order item rollback",
      refundAmount: 45,
      status: "pending",
    });

    const res = await request(app)
      .patch(`/api/returns/${rollbackReturnReq._id}/approve`)
      .set("Authorization", `Bearer ${salesManagerToken}`);

    expect(res.statusCode).toBe(404);

    const product = await Product.findOne({ productId: rollbackProductId });
    expect(product.quantityInStock).toBe(8);

    const unchangedReq = await ReturnRequest.findById(rollbackReturnReq._id);
    expect(unchangedReq.status).toBe("pending");
  });

  test("Concurrent repeated approval attempts restore stock exactly once", async () => {
    const concurrentProductId = `p-restore-concurrent-${uniqueSuffix}`;
    await Product.create({
      productId: concurrentProductId,
      categoryId: "electronics",
      name: "Concurrent Refund Test Item",
      model: "Restore-C",
      serialNumber: `SN-RESTORE-CONCURRENT-${uniqueSuffix}`,
      description: "Testing concurrent stock restoration",
      quantityInStock: 3,
      price: 30,
      warrantyStatus: "1 year",
      distributorInfo: "Test Distributor",
    });

    const concurrentOrder = await Order.create({
      userId: new mongoose.Types.ObjectId().toString(),
      cartId: `cart-restore-concurrent-${uniqueSuffix}`,
      items: [{
        productId: concurrentProductId,
        name: "Concurrent Refund Test Item",
        unitPrice: 30,
        quantity: 1,
      }],
      totalPrice: 30,
      status: "paid",
      paidAt: new Date(),
    });

    const concurrentReturnReq = await ReturnRequest.create({
      userId: new mongoose.Types.ObjectId(),
      orderId: concurrentOrder._id,
      items: [{ productId: concurrentProductId, name: "Concurrent Refund Test Item", unitPrice: 30, quantity: 1 }],
      reason: "Concurrent approval",
      refundAmount: 30,
      status: "pending",
    });

    const responses = await Promise.all([
      request(app)
        .patch(`/api/returns/${concurrentReturnReq._id}/approve`)
        .set("Authorization", `Bearer ${salesManagerToken}`),
      request(app)
        .patch(`/api/returns/${concurrentReturnReq._id}/approve`)
        .set("Authorization", `Bearer ${salesManagerToken}`),
    ]);

    expect(responses.map((res) => res.statusCode).sort()).toEqual([200, 400]);

    const product = await Product.findOne({ productId: concurrentProductId });
    expect(product.quantityInStock).toBe(4);

    const approvedReq = await ReturnRequest.findById(concurrentReturnReq._id);
    expect(approvedReq.status).toBe("approved");

    await Product.deleteOne({ productId: concurrentProductId });
  });
});
