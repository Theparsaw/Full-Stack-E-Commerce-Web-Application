const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../server");
const User = require("../models/User");
const Product = require("../models/Product");

const createEmail = (label) => `price-${label}-${Date.now()}@example.com`;
const customerEmail = createEmail("customer");
const createdUserIds = [];
const createdProductIds = [];

let salesManagerToken;
let productManagerToken;
let customerToken;

beforeAll(async () => {
  // Login as the seeded sales manager
  const managerRes = await request(app).post("/api/auth/login").send({
    email: "salesmanager@store.com",
    password: "sales123",
  });
  salesManagerToken = managerRes.body.token;

  const productManagerRes = await request(app).post("/api/auth/login").send({
    email: "productmanager@store.com",
    password: "product123",
  });
  productManagerToken = productManagerRes.body.token;

  // Register a regular customer
  const customerRes = await request(app).post("/api/auth/register").send({
    name: "Price Test Customer",
    email: customerEmail,
    password: "Password123!",
  });
  customerToken = customerRes.body.token;
  createdUserIds.push(customerRes.body.user.id);
});

afterAll(async () => {
  await User.deleteMany({ email: customerEmail });
  await Product.deleteMany({ productId: { $in: createdProductIds } });
  await mongoose.connection.close();
});

describe("Price Management API (Sales Manager)", () => {
  test("PUT /api/products/:id requires authentication", async () => {
    const res = await request(app)
      .put("/api/products/p001")
      .send({ price: 999.99 });

    expect(res.statusCode).toBe(401);
  });

  test("PUT /api/products/:id is denied for regular customers", async () => {
    const res = await request(app)
      .put("/api/products/p001")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ price: 999.99 });

    expect(res.statusCode).toBe(403);
  });

  test("PUT /api/products/:id returns 404 for non-existent product", async () => {
    const res = await request(app)
      .put("/api/products/nonexistent-product-id/price")
      .set("Authorization", `Bearer ${salesManagerToken}`)
      .send({ price: 50.00 });

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Product not found");
  });

  test("Product manager cannot use the sales-manager price endpoint", async () => {
    const res = await request(app)
      .put("/api/products/p001/price")
      .set("Authorization", `Bearer ${productManagerToken}`)
      .send({ price: 50 });

    expect(res.statusCode).toBe(403);
  });

  test("Products created by product managers start unpriced even if a price is submitted", async () => {
    const suffix = Date.now();
    const productId = `unpriced-${suffix}`;
    createdProductIds.push(productId);

    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${productManagerToken}`)
      .send({
        productId,
        categoryId: "test",
        name: "Unpriced Product",
        model: "Awaiting Sales Price",
        serialNumber: `UNPRICED-${suffix}`,
        description: "Product manager cannot assign this product's price.",
        quantityInStock: 5,
        price: 999,
        warrantyStatus: "No warranty",
        distributorInfo: "Test Distributor",
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.product.price).toBe(0);
  });

  test("Product manager cannot change price through the general product update endpoint", async () => {
    const before = await request(app).get("/api/products/p001");

    const res = await request(app)
      .put("/api/products/p001")
      .set("Authorization", `Bearer ${productManagerToken}`)
      .send({ price: before.body.price + 100 });

    expect(res.statusCode).toBe(200);

    const after = await request(app).get("/api/products/p001");
    expect(after.body.price).toBe(before.body.price);
  });

  test("Sales manager can update product price successfully", async () => {
    const before = await request(app).get("/api/products/p001");
    const originalPrice = before.body.price;

    const res = await request(app)
      .put("/api/products/p001/price")
      .set("Authorization", `Bearer ${salesManagerToken}`)
      .send({ price: 1234.56 });

    expect(res.statusCode).toBe(200);
    expect(res.body.product.price).toBe(1234.56);

    // Restore original price
    await request(app)
      .put("/api/products/p001/price")
      .set("Authorization", `Bearer ${salesManagerToken}`)
      .send({ price: originalPrice });
  });

  test("Updated price is reflected in subsequent GET request", async () => {
    const before = await request(app).get("/api/products/p002");
    const originalPrice = before.body.price;

    await request(app)
      .put("/api/products/p002/price")
      .set("Authorization", `Bearer ${salesManagerToken}`)
      .send({ price: 777.77 });

    const after = await request(app).get("/api/products/p002");
    expect(after.body.price).toBe(777.77);

    // Restore original price
    await request(app)
      .put("/api/products/p002/price")
      .set("Authorization", `Bearer ${salesManagerToken}`)
      .send({ price: originalPrice });
  });

  test("Sales manager can set price to zero", async () => {
    const before = await request(app).get("/api/products/p003");
    const originalPrice = before.body.price;

    const res = await request(app)
      .put("/api/products/p003/price")
      .set("Authorization", `Bearer ${salesManagerToken}`)
      .send({ price: 0 });

    expect(res.statusCode).toBe(200);
    expect(res.body.product.price).toBe(0);

    // Restore
    await request(app)
      .put("/api/products/p003/price")
      .set("Authorization", `Bearer ${salesManagerToken}`)
      .send({ price: originalPrice });
  });
});
