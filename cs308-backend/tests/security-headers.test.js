const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../server");

afterAll(async () => {
  await mongoose.connection.close();
});

describe("Security Headers and Request Hardening", () => {
  test("API response includes X-Content-Type-Options header (Helmet)", async () => {
    const res = await request(app).get("/api/products");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  test("API response includes X-Frame-Options header (Helmet)", async () => {
    const res = await request(app).get("/api/products");
    expect(res.headers["x-frame-options"]).toBeDefined();
  });

  test("API response includes X-DNS-Prefetch-Control header (Helmet)", async () => {
    const res = await request(app).get("/api/products");
    expect(res.headers["x-dns-prefetch-control"]).toBeDefined();
  });

  test("Requests with JSON body larger than 10kb are rejected", async () => {
    const largeBody = { data: "x".repeat(11 * 1024) };
    const res = await request(app)
      .post("/api/auth/login")
      .send(largeBody)
      .set("Content-Type", "application/json");

    expect(res.statusCode).toBe(413);
  });

  test("Server starts and responds normally after middleware changes", async () => {
    const res = await request(app).get("/");
    expect(res.statusCode).toBe(200);
  });

  test("Auth routes are accessible (rate limiter skipped in test env)", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "nonexistent@test.com",
      password: "wrongpassword",
    });
    // Should get 401, not 429 (rate limited) since we skip in test env
    expect(res.statusCode).not.toBe(429);
  });
});
