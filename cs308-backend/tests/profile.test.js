const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../server");
const User = require("../models/User");

const createEmail = (label) => `profile-${label}-${Date.now()}@example.com`;
const createdUserIds = [];
let customerToken;
let customerEmail;

beforeAll(async () => {
  customerEmail = createEmail("customer");
  const customerRes = await request(app).post("/api/auth/register").send({
    name: "Profile Test User",
    email: customerEmail,
    password: "Password123!",
  });
  customerToken = customerRes.body.token;
  createdUserIds.push(customerRes.body.user.id);
});

afterAll(async () => {
  await User.deleteMany({ email: /profile-.*@example\.com$/ });
  await mongoose.connection.close();
});

describe("Profile API", () => {
  test("GET /api/auth/me requires auth", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.statusCode).toBe(401);
  });

  test("GET /api/auth/me returns profile for logged-in user", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.user).toHaveProperty("name");
    expect(res.body.user).toHaveProperty("email");
  });

  test("GET /api/auth/me returns correct user name", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.body.user.name).toBe("Profile Test User");
  });

  test("PUT /api/auth/me requires auth", async () => {
    const res = await request(app).put("/api/auth/me").send({
      name: "Updated Name",
      taxId: "12345",
      address: "123 Test St",
    });
    expect(res.statusCode).toBe(401);
  });

  test("PUT /api/auth/me returns 400 when name is missing", async () => {
    const res = await request(app)
      .put("/api/auth/me")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ taxId: "12345", address: "123 Test St" });
    expect(res.statusCode).toBe(400);
  });

  test("PUT /api/auth/me returns 400 when taxId is missing", async () => {
    const res = await request(app)
      .put("/api/auth/me")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ name: "Updated Name", address: "123 Test St" });
    expect(res.statusCode).toBe(400);
  });

  test("PUT /api/auth/me returns 400 when address is missing", async () => {
    const res = await request(app)
      .put("/api/auth/me")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ name: "Updated Name", taxId: "12345" });
    expect(res.statusCode).toBe(400);
  });

  test("PUT /api/auth/me updates profile successfully", async () => {
    const res = await request(app)
      .put("/api/auth/me")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        name: "Updated Name",
        taxId: "12345678",
        address: "456 New Street",
      });
    expect(res.statusCode).toBe(200);
    expect(res.body.user.name).toBe("Updated Name");
    expect(res.body.user.address).toBe("456 New Street");
  });

  test("PUT /api/auth/me/password requires auth", async () => {
    const res = await request(app).put("/api/auth/me/password").send({
      currentPassword: "Password123!",
      newPassword: "NewPassword123!",
    });

    expect(res.statusCode).toBe(401);
  });

  test("PUT /api/auth/me/password rejects an incorrect current password", async () => {
    const res = await request(app)
      .put("/api/auth/me/password")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        currentPassword: "incorrect",
        newPassword: "NewPassword123!",
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Current password is incorrect");
  });

  test("PUT /api/auth/me/password changes the password", async () => {
    const res = await request(app)
      .put("/api/auth/me/password")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        currentPassword: "Password123!",
        newPassword: "NewPassword123!",
      });

    expect(res.statusCode).toBe(200);

    const loginRes = await request(app).post("/api/auth/login").send({
      email: customerEmail,
      password: "NewPassword123!",
    });

    expect(loginRes.statusCode).toBe(200);
  });
});
