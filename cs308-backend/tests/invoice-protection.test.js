const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../server");
const User = require("../models/User");
const Invoice = require("../models/Invoice");
const Order = require("../models/Order");

const createEmail = (label) => `invoice-${label}-${Date.now()}@example.com`;
const createdEmails = [];

let customer1Token;
let customer1Id;
let customer2Token;
let customer2Id;
let salesManagerToken;
let customer1InvoiceId;
let customer1OrderId;

beforeAll(async () => {
  // Register customer 1
  const res1 = await request(app).post("/api/auth/register").send({
    name: "Invoice Customer 1",
    email: createEmail("c1"),
    password: "Password123!",
  });
  customer1Token = res1.body.token;
  customer1Id = res1.body.user.id;
  createdEmails.push(res1.body.user.email);

  // Register customer 2
  const res2 = await request(app).post("/api/auth/register").send({
    name: "Invoice Customer 2",
    email: createEmail("c2"),
    password: "Password123!",
  });
  customer2Token = res2.body.token;
  customer2Id = res2.body.user.id;
  createdEmails.push(res2.body.user.email);

  // Login as sales manager
  const smRes = await request(app).post("/api/auth/login").send({
    email: "salesmanager@store.com",
    password: "sales123",
  });
  salesManagerToken = smRes.body.token;

  // Create a paid order for customer 1
  const order = await Order.create({
    userId: customer1Id,
    cartId: `cart-inv-${Date.now()}`,
    items: [{ productId: "p001", name: "Test Product", quantity: 1, unitPrice: 100 }],
    totalPrice: 100,
    status: "paid",
    address: "Test Address",
    paidAt: new Date(),
  });
  customer1OrderId = order._id.toString();

  // Create invoice for customer 1
  const invoice = await Invoice.create({
    orderId: customer1OrderId,
    userId: customer1Id,
    invoiceNumber: `INV-TEST-${Date.now()}`,
    amount: 100,
    status: "generated",
  });
  customer1InvoiceId = invoice._id.toString();
});

afterAll(async () => {
  await Invoice.findByIdAndDelete(customer1InvoiceId);
  await Order.findByIdAndDelete(customer1OrderId);
  await User.deleteMany({ email: { $in: createdEmails } });
  await mongoose.connection.close();
});

describe("Invoice Data Protection", () => {
  test("GET /api/invoices/my-invoices requires authentication", async () => {
    const res = await request(app).get("/api/invoices/my-invoices");
    expect(res.statusCode).toBe(401);
  });

  test("Customer can access their own invoices", async () => {
    const res = await request(app)
      .get("/api/invoices/my-invoices")
      .set("Authorization", `Bearer ${customer1Token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.invoices).toBeDefined();
    expect(Array.isArray(res.body.invoices)).toBe(true);
  });

  test("Customer only sees their own invoices, not other customers", async () => {
    const res = await request(app)
      .get("/api/invoices/my-invoices")
      .set("Authorization", `Bearer ${customer2Token}`);
    expect(res.statusCode).toBe(200);
    const invoiceIds = res.body.invoices.map((i) => i.id?.toString());
    expect(invoiceIds).not.toContain(customer1InvoiceId);
  });

  test("Invoice download requires authentication", async () => {
    const res = await request(app).get(`/api/invoices/${customer1InvoiceId}/download`);
    expect(res.statusCode).toBe(401);
  });

  test("Customer cannot download another customer's invoice", async () => {
    const res = await request(app)
      .get(`/api/invoices/${customer1InvoiceId}/download`)
      .set("Authorization", `Bearer ${customer2Token}`);
    expect(res.statusCode).toBe(404);
  });

  test("GET /api/invoices/sales requires sales_manager role", async () => {
    const res = await request(app)
      .get("/api/invoices/sales")
      .set("Authorization", `Bearer ${customer1Token}`);
    expect(res.statusCode).toBe(403);
  });

  test("Sales manager can access all invoices", async () => {
    const res = await request(app)
      .get("/api/invoices/sales")
      .set("Authorization", `Bearer ${salesManagerToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.invoices).toBeDefined();
    expect(Array.isArray(res.body.invoices)).toBe(true);
  });

  test("GET /api/invoices/sales/report requires sales_manager role", async () => {
    const res = await request(app)
      .get("/api/invoices/sales/report")
      .set("Authorization", `Bearer ${customer1Token}`);
    expect(res.statusCode).toBe(403);
  });

  test("Sales manager can access revenue report", async () => {
    const res = await request(app)
      .get("/api/invoices/sales/report")
      .set("Authorization", `Bearer ${salesManagerToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.summary).toBeDefined();
  });

  test("Invoice response does not expose unnecessary sensitive fields", async () => {
    const res = await request(app)
      .get("/api/invoices/my-invoices")
      .set("Authorization", `Bearer ${customer1Token}`);
    expect(res.statusCode).toBe(200);
    if (res.body.invoices.length > 0) {
      const invoice = res.body.invoices[0];
      // userId should not be exposed in customer invoice list
      expect(invoice.userId).toBeUndefined();
    }
  });

  test("Sales report date range filter rejects invalid dates", async () => {
    const res = await request(app)
      .get("/api/invoices/sales/report?startDate=not-a-date")
      .set("Authorization", `Bearer ${salesManagerToken}`);
    expect(res.statusCode).toBe(400);
  });
});
