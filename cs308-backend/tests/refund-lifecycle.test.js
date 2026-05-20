const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const app = require("../server");
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Delivery = require("../models/Delivery");
const ReturnRequest = require("../models/ReturnRequest");

const uniqueSuffix = Date.now();
let customerToken;
let managerToken;
let customerId;
let testOrderId;
let testProductId = `p-lifecycle-${uniqueSuffix}`;

beforeAll(async () => {
  // 1. Setup Sales Manager
  const password = await bcrypt.hash("ManagerPass123!", 10);
  await User.create({
    name: "Lifecycle Manager",
    email: `manager-${uniqueSuffix}@example.com`,
    password,
    role: "sales_manager",
  });
  const managerRes = await request(app).post("/api/auth/login").send({
    email: `manager-${uniqueSuffix}@example.com`,
    password: "ManagerPass123!",
  });
  managerToken = managerRes.body.token;

  // 2. Setup Customer
  const customerRes = await request(app).post("/api/auth/register").send({
    name: "Lifecycle Customer",
    email: `customer-${uniqueSuffix}@example.com`,
    password: "Password123!",
  });
  customerToken = customerRes.body.token;
  customerId = customerRes.body.user.id;

  // 3. Setup Product, Paid Order, and Delivery
  await Product.create({
    productId: testProductId,
    categoryId: "test",
    name: "Lifecycle Item",
    model: "X",
    serialNumber: `SN-${uniqueSuffix}`,
    description: "Testing full lifecycle",
    quantityInStock: 10,
    price: 100,
    warrantyStatus: "none",
    distributorInfo: "none",
  });

  const order = await Order.create({
    userId: customerId,
    cartId: `cart-${uniqueSuffix}`,
    items: [{ productId: testProductId, name: "Lifecycle Item", unitPrice: 100, quantity: 1 }],
    totalPrice: 100,
    status: "paid",
    paidAt: new Date(),
  });
  testOrderId = order._id;

  await Delivery.create({
    orderId: testOrderId,
    userId: customerId,
    items: order.items,
    totalPrice: 100,
    address: "123 Test St",
    status: "delivered",
  });
});

afterAll(async () => {
  await ReturnRequest.deleteMany({ userId: customerId });
  await Delivery.deleteMany({ orderId: testOrderId });
  await Order.findByIdAndDelete(testOrderId);
  await Product.deleteOne({ productId: testProductId });
  await User.deleteMany({ email: { $regex: `${uniqueSuffix}@example.com` } });
  await mongoose.connection.close();
});

describe("Complete Refund Lifecycle", () => {
  let createdRequestId;

  test("Step 1: Customer requests a return", async () => {
    const res = await request(app)
      .post("/api/returns")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        orderId: testOrderId,
        items: [{ productId: testProductId, quantity: 1 }],
        reason: "Did not meet expectations",
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe("pending");
    createdRequestId = res.body._id;
  });

  test("Step 2: Sales Manager approves the return", async () => {
    const res = await request(app)
      .patch(`/api/returns/${createdRequestId}/approve`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test("Step 3: Customer views their history and sees it approved", async () => {
    const res = await request(app)
      .get("/api/returns")
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.returnRequests.length).toBe(1);
    
    const myRequest = res.body.returnRequests[0];
    expect(myRequest.status).toBe("approved");
    expect(myRequest.refundAmount).toBe(100);
  });
});
