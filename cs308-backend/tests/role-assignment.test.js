const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../server");
const User = require("../models/User");

const createEmail = (label) => `role-${label}-${Date.now()}@example.com`;
const createdEmails = [];

afterAll(async () => {
  await User.deleteMany({ email: { $in: createdEmails } });
  await mongoose.connection.close();
});

describe("Role Assignment", () => {
  test("Newly registered user gets customer role by default", async () => {
    const email = createEmail("newuser");
    createdEmails.push(email);

    const res = await request(app).post("/api/auth/register").send({
      name: "Role Test User",
      email,
      password: "Password123!",
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.user.role).toBe("customer");
  });

  test("Registration does not allow setting role via request body", async () => {
    const email = createEmail("hackrole");
    createdEmails.push(email);

    const res = await request(app).post("/api/auth/register").send({
      name: "Hack Role User",
      email,
      password: "Password123!",
      role: "product_manager",
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.user.role).toBe("customer");
  });

  test("Seeded sales manager has sales_manager role", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "salesmanager@store.com",
      password: "sales123",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.role).toBe("sales_manager");
  });

  test("Seeded product manager has product_manager role", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "productmanager@store.com",
      password: "product123",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.role).toBe("product_manager");
  });

  test("Customer cannot access product manager routes", async () => {
    const email = createEmail("customer");
    createdEmails.push(email);

    const regRes = await request(app).post("/api/auth/register").send({
      name: "Customer Role Check",
      email,
      password: "Password123!",
    });
    const token = regRes.body.token;

    const res = await request(app)
      .get("/api/moderation/reviews/pending")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(403);
  });

  test("Customer cannot access sales manager routes", async () => {
    const email = createEmail("customer2");
    createdEmails.push(email);

    const regRes = await request(app).post("/api/auth/register").send({
      name: "Customer Role Check 2",
      email,
      password: "Password123!",
    });
    const token = regRes.body.token;

    const res = await request(app)
      .put("/api/products/p001")
      .set("Authorization", `Bearer ${token}`)
      .send({ price: 1 });

    expect(res.statusCode).toBe(403);
  });
});
