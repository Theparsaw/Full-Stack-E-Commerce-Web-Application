const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const app = require("../server");
const User = require("../models/User");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const Order = require("../models/Order");
const { getJwtSecret } = require("../utils/jwt");

const createdUserIds = [];
const createdProductIds = [];
const createdCartIds = [];
const createdOrderIds = [];

const createEmail = (label) => `security-${label}-${Date.now()}@example.com`;
const createCartId = (label) => `security-cart-${label}-${Date.now()}`;

const registerCustomer = async (label, extra = {}) => {
  const response = await request(app).post("/api/auth/register").send({
    name: `${label} User`,
    email: createEmail(label),
    password: "Password123!",
    ...extra,
  });

  createdUserIds.push(response.body.user.id);
  return response;
};

beforeAll(async () => {
  const password = await bcrypt.hash("ManagerPass123!", 10);
  const manager = await User.create({
    name: "Security Manager",
    email: createEmail("manager"),
    password,
    role: "product_manager",
  });
  createdUserIds.push(manager._id.toString());
});

afterAll(async () => {
  if (createdProductIds.length > 0) {
    await Product.deleteMany({ productId: { $in: createdProductIds } });
  }
  if (createdCartIds.length > 0) {
    await Cart.deleteMany({ cartId: { $in: createdCartIds } });
  }
  if (createdOrderIds.length > 0) {
    await Order.deleteMany({ _id: { $in: createdOrderIds } });
  }
  if (createdUserIds.length > 0) {
    await User.deleteMany({ _id: { $in: createdUserIds } });
  }
  await mongoose.connection.close();
});

describe("Security and end-to-end integration", () => {
  test("register encrypts sensitive fields at rest and does not expose them in responses", async () => {
    const registerRes = await registerCustomer("encrypted", {
      taxId: "1234567890",
      address: "742 Evergreen Terrace",
    });

    expect(registerRes.statusCode).toBe(201);
    expect(registerRes.body.user.taxId).toBeUndefined();
    expect(registerRes.body.user.address).toBeUndefined();

    const storedUser = await User.collection.findOne({ _id: new mongoose.Types.ObjectId(registerRes.body.user.id) });
    expect(storedUser.taxId).not.toBe("1234567890");
    expect(storedUser.address).not.toBe("742 Evergreen Terrace");
  });

  test("expired tokens are rejected explicitly", async () => {
    const registerRes = await registerCustomer("expired");
    const expiredToken = jwt.sign(
      { id: registerRes.body.user.id, role: "customer" },
      getJwtSecret(),
      { expiresIn: -10 }
    );

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe("TOKEN_EXPIRED");
    expect(res.body.message).toBe("Token has expired");
  });

  test("payment failures are handled gracefully without mutating stock", async () => {
    const registerRes = await registerCustomer("payment-fail");
    const token = registerRes.body.token;
    const cartId = createCartId("payment-fail");
    const productId = `payment-fail-product-${Date.now()}`;
    createdCartIds.push(cartId);
    createdProductIds.push(productId);

    await Product.create({
      productId,
      categoryId: "security-test",
      name: "Payment Failure Product",
      model: "Payment Failure Stock",
      serialNumber: `${productId}-serial`,
      description: "Product used to validate declined payment stock behavior",
      quantityInStock: 4,
      price: 100,
      warrantyStatus: "Test warranty",
      distributorInfo: "Test distributor",
    });

    await request(app)
      .post(`/api/cart/${cartId}/items`)
      .set("Authorization", `Bearer ${token}`)
      .send({ productId, quantity: 1 });

    const stockBefore = await Product.findOne({ productId }).lean();

    const createOrderRes = await request(app)
      .post(`/api/checkout/${cartId}/order`)
      .set("Authorization", `Bearer ${token}`);

    expect(createOrderRes.statusCode).toBe(201);
    createdOrderIds.push(createOrderRes.body.order.id);

    const paymentRes = await request(app)
      .post(`/api/payments/${createOrderRes.body.order.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        cardHolder: "Failure Case",
        cardNumber: "4111111111110001",
        expiryMonth: "12",
        expiryYear: "2030",
        cvv: "123",
      });

    expect(paymentRes.statusCode).toBe(200);
    expect(paymentRes.body.success).toBe(false);
    expect(paymentRes.body.paymentStatus).toBe("failed");

    const stockAfter = await Product.findOne({ productId }).lean();
    const cartAfter = await Cart.findOne({ cartId }).lean();
    expect(stockAfter.quantityInStock).toBe(stockBefore.quantityInStock);
    expect(cartAfter.items).toHaveLength(1);
  });

  test("payment page blocks access when stock becomes unavailable before payment", async () => {
    const registerRes = await registerCustomer("payment-stock-check");
    const token = registerRes.body.token;
    const cartId = createCartId("payment-stock-check");
    createdCartIds.push(cartId);

    const createProductRes = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${jwt.sign({ id: createdUserIds[0], role: "product_manager" }, getJwtSecret(), { expiresIn: "1h" })}`)
      .send({
        productId: `stock-check-${Date.now()}`,
        categoryId: "cat-stock-check",
        name: "Stock Check Product",
        model: "Stock Guard",
        serialNumber: `STOCK-CHECK-${Date.now()}`,
        description: "Product used to validate payment page stock checks",
        quantityInStock: 1,
        price: 120,
        warrantyStatus: "1 year",
        distributorInfo: "Integration Distributor",
      });

    expect(createProductRes.statusCode).toBe(201);
    createdProductIds.push(createProductRes.body.product.productId);

    const addToCartRes = await request(app)
      .post(`/api/cart/${cartId}/items`)
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: createProductRes.body.product.productId, quantity: 1 });

    expect(addToCartRes.statusCode).toBe(200);

    const createOrderRes = await request(app)
      .post(`/api/checkout/${cartId}/order`)
      .set("Authorization", `Bearer ${token}`);

    expect(createOrderRes.statusCode).toBe(201);
    createdOrderIds.push(createOrderRes.body.order.id);

    await Product.updateOne(
      { productId: createProductRes.body.product.productId },
      { $set: { quantityInStock: 0 } }
    );

    const paymentPageRes = await request(app)
      .get(`/api/payments/order/${createOrderRes.body.order.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(paymentPageRes.statusCode).toBe(400);
    expect(paymentPageRes.body.message).toBe("Not enough stock for Stock Guard");
    expect(paymentPageRes.body.availableStock).toBe(0);
  });

  test("authorized full flow works end-to-end", async () => {
    const managerLoginRes = await request(app).post("/api/auth/login").send({
      email: (await User.findById(createdUserIds[0]).lean()).email,
      password: "ManagerPass123!",
    });

    const createProductRes = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${managerLoginRes.body.token}`)
      .send({
        productId: `itest-${Date.now()}`,
        categoryId: "cat-itest",
        name: "Integration",
        model: "Secure Flow",
        serialNumber: `ITEST-${Date.now()}`,
        description: "Product used to validate secure checkout end to end",
        quantityInStock: 5,
        price: 250,
        warrantyStatus: "2 years",
        distributorInfo: "Integration Distributor",
      });

    expect(createProductRes.statusCode).toBe(201);
    createdProductIds.push(createProductRes.body.product.productId);

    const customerRes = await registerCustomer("full-flow");
    const token = customerRes.body.token;
    const cartId = createCartId("full-flow");
    createdCartIds.push(cartId);

    const addToCartRes = await request(app)
      .post(`/api/cart/${cartId}/items`)
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: createProductRes.body.product.productId, quantity: 2 });

    expect(addToCartRes.statusCode).toBe(200);
    expect(addToCartRes.body.totalPrice).toBe(500);

    const createOrderRes = await request(app)
      .post(`/api/checkout/${cartId}/order`)
      .set("Authorization", `Bearer ${token}`);

    expect(createOrderRes.statusCode).toBe(201);
    createdOrderIds.push(createOrderRes.body.order.id);

    const paymentRes = await request(app)
      .post(`/api/payments/${createOrderRes.body.order.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        cardHolder: "Happy Path",
        cardNumber: "4242424242424242",
        expiryMonth: "12",
        expiryYear: "2030",
        cvv: "123",
      });

    expect(paymentRes.statusCode).toBe(200);
    expect(paymentRes.body.message).toBe("Payment completed successfully");

    const productAfterCheckout = await Product.findOne({
      productId: createProductRes.body.product.productId,
    }).lean();
    const cartAfterCheckout = await Cart.findOne({ cartId }).lean();

    expect(productAfterCheckout.quantityInStock).toBe(3);
    expect(cartAfterCheckout.items).toEqual([]);
    expect(cartAfterCheckout.totalPrice).toBe(0);
  }, 15000);
});
