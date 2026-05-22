const request = require("supertest");
const mongoose = require("mongoose");
const fs = require("fs/promises");
const path = require("path");

process.env.CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "test-cloud";
process.env.CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "test-key";
process.env.CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || "test-secret";

jest.mock("cloudinary", () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn((_options, callback) => {
        const { Writable } = require("stream");
        const writable = new Writable({
          write(_chunk, _encoding, next) {
            next();
          },
        });

        writable.on("finish", () => {
          callback(null, {
            secure_url:
              "https://res.cloudinary.com/test-cloud/image/upload/cs308-products/product-test.png",
          });
        });

        return writable;
      }),
    },
  },
}));

const app = require("../server");
const User = require("../models/User");
const Product = require("../models/Product");
const bcrypt = require("bcrypt");

const managerEmail = `manager-${Date.now()}@example.com`;
const imageProductId = `p-image-${Date.now()}`;
const imageProductSerial = `IMG-TEST-${Date.now()}`;
const uploadProductId = `p-upload-${Date.now()}`;
const uploadProductSerial = `UPLOAD-TEST-${Date.now()}`;

const cleanupProductImage = async (productId) => {
  const product = await Product.findOne({ productId }).lean();
  if (!product?.imageUrl?.startsWith("/uploads/product-images/")) return;

  await fs.rm(path.join(__dirname, "..", product.imageUrl.replace(/^\//, "")), {
    force: true,
  });
};

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
  await cleanupProductImage(imageProductId);
  await cleanupProductImage(uploadProductId);
  await Product.deleteMany({ productId: { $in: [imageProductId, uploadProductId] } });
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

  test("POST /api/products saves imageUrl for new products", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: managerEmail,
      password: "ManagerPass123!",
    });

    const imageUrl = "https://example.com/new-product.png";
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${loginRes.body.token}`)
      .send({
        productId: imageProductId,
        categoryId: "cat1",
        name: "Image Brand",
        model: "Image Model",
        serialNumber: imageProductSerial,
        description: "Product created to verify image URL persistence",
        quantityInStock: 1,
        price: 10,
        warrantyStatus: "1 year warranty",
        distributorInfo: "Test Distributor",
        imageUrl,
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.product.imageUrl).toBe(imageUrl);
  });

  test("POST /api/products saves an uploaded product image for new products", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: managerEmail,
      password: "ManagerPass123!",
    });

    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${loginRes.body.token}`)
      .field("productId", uploadProductId)
      .field("categoryId", "cat1")
      .field("name", "Upload Brand")
      .field("model", "Upload Model")
      .field("serialNumber", uploadProductSerial)
      .field("description", "Product created to verify uploaded image persistence")
      .field("quantityInStock", "1")
      .field("price", "10")
      .field("warrantyStatus", "1 year warranty")
      .field("distributorInfo", "Test Distributor")
      .attach("productImage", Buffer.from("fake image bytes"), {
        filename: "product.png",
        contentType: "image/png",
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.product.imageUrl).toBe(
      "https://res.cloudinary.com/test-cloud/image/upload/cs308-products/product-test.png"
    );
  });

  test("PUT /api/products/:id updates imageUrl for existing products", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: managerEmail,
      password: "ManagerPass123!",
    });

    const imageUrl = "https://example.com/updated-product.png";
    const res = await request(app)
      .put(`/api/products/${imageProductId}`)
      .set("Authorization", `Bearer ${loginRes.body.token}`)
      .send({ imageUrl });

    expect(res.statusCode).toBe(200);
    expect(res.body.product.imageUrl).toBe(imageUrl);
  });

  test("PUT /api/products/:id updates imageUrl from an uploaded product image", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: managerEmail,
      password: "ManagerPass123!",
    });

    const res = await request(app)
      .put(`/api/products/${imageProductId}`)
      .set("Authorization", `Bearer ${loginRes.body.token}`)
      .attach("productImage", Buffer.from("updated fake image bytes"), {
        filename: "updated-product.webp",
        contentType: "image/webp",
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.product.imageUrl).toBe(
      "https://res.cloudinary.com/test-cloud/image/upload/cs308-products/product-test.png"
    );
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
