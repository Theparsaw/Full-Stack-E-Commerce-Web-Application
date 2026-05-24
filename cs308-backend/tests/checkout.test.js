jest.mock("../utils/emailSender", () => ({
  sendInvoiceEmail: jest.fn().mockResolvedValue(true),
}));

const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../server");
const Cart = require("../models/Cart");
const Delivery = require("../models/Delivery");
const Invoice = require("../models/Invoice");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const Product = require("../models/Product");
const User = require("../models/User");

const createEmail = (label) => `checkout-${label}-${Date.now()}@example.com`;
const createCartId = (label) => `checkout-test-cart-${label}-${Date.now()}`;
const createdUserIds = [];
const createdCartIds = [];
const createdOrderIds = [];
const createdProductIds = [];

let customerToken;
let otherCustomerToken;
let customerId;
let testCartId;
let productId;

const validCard = {
  cardHolder: "Checkout Customer",
  cardNumber: "4242424242424242",
  expiryMonth: "12",
  expiryYear: "2099",
  cvv: "123",
};

const createCart = async ({ cartId = createCartId("owned"), userId = customerId, quantity = 1 } = {}) => {
  createdCartIds.push(cartId);

  return Cart.create({
    cartId,
    userId: new mongoose.Types.ObjectId(userId),
    items: [
      {
        productId,
        name: "Checkout Flow Product",
        unitPrice: 100,
        quantity,
        imageUrl: "",
      },
    ],
    totalPrice: 100 * quantity,
  });
};

beforeAll(async () => {
  const customerRes = await request(app).post("/api/auth/register").send({
    name: "Checkout Test Customer",
    email: createEmail("customer"),
    password: "Password123!",
  });
  customerToken = customerRes.body.token;
  customerId = customerRes.body.user.id;
  createdUserIds.push(customerId);

  const otherCustomerRes = await request(app).post("/api/auth/register").send({
    name: "Checkout Other Customer",
    email: createEmail("other"),
    password: "Password123!",
  });
  otherCustomerToken = otherCustomerRes.body.token;
  createdUserIds.push(otherCustomerRes.body.user.id);

  productId = `checkout-flow-product-${Date.now()}`;
  createdProductIds.push(productId);

  await Product.create({
    productId,
    categoryId: "checkout-test",
    name: "Checkout Test Product",
    model: "Checkout Flow Product",
    serialNumber: `${productId}-serial`,
    description: "Product used for checkout flow tests",
    quantityInStock: 10,
    price: 100,
    warrantyStatus: "Test warranty",
    distributorInfo: "Test distributor",
  });

  testCartId = createCartId("base");
  await createCart({ cartId: testCartId });
});

afterAll(async () => {
  await Payment.deleteMany({ orderId: { $in: createdOrderIds } });
  await Delivery.deleteMany({ orderId: { $in: createdOrderIds } });
  await Invoice.deleteMany({ orderId: { $in: createdOrderIds } });
  await Order.deleteMany({ _id: { $in: createdOrderIds } });
  await Cart.deleteMany({ cartId: { $in: createdCartIds } });
  await Product.deleteMany({ productId: { $in: createdProductIds } });
  await User.deleteMany({ _id: { $in: createdUserIds } });
  await mongoose.connection.close();
});

describe("Checkout API", () => {
  test("GET /api/checkout/:cartId requires auth", async () => {
    const res = await request(app).get(`/api/checkout/${testCartId}`);
    expect(res.statusCode).toBe(401);
  });

  test("GET /api/checkout/:cartId returns cart for the owning customer", async () => {
    const res = await request(app)
      .get(`/api/checkout/${testCartId}`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      cartId: testCartId,
      totalPrice: 100,
      totalItems: 1,
    });
    expect(res.body.items).toHaveLength(1);
  });

  test("checkout routes reject access to another customer's cart", async () => {
    const getRes = await request(app)
      .get(`/api/checkout/${testCartId}`)
      .set("Authorization", `Bearer ${otherCustomerToken}`);
    const validateRes = await request(app)
      .post(`/api/checkout/${testCartId}/validate`)
      .set("Authorization", `Bearer ${otherCustomerToken}`);
    const orderRes = await request(app)
      .post(`/api/checkout/${testCartId}/order`)
      .set("Authorization", `Bearer ${otherCustomerToken}`);

    expect(getRes.statusCode).toBe(403);
    expect(validateRes.statusCode).toBe(403);
    expect(orderRes.statusCode).toBe(403);
  });

  test("GET /api/checkout/:cartId returns 404 for non-existent cart", async () => {
    const res = await request(app)
      .get("/api/checkout/non-existent-cart-id")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.statusCode).toBe(404);
  });

  test("POST /api/checkout/:cartId/validate requires auth", async () => {
    const res = await request(app).post(`/api/checkout/${testCartId}/validate`);
    expect(res.statusCode).toBe(401);
  });

  test("POST /api/checkout/:cartId/validate succeeds for a valid cart", async () => {
    const res = await request(app)
      .post(`/api/checkout/${testCartId}/validate`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      message: "Checkout validation successful",
      valid: true,
    });
  });

  test("POST /api/checkout/:cartId/order requires auth", async () => {
    const res = await request(app).post(`/api/checkout/${testCartId}/order`);
    expect(res.statusCode).toBe(401);
  });

  test("POST /api/checkout/:cartId/order creates a pending payment order without mutating cart or stock", async () => {
    const cartId = createCartId("order");
    await createCart({ cartId, quantity: 2 });

    const res = await request(app)
      .post(`/api/checkout/${cartId}/order`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.statusCode).toBe(201);
    createdOrderIds.push(res.body.order.id);
    expect(res.body.order).toMatchObject({
      cartId,
      totalPrice: 200,
      status: "pending_payment",
    });

    const cart = await Cart.findOne({ cartId }).lean();
    const product = await Product.findOne({ productId }).lean();

    expect(cart.items).toHaveLength(1);
    expect(cart.totalPrice).toBe(200);
    expect(product.quantityInStock).toBe(10);
  });

  test("old cart checkout route is intentionally unavailable", async () => {
    const res = await request(app)
      .post(`/api/cart/${testCartId}/checkout`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ paymentMethod: { cardNumber: "4242424242424242" } });

    expect(res.statusCode).toBe(404);
  });

  test("payment completes the final flow by clearing cart, reducing stock, and creating payment, delivery, and invoice records", async () => {
    const cartId = createCartId("payment");
    await createCart({ cartId, quantity: 3 });

    const createOrderRes = await request(app)
      .post(`/api/checkout/${cartId}/order`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(createOrderRes.statusCode).toBe(201);
    const orderId = createOrderRes.body.order.id;
    createdOrderIds.push(orderId);

    const paymentRes = await request(app)
      .post(`/api/payments/${orderId}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send(validCard);

    expect(paymentRes.statusCode).toBe(200);
    expect(paymentRes.body).toMatchObject({
      success: true,
      paymentStatus: "success",
      order: {
        id: orderId,
        status: "paid",
      },
      delivery: {
        orderId,
        status: "processing",
      },
    });

    const [cart, product, order, payment, delivery, invoice] = await Promise.all([
      Cart.findOne({ cartId }).lean(),
      Product.findOne({ productId }).lean(),
      Order.findById(orderId).lean(),
      Payment.findOne({ orderId }).lean(),
      Delivery.findOne({ orderId }).lean(),
      Invoice.findOne({ orderId }).lean(),
    ]);

    expect(cart.items).toEqual([]);
    expect(cart.totalPrice).toBe(0);
    expect(product.quantityInStock).toBe(7);
    expect(order.status).toBe("paid");
    expect(order.paidAt).toBeTruthy();
    expect(payment.status).toBe("success");
    expect(delivery.status).toBe("processing");
    expect(invoice).toMatchObject({
      orderId,
      userId: customerId,
      amount: 300,
      status: "emailed",
    });
  }, 15000);
});
