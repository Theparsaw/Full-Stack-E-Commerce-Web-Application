const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../server");
const User = require("../models/User");
const bcrypt = require("bcrypt");

const managerEmail = `manager-${Date.now()}@example.com`;

beforeAll(async () => {
  const password = await bcrypt.hash("ManagerPass123!", 10);
  await User.create({
    name: "Manager",
    email: managerEmail,
    password,
    role: "product_manager",
  });
});

afterAll(async () => {
  await User.deleteMany({ email: managerEmail });
  await mongoose.connection.close();
});

describe("Product API Endpoints (safe, non-polluting tests)", () => {
  test("POST /api/products is denied for sales managers", async () => {
  const salesLoginRes = await request(app).post("/api/auth/login").send({
    email: "salesmanager@store.com",
    password: "sales123",
  });

    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${salesLoginRes.body.token}`)
      .send({
        productId: "p-sales-blocked",
        categoryId: "cat1",
        name: "Blocked Product",
        model: "Blocked Model",
        serialNumber: "SALES-BLOCKED-001",
        description: "Sales manager should not create products",
        quantityInStock: 1,
        price: 10,
        warrantyStatus: "1 year warranty",
        distributorInfo: "Test Distributor",
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  test("PUT /api/products/:id is denied for sales managers", async () => {
    const salesLoginRes = await request(app).post("/api/auth/login").send({
      email: "salesmanager@store.com",
      password: "sales123",
    });

    const res = await request(app)
      .put("/api/products/p001")
      .set("Authorization", `Bearer ${salesLoginRes.body.token}`)
      .send({ name: "Should Not Update" });

    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  test("DELETE /api/products/:id is denied for sales managers", async () => {
    const salesLoginRes = await request(app).post("/api/auth/login").send({
      email: "salesmanager@store.com",
      password: "sales123",
    });

    const res = await request(app)
      .delete("/api/products/p001")
      .set("Authorization", `Bearer ${salesLoginRes.body.token}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });
  // GET /api/products
  test("GET /api/products should return 200 and an array", async () => {
    const res = await request(app).get("/api/products");

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("GET /api/products should return 20 seeded products", async () => {
    const res = await request(app).get("/api/products");

    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(50);
  });

  test("GET /api/products should return products with required camelCase fields", async () => {
    const res = await request(app).get("/api/products");
    const product = res.body[0];

    expect(product).toHaveProperty("productId");
    expect(product).toHaveProperty("categoryId");
    expect(product).toHaveProperty("name");
    expect(product).toHaveProperty("model");
    expect(product).toHaveProperty("serialNumber");
    expect(product).toHaveProperty("description");
    expect(product).toHaveProperty("quantityInStock");
    expect(product).toHaveProperty("price");
    expect(product).toHaveProperty("warrantyStatus");
    expect(product).toHaveProperty("distributorInfo");
  });

  // GET /api/products/:id
  test("GET /api/products/p001 should return 200 and the correct product", async () => {
    const res = await request(app).get("/api/products/p001");

    expect(res.statusCode).toBe(200);
    expect(res.body.productId).toBe("p001");
  });

  test("GET /api/products/p001 should return iPhone 15 Pro", async () => {
    const res = await request(app).get("/api/products/p001");

    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe("Apple");
    expect(res.body.model).toBe("iPhone 15 Pro");
  });

  test("GET /api/products/fakeid should return 404", async () => {
    const res = await request(app).get("/api/products/fakeid");

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Product not found");
  });

  // POST /api/products
  test("POST /api/products requires manager authentication", async () => {
    const res = await request(app)
      .post("/api/products")
      .send({
        productId: "p-auth-check",
        categoryId: "cat1",
        name: "Unauthorized",
        model: "Blocked",
        serialNumber: "UNAUTH-BLOCKED-001",
        description: "Should be blocked without a token",
        quantityInStock: 1,
        price: 10,
        warrantyStatus: "1 year warranty",
        distributorInfo: "Test Distributor",
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe("AUTH_REQUIRED");
  });

  // Safe test: use duplicate productId and serialNumber so nothing new is inserted
  test("POST /api/products with existing productId should return 400 and not insert anything", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: managerEmail,
      password: "ManagerPass123!",
    });

    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${loginRes.body.token}`)
      .send({
        productId: "p001",
        categoryId: "cat1",
        name: "Apple",
        model: "Duplicate Test",
        serialNumber: "NEW-SERIAL-DO-NOT-INSERT",
        description: "Should fail because productId already exists",
        quantityInStock: 1,
        price: 10,
        warrantyStatus: "1 year warranty",
        distributorInfo: "Test Distributor",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("A product with this productId already exists");
  });

  test("POST /api/products with existing serialNumber should return 400 and not insert anything", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: managerEmail,
      password: "ManagerPass123!",
    });

    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${loginRes.body.token}`)
      .send({
        productId: "p999",
        categoryId: "cat1",
        name: "Apple",
        model: "Duplicate Serial Test",
        serialNumber: "APL-IP15PRO-001",
        description: "Should fail because serial number already exists",
        quantityInStock: 1,
        price: 10,
        warrantyStatus: "1 year warranty",
        distributorInfo: "Test Distributor",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("A product with this serial number already exists");
  });

  // PUT /api/products/:id
  // Safe test: use nonexistent id so nothing gets updated
  test("PUT /api/products/fakeid should return 404 and not update anything", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: managerEmail,
      password: "ManagerPass123!",
    });

    const res = await request(app)
      .put("/api/products/fakeid")
      .set("Authorization", `Bearer ${loginRes.body.token}`)
      .send({ price: 49.99 });

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Product not found");
  });

  // DELETE /api/products/:id
  // Safe test: use nonexistent id so nothing gets deleted
  test("DELETE /api/products/fakeid should return 404 and not delete anything", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: managerEmail,
      password: "ManagerPass123!",
    });

    const res = await request(app)
      .delete("/api/products/fakeid")
      .set("Authorization", `Bearer ${loginRes.body.token}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Product not found");
  });
  // GET /api/products?search=
test("GET /api/products?search=Samsung should return only Samsung products", async () => {
  const res = await request(app).get("/api/products?search=Samsung");

  expect(res.statusCode).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  expect(res.body.length).toBeGreaterThan(0);
  // every result should have Samsung in name, model, or description
  res.body.forEach((product) => {
    const combined = `${product.name} ${product.model} ${product.description}`.toLowerCase();
    expect(combined).toContain("samsung");
  });
});

test("GET /api/products?search=mirrorless should return products with mirrorless in description", async () => {
  const res = await request(app).get("/api/products?search=mirrorless");

  expect(res.statusCode).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  expect(res.body.length).toBeGreaterThan(0);
  res.body.forEach((product) => {
    const combined = `${product.name} ${product.model} ${product.description}`.toLowerCase();
    expect(combined).toContain("mirrorless");
  });
});

test("GET /api/products?search=SAMSUNG should work case-insensitively", async () => {
  const res = await request(app).get("/api/products?search=SAMSUNG");

  expect(res.statusCode).toBe(200);
  expect(res.body.length).toBeGreaterThan(0);
});

test("GET /api/products?search= empty string should return all products", async () => {
  const res = await request(app).get("/api/products?search=");

  expect(res.statusCode).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  expect(res.body.length).toBeGreaterThan(0);
});
});
