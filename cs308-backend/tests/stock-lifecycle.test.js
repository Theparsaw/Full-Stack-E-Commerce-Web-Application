jest.mock("../utils/emailSender", () => ({
  sendInvoiceEmail: jest.fn().mockResolvedValue(true),
}));

const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const app = require("../server");
const Cart = require("../models/Cart");
const Delivery = require("../models/Delivery");
const Invoice = require("../models/Invoice");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const Product = require("../models/Product");
const ReturnRequest = require("../models/ReturnRequest");
const User = require("../models/User");

const uniqueSuffix = Date.now();
const validCard = {
  cardHolder: "Stock Lifecycle Customer",
  cardNumber: "4242424242424242",
  expiryMonth: "12",
  expiryYear: "2099",
  cvv: "123",
};

let customerToken;
let managerToken;
let customerId;

const createdCartIds = [];
const createdOrderIds = [];
const createdProductIds = [];

const createProduct = async ({ label, quantityInStock }) => {
  const productId = `stock-lifecycle-${label}-${uniqueSuffix}`;
  createdProductIds.push(productId);

  await Product.create({
    productId,
    categoryId: "stock-lifecycle",
    name: `Stock Lifecycle ${label}`,
    model: `Lifecycle-${label}`,
    serialNumber: `SN-STOCK-LIFECYCLE-${label}-${uniqueSuffix}`,
    description: "Product used for stock lifecycle tests",
    quantityInStock,
    price: 25,
    warrantyStatus: "Test warranty",
    distributorInfo: "Test distributor",
  });

  return productId;
};

const createCart = async ({ productId, quantity }) => {
  const cartId = `stock-lifecycle-cart-${productId}-${Date.now()}`;
  createdCartIds.push(cartId);

  await Cart.create({
    cartId,
    userId: new mongoose.Types.ObjectId(customerId),
    items: [
      {
        productId,
        name: "Stock Lifecycle Item",
        unitPrice: 25,
        quantity,
        imageUrl: "",
      },
    ],
    totalPrice: 25 * quantity,
  });

  return cartId;
};

const createPaidOrderFromCart = async ({ productId, quantity }) => {
  const cartId = await createCart({ productId, quantity });

  const orderRes = await request(app)
    .post(`/api/checkout/${cartId}/order`)
    .set("Authorization", `Bearer ${customerToken}`);

  expect(orderRes.statusCode).toBe(201);

  const orderId = orderRes.body.order.id;
  createdOrderIds.push(orderId);

  const paymentRes = await request(app)
    .post(`/api/payments/${orderId}`)
    .set("Authorization", `Bearer ${customerToken}`)
    .send(validCard);

  expect(paymentRes.statusCode).toBe(200);
  expect(paymentRes.body.success).toBe(true);

  return orderId;
};

beforeAll(async () => {
  const customerRes = await request(app).post("/api/auth/register").send({
    name: "Stock Lifecycle Customer",
    email: `stock-lifecycle-customer-${uniqueSuffix}@example.com`,
    password: "Password123!",
  });

  customerToken = customerRes.body.token;
  customerId = customerRes.body.user.id;

  const managerPassword = await bcrypt.hash("ManagerPass123!", 10);
  await User.create({
    name: "Stock Lifecycle Manager",
    email: `stock-lifecycle-manager-${uniqueSuffix}@example.com`,
    password: managerPassword,
    role: "sales_manager",
  });

  const managerRes = await request(app).post("/api/auth/login").send({
    email: `stock-lifecycle-manager-${uniqueSuffix}@example.com`,
    password: "ManagerPass123!",
  });

  managerToken = managerRes.body.token;
});

afterAll(async () => {
  await ReturnRequest.deleteMany({ orderId: { $in: createdOrderIds } });
  await Payment.deleteMany({ orderId: { $in: createdOrderIds } });
  await Delivery.deleteMany({ orderId: { $in: createdOrderIds } });
  await Invoice.deleteMany({ orderId: { $in: createdOrderIds } });
  await Order.deleteMany({ _id: { $in: createdOrderIds } });
  await Cart.deleteMany({ cartId: { $in: createdCartIds } });
  await Product.deleteMany({ productId: { $in: createdProductIds } });
  await User.deleteMany({ email: { $regex: `stock-lifecycle-.*-${uniqueSuffix}@example\\.com$` } });
  await mongoose.connection.close();
});

describe("Stock lifecycle consistency", () => {
  test("successful payment decreases stock and public product state matches the backend", async () => {
    const productId = await createProduct({ label: "payment", quantityInStock: 5 });

    await createPaidOrderFromCart({ productId, quantity: 2 });

    const product = await Product.findOne({ productId }).lean();
    expect(product.quantityInStock).toBe(3);
    expect(product.quantityInStock).toBeGreaterThanOrEqual(0);

    const publicProductRes = await request(app).get(`/api/products/${productId}`);
    expect(publicProductRes.statusCode).toBe(200);
    expect(publicProductRes.body.quantityInStock).toBe(3);
  });

  test("cancelling a paid processing order restores stock exactly once", async () => {
    const productId = await createProduct({ label: "cancel", quantityInStock: 4 });
    const orderId = await createPaidOrderFromCart({ productId, quantity: 2 });

    const afterPayment = await Product.findOne({ productId }).lean();
    expect(afterPayment.quantityInStock).toBe(2);

    const cancelRes = await request(app)
      .patch(`/api/orders/${orderId}/cancel`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(cancelRes.statusCode).toBe(200);
    expect(cancelRes.body.order.status).toBe("cancelled");

    const afterCancel = await Product.findOne({ productId }).lean();
    expect(afterCancel.quantityInStock).toBe(4);

    const duplicateCancelRes = await request(app)
      .patch(`/api/orders/${orderId}/cancel`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(duplicateCancelRes.statusCode).toBe(400);

    const afterDuplicateCancel = await Product.findOne({ productId }).lean();
    expect(afterDuplicateCancel.quantityInStock).toBe(4);
  });

  test("approved refund restores stock exactly once", async () => {
    const productId = await createProduct({ label: "refund", quantityInStock: 3 });
    const orderId = await createPaidOrderFromCart({ productId, quantity: 1 });

    await Delivery.updateOne({ orderId }, { status: "delivered" });

    const afterPayment = await Product.findOne({ productId }).lean();
    expect(afterPayment.quantityInStock).toBe(2);

    const returnRes = await request(app)
      .post("/api/returns")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        orderId,
        items: [{ productId, quantity: 1 }],
        reason: "Stock lifecycle refund",
      });

    expect(returnRes.statusCode).toBe(201);

    const returnRequestId = returnRes.body._id;

    const approveRes = await request(app)
      .patch(`/api/returns/${returnRequestId}/approve`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(approveRes.statusCode).toBe(200);

    const afterApproval = await Product.findOne({ productId }).lean();
    expect(afterApproval.quantityInStock).toBe(3);

    const duplicateApproveRes = await request(app)
      .patch(`/api/returns/${returnRequestId}/approve`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(duplicateApproveRes.statusCode).toBe(400);

    const afterDuplicateApproval = await Product.findOne({ productId }).lean();
    expect(afterDuplicateApproval.quantityInStock).toBe(3);
  });
});
