const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../server");
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const Invoice = require("../models/Invoice");
const Delivery = require("../models/Delivery");

const createEmail = (label) =>
  `payment-stock-recheck-${label}-${Date.now()}@example.com`;

const validCard = {
  cardHolder: "Stock Recheck Customer",
  cardNumber: "1234567890123456",
  expiryMonth: "12",
  expiryYear: "2099",
  cvv: "123",
};

let customerToken;
let customerId;

const productId = `stock-recheck-product-${Date.now()}`;
const cartId = `stock-recheck-cart-${Date.now()}`;

beforeAll(async () => {
  const customerRes = await request(app).post("/api/auth/register").send({
    name: "Payment Stock Recheck Customer",
    email: createEmail("customer"),
    password: "Password123!",
  });

  customerToken = customerRes.body.token;
  customerId = customerRes.body.user.id;
});

afterEach(async () => {
  await Product.deleteMany({ productId: { $regex: /^stock-recheck-product-/ } });
  await Order.deleteMany({ cartId: { $regex: /^stock-recheck-cart-/ } });
  await Payment.deleteMany({ userId: customerId });
  await Invoice.deleteMany({ userId: customerId });
  await Delivery.deleteMany({ userId: customerId });
});

afterAll(async () => {
  await User.deleteMany({ email: /payment-stock-recheck-.*@example\.com$/ });
  await mongoose.connection.close();
});

const createProduct = async ({ quantityInStock }) =>
  Product.create({
    productId,
    categoryId: "test-category",
    name: "Stock Recheck Product",
    model: "Stock Model",
    serialNumber: `stock-recheck-serial-${Date.now()}`,
    description: "Product used for payment stock recheck tests",
    quantityInStock,
    price: 100,
    warrantyStatus: "No warranty",
    distributorInfo: "Test Distributor",
    imageUrl: "",
  });

const createPendingOrder = async ({ quantity }) =>
  Order.create({
    userId: customerId,
    cartId,
    items: [
      {
        productId,
        name: "Stock Recheck Product",
        unitPrice: 100,
        quantity,
      },
    ],
    totalPrice: 100 * quantity,
    status: "pending_payment",
  });

describe("Payment stock recheck", () => {
  test("GET /api/payments/order/:orderId blocks payment page when stock is unavailable", async () => {
    await createProduct({ quantityInStock: 0 });
    const order = await createPendingOrder({ quantity: 1 });

    const res = await request(app)
      .get(`/api/payments/order/${order._id}`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.statusCode).toBe(400);
    expect(res.body.valid).toBe(false);
    expect(res.body.message).toBe("Not enough stock for Stock Recheck Product");
    expect(res.body.productId).toBe(productId);
    expect(res.body.availableStock).toBe(0);
  });

  test("POST /api/payments/:orderId blocks payment if stock becomes unavailable after order creation", async () => {
    await createProduct({ quantityInStock: 1 });
    const order = await createPendingOrder({ quantity: 1 });

    const pageLoadRes = await request(app)
      .get(`/api/payments/order/${order._id}`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(pageLoadRes.statusCode).toBe(200);

    await Product.updateOne({ productId }, { quantityInStock: 0 });

    const paymentRes = await request(app)
      .post(`/api/payments/${order._id}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send(validCard);

    expect(paymentRes.statusCode).toBe(400);
    expect(paymentRes.body.valid).toBe(false);
    expect(paymentRes.body.message).toBe("Not enough stock for Stock Recheck Product");
    expect(paymentRes.body.productId).toBe(productId);
    expect(paymentRes.body.availableStock).toBe(0);

    const updatedOrder = await Order.findById(order._id);
    expect(updatedOrder.status).toBe("payment_failed");
  });

  test("stock failure does not reduce inventory or create a payment record", async () => {
    await createProduct({ quantityInStock: 0 });
    const order = await createPendingOrder({ quantity: 1 });

    const paymentRes = await request(app)
      .post(`/api/payments/${order._id}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send(validCard);

    expect(paymentRes.statusCode).toBe(400);

    const productAfterPayment = await Product.findOne({ productId });
    expect(productAfterPayment.quantityInStock).toBe(0);

    const payments = await Payment.find({ orderId: order._id.toString() });
    expect(payments).toHaveLength(0);
  });

  test("already-paid orders cannot be paid again or create duplicate records", async () => {
    await createProduct({ quantityInStock: 1 });
    const order = await createPendingOrder({ quantity: 1 });

    const firstPaymentRes = await request(app)
      .post(`/api/payments/${order._id}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send(validCard);

    expect(firstPaymentRes.statusCode).toBe(200);
    expect(firstPaymentRes.body.success).toBe(true);

    const secondPaymentRes = await request(app)
      .post(`/api/payments/${order._id}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send(validCard);

    expect(secondPaymentRes.statusCode).toBe(400);
    expect(secondPaymentRes.body.message).toBe("Order has already been paid");

    const updatedOrder = await Order.findById(order._id);
    expect(updatedOrder.status).toBe("paid");

    const productAfterDuplicateAttempt = await Product.findOne({ productId });
    expect(productAfterDuplicateAttempt.quantityInStock).toBe(0);

    const payments = await Payment.find({ orderId: order._id.toString() });
    expect(payments).toHaveLength(1);
    expect(payments[0].status).toBe("success");

    const invoices = await Invoice.find({ orderId: order._id.toString() });
    expect(invoices).toHaveLength(1);

    const deliveries = await Delivery.find({ orderId: order._id.toString() });
    expect(deliveries).toHaveLength(1);
  });
});
