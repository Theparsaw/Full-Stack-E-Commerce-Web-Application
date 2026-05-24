const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../server");
const Cart = require("../models/Cart");
const User = require("../models/User");
const Product = require("../models/Product");

const createCartId = (suffix) => `test-cart-${suffix}-${Date.now()}`;
const createEmail = (label) => `cart-${label}-${Date.now()}@example.com`;
const primaryProductId = `cart-primary-product-${Date.now()}`;
const mergeProductId = `cart-merge-product-${Date.now()}`;
const secondaryProductId = `cart-secondary-product-${Date.now()}`;
const createdUserIds = [];

const registerCustomer = async (label) => {
  const res = await request(app).post("/api/auth/register").send({
    name: `Cart ${label}`,
    email: createEmail(label),
    password: "Password123!",
  });

  createdUserIds.push(res.body.user.id);
  return res.body.token;
};

beforeAll(async () => {
  await Product.create({
    productId: primaryProductId,
    categoryId: "cart-test",
    name: "Cart Test Product",
    model: "Primary Product",
    serialNumber: `${primaryProductId}-serial`,
    description: "Primary product used for cart endpoint tests",
    quantityInStock: 10,
    price: 1299,
    warrantyStatus: "Test warranty",
    distributorInfo: "Test distributor",
  });

  await Product.create({
    productId: mergeProductId,
    categoryId: "cart-test",
    name: "Cart Test Product",
    model: "Merge Product",
    serialNumber: `${mergeProductId}-serial`,
    description: "Product used for cart merge tests",
    quantityInStock: 10,
    price: 100,
    warrantyStatus: "Test warranty",
    distributorInfo: "Test distributor",
  });

  await Product.create({
    productId: secondaryProductId,
    categoryId: "cart-test",
    name: "Cart Test Product",
    model: "Secondary Product",
    serialNumber: `${secondaryProductId}-serial`,
    description: "Secondary product used for cart total tests",
    quantityInStock: 10,
    price: 50,
    warrantyStatus: "Test warranty",
    distributorInfo: "Test distributor",
  });
});

afterAll(async () => {
  await Cart.deleteMany({ cartId: { $regex: "^test-cart-" } });
  await Product.deleteMany({ productId: { $in: [primaryProductId, mergeProductId, secondaryProductId] } });
  if (createdUserIds.length > 0) {
    await User.deleteMany({ _id: { $in: createdUserIds } });
  }
  await mongoose.connection.close();
});

describe("Cart API Endpoints", () => {
  test("GET /api/cart/:cartId requires authentication", async () => {
    const res = await request(app).get(`/api/cart/${createCartId("unauth")}`);

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe("AUTH_REQUIRED");
  });

  test("GET /api/cart/:cartId returns an empty cart when no cart exists", async () => {
    const cartId = createCartId("empty");
    const token = await registerCustomer("empty");
    const res = await request(app)
      .get(`/api/cart/${cartId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      cartId,
      items: [],
      totalPrice: 0,
      totalItems: 0,
    });
  });

  test("POST /api/cart/:cartId/items adds an item and calculates total price", async () => {
    const cartId = createCartId("add");
    const token = await registerCustomer("add");
    const res = await request(app)
      .post(`/api/cart/${cartId}/items`)
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: primaryProductId, quantity: 2 });

    expect(res.statusCode).toBe(200);
    expect(res.body.cartId).toBe(cartId);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      productId: primaryProductId,
      name: "Primary Product",
      unitPrice: 1299,
      quantity: 2,
    });
    expect(res.body.totalItems).toBe(2);
    expect(res.body.totalPrice).toBe(2598);
  });

  test("GET /api/cart/:cartId falls back to the user's existing cart", async () => {
    const cartId = createCartId("existing");
    const unknownCartId = createCartId("unknown");
    const token = await registerCustomer("fallback");

    await request(app)
      .post(`/api/cart/${cartId}/items`)
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: primaryProductId, quantity: 1 });

    const res = await request(app)
      .get(`/api/cart/${unknownCartId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.cartId).toBe(cartId);
    expect(res.body.totalItems).toBe(1);
    expect(res.body.items[0]).toMatchObject({
      productId: primaryProductId,
      quantity: 1,
    });
  });

  test("POST /api/cart/:cartId/items merges duplicate products and keeps total accurate", async () => {
    const cartId = createCartId("merge");
    const token = await registerCustomer("merge");

    await request(app)
      .post(`/api/cart/${cartId}/items`)
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: mergeProductId, quantity: 2 });

    const res = await request(app)
      .post(`/api/cart/${cartId}/items`)
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: mergeProductId, quantity: 3 });

    expect(res.statusCode).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].quantity).toBe(5);
    expect(res.body.totalItems).toBe(5);
    expect(res.body.totalPrice).toBe(500);
  });

  test("PATCH /api/cart/:cartId/items/:productId updates quantity", async () => {
    const cartId = createCartId("update");
    const token = await registerCustomer("update");

    await request(app)
      .post(`/api/cart/${cartId}/items`)
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: mergeProductId, quantity: 2 });

    await request(app)
      .post(`/api/cart/${cartId}/items`)
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: secondaryProductId, quantity: 1 });

    const res = await request(app)
      .patch(`/api/cart/${cartId}/items/${mergeProductId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ quantity: 4 });

    expect(res.statusCode).toBe(200);
    expect(res.body.totalItems).toBe(5);
    expect(res.body.totalPrice).toBe(450);
    expect(res.body.items.find((item) => item.productId === mergeProductId).quantity).toBe(
      4
    );
  });

  test("DELETE /api/cart/:cartId/items/:productId removes an item", async () => {
    const cartId = createCartId("remove");
    const token = await registerCustomer("remove");

    await request(app)
      .post(`/api/cart/${cartId}/items`)
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: primaryProductId, quantity: 2 });

    await request(app)
      .post(`/api/cart/${cartId}/items`)
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: secondaryProductId, quantity: 1 });

    const res = await request(app)
      .delete(`/api/cart/${cartId}/items/${secondaryProductId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].productId).toBe(primaryProductId);
    expect(res.body.totalItems).toBe(2);
    expect(res.body.totalPrice).toBe(2598);
  });

  test("POST /api/cart/:cartId/items rejects quantities above available stock", async () => {
    const cartId = createCartId("stock-limit");
    const token = await registerCustomer("stock-limit");
    const product = await Product.findOne({ productId: primaryProductId }).lean();
    const requestedQuantity = product.quantityInStock + 1;

    const res = await request(app)
      .post(`/api/cart/${cartId}/items`)
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: primaryProductId, quantity: requestedQuantity });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Requested quantity exceeds available stock");
    expect(res.body.details.availableStock).toBe(product.quantityInStock);
  });
});
