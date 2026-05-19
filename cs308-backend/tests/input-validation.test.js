const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../server");
const User = require("../models/User");
const Category = require("../models/Category");

const createEmail = (label) => `validation-${label}-${Date.now()}@example.com`;
const createdEmails = [];

let productManagerToken;
let salesManagerToken;
let customerToken;
const testCategoryId = `test-cat-validation-${Date.now()}`;

beforeAll(async () => {
  const pmRes = await request(app).post("/api/auth/login").send({
    email: "productmanager@store.com",
    password: "product123",
  });
  productManagerToken = pmRes.body.token;

  const smRes = await request(app).post("/api/auth/login").send({
    email: "salesmanager@store.com",
    password: "sales123",
  });
  salesManagerToken = smRes.body.token;

  const email = createEmail("customer");
  createdEmails.push(email);
  const reg = await request(app).post("/api/auth/register").send({
    name: "Validation Customer",
    email,
    password: "Password123!",
  });
  customerToken = reg.body.token;
});

afterAll(async () => {
  await User.deleteMany({ email: { $in: createdEmails } });
  await Category.deleteMany({ categoryId: testCategoryId });
  await mongoose.connection.close();
});

// ── Auth Validation ───────────────────────────────────────────────────────────
describe("Auth Input Validation", () => {
  test("Register fails without name", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: createEmail("noname"),
      password: "Password123!",
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  test("Register fails without email", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "No Email",
      password: "Password123!",
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  test("Register fails without password", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "No Password",
      email: createEmail("nopass"),
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  test("Register fails with duplicate email", async () => {
    const email = createEmail("dup");
    createdEmails.push(email);

    await request(app).post("/api/auth/register").send({
      name: "First User",
      email,
      password: "Password123!",
    });

    const res = await request(app).post("/api/auth/register").send({
      name: "Second User",
      email,
      password: "Password123!",
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("EMAIL_ALREADY_EXISTS");
  });

  test("Login fails without email", async () => {
    const res = await request(app).post("/api/auth/login").send({
      password: "Password123!",
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  test("Login fails without password", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "someone@example.com",
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  test("Login fails with wrong credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "nobody@example.com",
      password: "wrongpass",
    });
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe("INVALID_CREDENTIALS");
  });
});

// ── Product Validation ────────────────────────────────────────────────────────
describe("Product Input Validation", () => {
  test("Create product fails without required fields", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${productManagerToken}`)
      .send({ name: "Incomplete Product" });

    expect(res.statusCode).toBe(400);
  });

  test("Create product fails with duplicate productId", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${productManagerToken}`)
      .send({
        productId: "p001",
        categoryId: "electronics",
        name: "Apple",
        model: "Duplicate Test",
        serialNumber: "UNIQUE-SERIAL-9999",
        description: "Should fail",
        quantityInStock: 1,
        price: 100,
        warrantyStatus: "1 year",
        distributorInfo: "Distributor",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/productId already exists/i);
  });

  test("Create product fails with duplicate serial number", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${productManagerToken}`)
      .send({
        productId: "p-unique-999",
        categoryId: "electronics",
        name: "Apple",
        model: "Serial Dup Test",
        serialNumber: "APL-IP15PRO-001",
        description: "Should fail due to serial",
        quantityInStock: 1,
        price: 100,
        warrantyStatus: "1 year",
        distributorInfo: "Distributor",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/serial number already exists/i);
  });

  test("Update product fails for non-existent productId", async () => {
    const res = await request(app)
      .put("/api/products/does-not-exist")
      .set("Authorization", `Bearer ${productManagerToken}`)
      .send({ price: 50 });

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Product not found");
  });
});

// ── Category Validation ───────────────────────────────────────────────────────
describe("Category Input Validation", () => {
  test("Create category fails without name", async () => {
    const res = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${productManagerToken}`)
      .send({ description: "No name provided" });

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  test("Create category succeeds with valid data", async () => {
    const res = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${productManagerToken}`)
      .send({ categoryId: testCategoryId, name: `Validation Test Cat ${Date.now()}`, description: "Test" });

    expect(res.statusCode).toBe(201);
  });

  test("Create category fails with duplicate name", async () => {
    const name = `DupCat-${Date.now()}`;
    const dupId = `dup-cat-${Date.now()}`;

    await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${productManagerToken}`)
      .send({ categoryId: dupId, name });

    const res = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${productManagerToken}`)
      .send({ categoryId: `${dupId}-2`, name });

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("DUPLICATE_CATEGORY");

    await Category.deleteMany({ categoryId: { $in: [dupId, `${dupId}-2`] } });
  });

  test("Update category fails with empty name", async () => {
    const res = await request(app)
      .put(`/api/categories/${testCategoryId}`)
      .set("Authorization", `Bearer ${productManagerToken}`)
      .send({ name: "" });

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  test("Get non-existent category returns 404", async () => {
    const res = await request(app).get("/api/categories/nonexistent-cat-id");
    expect(res.statusCode).toBe(404);
    expect(res.body.code).toBe("CATEGORY_NOT_FOUND");
  });
});

// ── Discount Campaign Validation ──────────────────────────────────────────────
describe("Discount Campaign Input Validation", () => {
  test("Create campaign fails with empty productIds", async () => {
    const res = await request(app)
      .post("/api/discount-campaigns")
      .set("Authorization", `Bearer ${salesManagerToken}`)
      .send({
        name: "Empty Products Campaign",
        productIds: [],
        discountPercentage: 10,
        startDate: "2099-01-01",
        endDate: "2099-12-31",
      });

    expect(res.statusCode).toBe(400);
  });

  test("Create campaign fails with invalid product IDs", async () => {
    const res = await request(app)
      .post("/api/discount-campaigns")
      .set("Authorization", `Bearer ${salesManagerToken}`)
      .send({
        name: "Bad Products Campaign",
        productIds: ["does-not-exist-999"],
        discountPercentage: 10,
        startDate: "2099-01-01",
        endDate: "2099-12-31",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("INVALID_PRODUCTS");
  });

  test("Create campaign fails with discount percentage below 1", async () => {
    const res = await request(app)
      .post("/api/discount-campaigns")
      .set("Authorization", `Bearer ${salesManagerToken}`)
      .send({
        name: "Zero Discount Campaign",
        productIds: ["p001"],
        discountPercentage: 0,
        startDate: "2099-01-01",
        endDate: "2099-12-31",
      });

    expect(res.statusCode).toBe(400);
  });

  test("Create campaign fails with discount percentage above 100", async () => {
    const res = await request(app)
      .post("/api/discount-campaigns")
      .set("Authorization", `Bearer ${salesManagerToken}`)
      .send({
        name: "Over 100 Discount",
        productIds: ["p001"],
        discountPercentage: 101,
        startDate: "2099-01-01",
        endDate: "2099-12-31",
      });

    expect(res.statusCode).toBe(400);
  });

  test("Create campaign fails when endDate is before startDate", async () => {
    const res = await request(app)
      .post("/api/discount-campaigns")
      .set("Authorization", `Bearer ${salesManagerToken}`)
      .send({
        name: "Bad Date Campaign",
        productIds: ["p001"],
        discountPercentage: 10,
        startDate: "2099-12-31",
        endDate: "2099-01-01",
      });

    expect(res.statusCode).toBe(400);
  });

  test("Create campaign requires sales manager auth", async () => {
    const res = await request(app)
      .post("/api/discount-campaigns")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        name: "Unauthorized Campaign",
        productIds: ["p001"],
        discountPercentage: 10,
        startDate: "2099-01-01",
        endDate: "2099-12-31",
      });

    expect(res.statusCode).toBe(403);
  });
});
