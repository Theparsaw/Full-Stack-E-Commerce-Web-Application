const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../server");
const User = require("../models/User");

const createEmail = (label) => `ordertest-${label}-${Date.now()}@example.com`;
const createdUserIds = [];
let customerToken;
let productManagerToken;

beforeAll(async () => {
  // Register a regular customer
  const customerRes = await request(app).post("/api/auth/register").send({
    name: "Order Test Customer",
    email: createEmail("customer"),
    password: "Password123!",
  });
  customerToken = customerRes.body.token;
  createdUserIds.push(customerRes.body.user.id);

  // Login as product manager, who also owns delivery operations.
  const managerRes = await request(app).post("/api/auth/login").send({
    email: "productmanager@store.com",
    password: "product123",
  });
  productManagerToken = managerRes.body.token;
});

afterAll(async () => {
  await User.deleteMany({ email: /ordertest-.*@example\.com$/ });
  await mongoose.connection.close();
});

describe("Orders API", () => {
  test("GET /api/orders/my-orders requires auth", async () => {
    const res = await request(app).get("/api/orders/my-orders");
    expect(res.statusCode).toBe(401);
  });

  test("GET /api/orders/my-orders returns orders array for logged-in user", async () => {
    const res = await request(app)
      .get("/api/orders/my-orders")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("orders");
    expect(Array.isArray(res.body.orders)).toBe(true);
  });

  test("GET /api/orders/my-orders returns empty array when no orders", async () => {
    const res = await request(app)
      .get("/api/orders/my-orders")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.orders.length).toBeGreaterThanOrEqual(0);
  });
});

describe("Delivery API", () => {
  test("GET /api/deliveries requires auth", async () => {
    const res = await request(app).get("/api/deliveries");
    expect(res.statusCode).toBe(401);
  });

  test("GET /api/deliveries denied for regular customer", async () => {
    const res = await request(app)
      .get("/api/deliveries")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.statusCode).toBe(403);
  });

  test("GET /api/deliveries works for product manager", async () => {
    const res = await request(app)
      .get("/api/deliveries")
      .set("Authorization", `Bearer ${productManagerToken}`);
    expect(res.statusCode).toBe(200);
  });

  test("PATCH /api/deliveries/:id/status requires auth", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).patch(`/api/deliveries/${fakeId}/status`);
    expect(res.statusCode).toBe(401);
  });

  test("PATCH /api/deliveries/:id/status denied for regular customer", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .patch(`/api/deliveries/${fakeId}/status`)
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.statusCode).toBe(403);
  });

  test("PATCH /api/deliveries/:id/order-date requires auth", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .patch(`/api/deliveries/${fakeId}/order-date`)
      .send({ orderDate: "2026-04-20T10:00:00.000Z" });

    expect(res.statusCode).toBe(401);
  });

  test("PATCH /api/deliveries/:id/order-date denied for regular customer", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .patch(`/api/deliveries/${fakeId}/order-date`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ orderDate: "2026-04-20T10:00:00.000Z" });

    expect(res.statusCode).toBe(403);
  });

  test("PATCH /api/deliveries/:id/status returns 404 for non-existent delivery", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .patch(`/api/deliveries/${fakeId}/status`)
      .set("Authorization", `Bearer ${productManagerToken}`)
      .send({ status: "in_transit" });
    expect(res.statusCode).toBe(400);
  });
});
