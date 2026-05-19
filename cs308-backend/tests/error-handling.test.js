const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../server");
const User = require("../models/User");

const createEmail = (label) => `errtest-${label}-${Date.now()}@example.com`;
const createdEmails = [];
let customerToken;

beforeAll(async () => {
  const email = createEmail("customer");
  createdEmails.push(email);
  const res = await request(app).post("/api/auth/register").send({
    name: "Error Test User",
    email,
    password: "Password123!",
  });
  customerToken = res.body.token;
});

afterAll(async () => {
  await User.deleteMany({ email: { $in: createdEmails } });
  await mongoose.connection.close();
});

describe("Error Handling and Sensitive Output", () => {
  test("Unknown route returns 404 with NOT_FOUND code", async () => {
    const res = await request(app).get("/api/this-does-not-exist");
    expect(res.statusCode).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
    expect(res.body.message).toBeDefined();
  });

  test("Error response always includes message and code fields", async () => {
    const res = await request(app).get("/api/products/nonexistent-id");
    expect(res.body).toHaveProperty("message");
    expect(res.body).toHaveProperty("code");
  });

  test("Stack trace is not exposed in test/production environment", async () => {
    const res = await request(app).get("/api/this-does-not-exist");
    expect(res.body.stack).toBeUndefined();
  });

  test("401 returned for protected route without token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe("AUTH_REQUIRED");
  });

  test("403 returned for customer accessing manager route", async () => {
    const res = await request(app)
      .get("/api/moderation/reviews/pending")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  test("400 returned for Mongoose validation error with VALIDATION_ERROR code", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Missing Email User", password: "Password123!" });
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  test("400 returned for duplicate email with EMAIL_ALREADY_EXISTS code", async () => {
    const email = createEmail("dup");
    createdEmails.push(email);
    await request(app).post("/api/auth/register").send({
      name: "First",
      email,
      password: "Password123!",
    });
    const res = await request(app).post("/api/auth/register").send({
      name: "Second",
      email,
      password: "Password123!",
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("EMAIL_ALREADY_EXISTS");
  });

  test("404 returned for non-existent product with PRODUCT_NOT_FOUND code", async () => {
    const res = await request(app).get("/api/products/nonexistent-id");
    expect(res.statusCode).toBe(404);
    expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
  });

  test("Error response does not leak raw database internals", async () => {
    const res = await request(app).get("/api/this-does-not-exist");
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain("mongodb");
    expect(raw).not.toContain("mongoose");
    expect(raw).not.toContain("node_modules");
  });
});
