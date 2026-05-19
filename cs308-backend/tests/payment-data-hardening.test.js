const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../server");
const User = require("../models/User");
const Order = require("../models/Order");
const Payment = require("../models/Payment");

/**
 * Mock Payment Cards:
 *
 * SUCCESS  → card number ending in even digit  (e.g. 4111111111111112)
 * DECLINED → card number ending in odd digit   (e.g. 4111111111111111)
 *
 * Required format:
 *   cardNumber:   16 digits, no spaces
 *   expiryMonth:  2-digit string, e.g. "12"
 *   expiryYear:   4-digit string, e.g. "2099"
 *   cvv:          3 or 4 digits
 *   cardHolder:   letters only, 2–60 chars
 */

const createEmail = (label) => `payhard-${label}-${Date.now()}@example.com`;
const createdUserIds = [];
let customerToken;
let customerId;
let testOrderId;

beforeAll(async () => {
  const reg = await request(app).post("/api/auth/register").send({
    name: "Payment Hard Customer",
    email: createEmail("customer"),
    password: "Password123!",
  });
  customerToken = reg.body.token;
  customerId = reg.body.user.id;
  createdUserIds.push(customerId);

  // Create a pending order directly in DB
  const order = await Order.create({
    userId: customerId,
    cartId: `cart-payhard-${Date.now()}`,
    items: [{ productId: "p001", name: "Apple iPhone", quantity: 1, unitPrice: 999 }],
    totalPrice: 999,
    status: "pending_payment",
    address: "Test Address",
  });
  testOrderId = order._id.toString();
});

afterAll(async () => {
  await Order.findByIdAndDelete(testOrderId);
  await Payment.deleteMany({ userId: customerId });
  await User.deleteMany({ _id: { $in: createdUserIds } });
  await mongoose.connection.close();
});

describe("Payment Data Hardening", () => {
  test("Payment model has no field for full card number", () => {
    const schemaPaths = Object.keys(Payment.schema.paths);
    expect(schemaPaths).not.toContain("cardNumber");
    expect(schemaPaths).not.toContain("fullCardNumber");
    expect(schemaPaths).not.toContain("card");
  });

  test("Payment model has no field for CVV", () => {
    const schemaPaths = Object.keys(Payment.schema.paths);
    expect(schemaPaths).not.toContain("cvv");
    expect(schemaPaths).not.toContain("cvc");
    expect(schemaPaths).not.toContain("securityCode");
  });

  test("Payment model has no field for card expiry", () => {
    const schemaPaths = Object.keys(Payment.schema.paths);
    expect(schemaPaths).not.toContain("expiryMonth");
    expect(schemaPaths).not.toContain("expiryYear");
    expect(schemaPaths).not.toContain("expiry");
  });

  test("Payment model stores only cardLast4", () => {
    const schemaPaths = Object.keys(Payment.schema.paths);
    expect(schemaPaths).toContain("cardLast4");
  });

  test("Successful payment record contains only last 4 digits of card", async () => {
    const res = await request(app)
      .post(`/api/payments/${testOrderId}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        cardHolder: "Test User",
        cardNumber: "4111111111111112", // ends in 2 → success
        expiryMonth: "12",
        expiryYear: "2099",
        cvv: "123",
      });

    expect(res.statusCode).toBe(200);

    const payment = await Payment.findOne({ orderId: testOrderId });
    expect(payment).not.toBeNull();
    expect(payment.cardLast4).toBe("1112");

    // Full card number must not be stored anywhere
    const raw = JSON.stringify(payment.toObject());
    expect(raw).not.toContain("4111111111111112");
    expect(raw).not.toContain("123"); // CVV
  });

  test("Declined payment record does not store full card number", async () => {
    // Create a new order for this test
    const order = await Order.create({
      userId: customerId,
      cartId: `cart-declined-${Date.now()}`,
      items: [{ productId: "p002", name: "Test Product", quantity: 1, unitPrice: 50 }],
      totalPrice: 50,
      status: "pending_payment",
      address: "Test Address",
    });

    const res = await request(app)
      .post(`/api/payments/${order._id}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        cardHolder: "Test User",
        cardNumber: "4111111111111111", // ends in 1 → declined
        expiryMonth: "12",
        expiryYear: "2099",
        cvv: "456",
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(false);

    const payment = await Payment.findOne({ orderId: order._id.toString() });
    expect(payment).not.toBeNull();
    expect(payment.cardLast4).toBe("1111");

    const raw = JSON.stringify(payment.toObject());
    expect(raw).not.toContain("4111111111111111");
    expect(raw).not.toContain("456"); // CVV

    await Order.findByIdAndDelete(order._id);
    await Payment.findByIdAndDelete(payment._id);
  });
});
