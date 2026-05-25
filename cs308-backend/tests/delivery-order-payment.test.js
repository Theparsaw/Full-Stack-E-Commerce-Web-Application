jest.mock("../models/Order", () => ({
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
  find: jest.fn(),
}));

jest.mock("../models/Delivery", () => ({
  create: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
}));

jest.mock("../models/Product", () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
}));

jest.mock("../models/Payment", () => ({
  create: jest.fn(),
}));

jest.mock("../models/Cart", () => ({
  findOne: jest.fn(),
}));

jest.mock("../models/Invoice", () => ({
  create: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock("../models/User", () => ({
  findById: jest.fn(),
  find: jest.fn(),
}));

jest.mock("../utils/invoiceGenerator", () => ({
  generateInvoicePDF: jest.fn(),
}));

jest.mock("../utils/emailSender", () => ({
  sendInvoiceEmail: jest.fn(),
}));

const Order = require("../models/Order");
const Delivery = require("../models/Delivery");
const Product = require("../models/Product");
const Payment = require("../models/Payment");
const Cart = require("../models/Cart");
const Invoice = require("../models/Invoice");
const User = require("../models/User");
const { generateInvoicePDF } = require("../utils/invoiceGenerator");
const { sendInvoiceEmail } = require("../utils/emailSender");
const mongoose = require("mongoose");

const {
  getOrderForPayment,
  processPayment,
} = require("../controllers/paymentController");
const { cancelMyOrder, getMyOrders } = require("../controllers/orderController");
const {
  getAllDeliveries,
  updateDeliveryStatus,
} = require("../controllers/deliveryController");
const { authorize } = require("../middleware/authMiddleware");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createQuery = (data) => ({
  sort: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(data),
});

const buildOrder = (overrides = {}) => ({
  _id: "order12345678",
  userId: "user-1",
  cartId: "cart-1",
  items: [
    {
      productId: "prod-1",
      name: "Phone",
      unitPrice: 50,
      quantity: 2,
    },
    {
      productId: "prod-2",
      name: "Case",
      unitPrice: 20,
      quantity: 1,
    },
  ],
  totalPrice: 120,
  status: "pending_payment",
  createdAt: new Date("2026-04-20T10:00:00.000Z"),
  updatedAt: new Date("2026-04-20T10:00:00.000Z"),
  paidAt: null,
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

const buildCart = (overrides = {}) => ({
  cartId: "cart-1",
  items: [{ productId: "prod-1", quantity: 2 }],
  totalPrice: 120,
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

describe("payment, delivery, and tracking coverage", () => {
  let consoleErrorSpy;
  let startSessionSpy;

  beforeEach(() => {
    jest.resetAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    startSessionSpy = jest.spyOn(mongoose, "startSession").mockResolvedValue({
      startTransaction: jest.fn(),
      commitTransaction: jest.fn().mockResolvedValue(true),
      abortTransaction: jest.fn().mockResolvedValue(true),
      endSession: jest.fn(),
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    startSessionSpy.mockRestore();
  });

  describe("processPayment", () => {
    test("returns 400 when required payment fields are missing", async () => {
      const req = {
        params: { orderId: "order-1" },
        body: { cardHolder: "Ada Lovelace" },
        user: { id: "user-1" },
      };
      const res = createRes();

      await processPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "All payment fields are required",
      });
    });

    test("returns 400 for an invalid card number", async () => {
      const req = {
        params: { orderId: "order-1" },
        body: {
          cardHolder: "Ada Lovelace",
          cardNumber: "1234 5678",
          expiryMonth: "12",
          expiryYear: "2099",
          cvv: "123",
        },
        user: { id: "user-1" },
      };
      const res = createRes();

      await processPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Card number must be 16 digits",
      });
    });

    test("returns 400 for an invalid cardholder name", async () => {
      const req = {
        params: { orderId: "order-1" },
        body: {
          cardHolder: "1234",
          cardNumber: "4242424242424242",
          expiryMonth: "12",
          expiryYear: "2099",
          cvv: "123",
        },
        user: { id: "user-1" },
      };
      const res = createRes();

      await processPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Cardholder name must contain only letters, spaces, apostrophes, hyphens, or periods",
      });
    });

    test("returns 400 for an expired card", async () => {
      const req = {
        params: { orderId: "order-1" },
        body: {
          cardHolder: "Ada Lovelace",
          cardNumber: "4242424242424242",
          expiryMonth: "1",
          expiryYear: "2020",
          cvv: "123",
        },
        user: { id: "user-1" },
      };
      const res = createRes();

      await processPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Card expiry date is invalid or expired",
      });
    });

    test("returns 400 for an invalid CVV", async () => {
      const req = {
        params: { orderId: "order-1" },
        body: {
          cardHolder: "Ada Lovelace",
          cardNumber: "4242424242424242",
          expiryMonth: "12",
          expiryYear: "2099",
          cvv: "12",
        },
        user: { id: "user-1" },
      };
      const res = createRes();

      await processPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "CVV must be 3 or 4 digits",
      });
    });

    test("returns 403 when a customer tries to pay another user's order", async () => {
      const req = {
        params: { orderId: "order-1" },
        body: {
          cardHolder: "Ada Lovelace",
          cardNumber: "4242424242424242",
          expiryMonth: "12",
          expiryYear: "2099",
          cvv: "123",
        },
        user: { id: "user-1" },
      };
      const res = createRes();

      Order.findById.mockResolvedValue(buildOrder({ userId: "user-2" }));

      await processPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Access denied" });
      expect(Payment.create).not.toHaveBeenCalled();
    });

    test("marks the order as payment_failed when stock is insufficient", async () => {
      const req = {
        params: { orderId: "order-1" },
        body: {
          cardHolder: "Ada Lovelace",
          cardNumber: "4242424242424242",
          expiryMonth: "12",
          expiryYear: "2099",
          cvv: "123",
        },
        user: { id: "user-1" },
      };
      const res = createRes();
      const order = buildOrder();

      Order.findById.mockResolvedValue(order);
      Product.findOne.mockResolvedValueOnce({
        productId: "prod-1",
        quantityInStock: 1,
      });

      await processPayment(req, res);

      expect(order.status).toBe("payment_failed");
      expect(order.save).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        valid: false,
        message: "Not enough stock for Phone",
        productId: "prod-1",
        availableStock: 1,
      });
      expect(Payment.create).not.toHaveBeenCalled();
    });

    test("processes a successful payment, reduces stock, clears cart, and creates delivery", async () => {
      const req = {
        params: { orderId: "order-1" },
        body: {
          cardHolder: "Ada Lovelace",
          cardNumber: "4242 4242 4242 4242",
          expiryMonth: "12",
          expiryYear: "2099",
          cvv: "123",
        },
        user: { id: "user-1" },
      };
      const res = createRes();
      const order = buildOrder();
      const cart = buildCart({
        items: [...order.items],
      });
      const delivery = {
        _id: "delivery-1",
        orderId: order._id,
        userId: order.userId,
        items: order.items,
        totalPrice: order.totalPrice,
        address: "Default address",
        status: "processing",
      };
      const payment = {
        _id: "payment-1",
        status: "success",
      };

      Order.findById.mockResolvedValue(order);
      Product.findOne
        .mockResolvedValueOnce({ productId: "prod-1", quantityInStock: 5 })
        .mockResolvedValueOnce({ productId: "prod-2", quantityInStock: 8 });
      Payment.create.mockResolvedValue(payment);
      Product.findOneAndUpdate
        .mockResolvedValueOnce({ productId: "prod-1", quantityInStock: 3 })
        .mockResolvedValueOnce({ productId: "prod-2", quantityInStock: 7 });
      Cart.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(cart),
      });
      Delivery.create.mockResolvedValue([delivery]);
      User.findById.mockResolvedValue({
        _id: "user-1",
        email: "ada@example.com",
        name: "Ada Lovelace",
      });
      generateInvoicePDF.mockResolvedValue(Buffer.from("pdf"));
      sendInvoiceEmail.mockResolvedValue(true);
      Invoice.create.mockResolvedValue({
        _id: "invoice-1",
        status: "emailed",
      });

      await processPayment(req, res);

      expect(Payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: order._id,
          userId: "user-1",
          amount: 120,
          status: "success",
          cardLast4: "4242",
        }),
      );
      expect(Product.findOneAndUpdate).toHaveBeenNthCalledWith(
        1,
        { productId: "prod-1", quantityInStock: { $gte: 2 } },
        { $inc: { quantityInStock: -2 } },
        expect.objectContaining({ returnDocument: "after" }),
      );
      expect(Product.findOneAndUpdate).toHaveBeenNthCalledWith(
        2,
        { productId: "prod-2", quantityInStock: { $gte: 1 } },
        { $inc: { quantityInStock: -1 } },
        expect.objectContaining({ returnDocument: "after" }),
      );
      expect(order.status).toBe("paid");
      expect(order.paidAt).toEqual(expect.any(Date));
      expect(order.save).toHaveBeenCalled();
      expect(cart.items).toEqual([]);
      expect(cart.totalPrice).toBe(0);
      expect(cart.save).toHaveBeenCalled();
      expect(Delivery.create).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            orderId: order._id,
            userId: order.userId,
            status: "processing",
            address: "Default address",
          }),
        ],
        expect.objectContaining({ session: expect.any(Object) }),
      );
      expect(generateInvoicePDF).toHaveBeenCalledWith(
        order,
        expect.objectContaining({ email: "ada@example.com" }),
      );
      expect(sendInvoiceEmail).toHaveBeenCalledWith(
        "ada@example.com",
        expect.stringMatching(/^INV-/),
        expect.any(Buffer),
      );
      expect(Invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: order._id,
          userId: order.userId,
          amount: order.totalPrice,
          status: "emailed",
        }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Payment completed successfully",
          paymentStatus: "success",
          delivery,
          order: expect.objectContaining({
            id: order._id,
            status: "paid",
          }),
        }),
      );
    });

    test("returns 500 and refunds payment status when finalizing delivery fails", async () => {
      const req = {
        params: { orderId: "order-1" },
        body: {
          cardHolder: "Ada Lovelace",
          cardNumber: "4242424242424242",
          expiryMonth: "12",
          expiryYear: "2099",
          cvv: "123",
        },
        user: { id: "user-1" },
      };
      const res = createRes();
      const order = buildOrder();
      const cart = buildCart({
        items: [...order.items],
      });
      const payment = {
        _id: "payment-1",
        status: "success",
        save: jest.fn().mockResolvedValue(true),
      };
      const failedOrder = {
        ...order,
        status: "payment_failed",
      };

      Order.findById.mockResolvedValue(order);
      Order.findOneAndUpdate.mockResolvedValue(failedOrder);
      Product.findOne
        .mockResolvedValueOnce({ productId: "prod-1", quantityInStock: 5 })
        .mockResolvedValueOnce({ productId: "prod-2", quantityInStock: 8 });
      Payment.create.mockResolvedValue(payment);
      Product.findOneAndUpdate
        .mockResolvedValueOnce({ productId: "prod-1", quantityInStock: 3 })
        .mockResolvedValueOnce({ productId: "prod-2", quantityInStock: 7 });
      Cart.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(cart),
      });
      Delivery.create.mockRejectedValue(new Error("insert failed"));

      await processPayment(req, res);

      expect(Order.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: order._id, status: { $ne: "paid" } },
        { $set: { status: "payment_failed" } },
        { returnDocument: "after" },
      );
      expect(Product.findOneAndUpdate).toHaveBeenCalledTimes(2);
      expect(cart.save).toHaveBeenCalled();
      expect(payment.status).toBe("refunded");
      expect(payment.save).toHaveBeenCalled();
      expect(sendInvoiceEmail).not.toHaveBeenCalled();
      expect(Invoice.create).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "A system error occurred while finalizing your order. Your payment has been refunded.",
        paymentStatus: "refunded",
        order: expect.objectContaining({
          id: order._id,
          status: "payment_failed",
        }),
        error: "insert failed",
      });
    });

    test("refunds payment and preserves paid order when stock finalization loses a race", async () => {
      const req = {
        params: { orderId: "order-1" },
        body: {
          cardHolder: "Ada Lovelace",
          cardNumber: "4242424242424242",
          expiryMonth: "12",
          expiryYear: "2099",
          cvv: "123",
        },
        user: { id: "user-1" },
      };
      const res = createRes();
      const order = buildOrder();
      const paidOrder = {
        ...order,
        status: "paid",
        paidAt: new Date("2026-04-23T10:00:00.000Z"),
      };
      const payment = {
        _id: "payment-1",
        status: "success",
        save: jest.fn().mockResolvedValue(true),
      };

      Order.findById
        .mockResolvedValueOnce(order)
        .mockResolvedValueOnce(paidOrder);
      Order.findOneAndUpdate.mockResolvedValue(null);
      Product.findOne
        .mockResolvedValueOnce({ productId: "prod-1", quantityInStock: 5 })
        .mockResolvedValueOnce({ productId: "prod-2", quantityInStock: 8 });
      Payment.create.mockResolvedValue(payment);
      Product.findOneAndUpdate.mockResolvedValueOnce(null);

      await processPayment(req, res);

      expect(Product.findOneAndUpdate).toHaveBeenCalledWith(
        { productId: "prod-1", quantityInStock: { $gte: 2 } },
        { $inc: { quantityInStock: -2 } },
        expect.objectContaining({ returnDocument: "after" }),
      );
      expect(Order.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: order._id, status: { $ne: "paid" } },
        { $set: { status: "payment_failed" } },
        { returnDocument: "after" },
      );
      expect(payment.status).toBe("refunded");
      expect(payment.message).toBe("Payment refunded due to stock concurrency error");
      expect(payment.save).toHaveBeenCalled();
      expect(Delivery.create).not.toHaveBeenCalled();
      expect(Invoice.create).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Stock changed while finalizing your order. Your payment has been refunded.",
        paymentStatus: "refunded",
        order: expect.objectContaining({
          id: order._id,
          status: "paid",
        }),
        error: "Concurrency Error: Not enough stock remaining for Phone.",
      });
    });

    test("records a declined payment without reducing stock or creating delivery", async () => {
      const req = {
        params: { orderId: "order-1" },
        body: {
          cardHolder: "Ada Lovelace",
          cardNumber: "4242424242424241",
          expiryMonth: "12",
          expiryYear: "2099",
          cvv: "123",
        },
        user: { id: "user-1" },
      };
      const res = createRes();
      const order = buildOrder();
      const payment = {
        _id: "payment-1",
        orderId: order._id,
        amount: order.totalPrice,
        status: "failed",
        cardLast4: "4241",
        transactionId: "TXN-1",
        createdAt: new Date("2026-04-23T10:00:00.000Z"),
      };

      Order.findById.mockResolvedValue(order);
      Product.findOne
        .mockResolvedValueOnce({ productId: "prod-1", quantityInStock: 5 })
        .mockResolvedValueOnce({ productId: "prod-2", quantityInStock: 8 });
      Payment.create.mockResolvedValue(payment);

      await processPayment(req, res);

      expect(order.status).toBe("payment_failed");
      expect(order.save).toHaveBeenCalledTimes(1);
      expect(Product.updateOne).not.toHaveBeenCalled();
      expect(Delivery.create).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Use a card number ending in an even digit",
          paymentStatus: "failed",
          payment: expect.objectContaining({
            id: "payment-1",
            status: "failed",
            cardLast4: "4241",
          }),
          order: expect.objectContaining({
            id: order._id,
            status: "payment_failed",
          }),
        }),
      );
    });
  });

  describe("getOrderForPayment", () => {
    test("returns 200 with the serialized order for the owning customer", async () => {
      const req = {
        params: { orderId: "order-1" },
        user: { id: "user-1" },
      };
      const res = createRes();
      const order = buildOrder();

      Order.findById.mockResolvedValue(order);
      Product.findOne
        .mockResolvedValueOnce({ productId: "prod-1", quantityInStock: 5 })
        .mockResolvedValueOnce({ productId: "prod-2", quantityInStock: 8 });

      await getOrderForPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        order: expect.objectContaining({
          id: order._id,
          userId: "user-1",
          status: "pending_payment",
        }),
      });
    });

    test("returns 403 when a customer fetches another user's payment page", async () => {
      const req = {
        params: { orderId: "order-1" },
        user: { id: "user-1" },
      };
      const res = createRes();

      Order.findById.mockResolvedValue(buildOrder({ userId: "user-2" }));

      await getOrderForPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Access denied" });
    });

    test("returns 400 when stock validation fails before payment", async () => {
      const req = {
        params: { orderId: "order-1" },
        user: { id: "user-1" },
      };
      const res = createRes();
      const order = buildOrder();

      Order.findById.mockResolvedValue(order);
      Product.findOne.mockResolvedValueOnce({
        productId: "prod-1",
        quantityInStock: 1,
      });

      await getOrderForPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        valid: false,
        message: "Not enough stock for Phone",
        productId: "prod-1",
        availableStock: 1,
      });
    });
  });

  describe("getMyOrders", () => {
    test("returns tracked paid orders with delivery status from the delivery record", async () => {
      const req = {
        user: { id: "user-1" },
      };
      const res = createRes();
      const paidAt = new Date("2026-04-21T10:00:00.000Z");
      const orders = [
        buildOrder({
          _id: "order12345678",
          status: "paid",
          paidAt,
        }),
      ];
      const deliveries = [
        {
          orderId: "order12345678",
          status: "shipped",
        },
      ];

      Order.find.mockReturnValue(createQuery(orders));
      Delivery.find.mockReturnValue(createQuery(deliveries));

      await getMyOrders(req, res);

      expect(Order.find).toHaveBeenCalledWith({
        userId: "user-1",
        status: { $in: ["paid", "cancelled"] },
      });
      expect(Delivery.find).toHaveBeenCalledWith({
        orderId: { $in: ["order12345678"] },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        orders: [
          expect.objectContaining({
            id: "order12345678",
            deliveryStatus: "shipped",
            trackingNumber: "TRK-12345678",
            timeline: expect.arrayContaining([
              expect.objectContaining({ key: "processing", state: "completed" }),
              expect.objectContaining({
                key: "out_for_delivery",
                label: "In transit",
                state: "current",
              }),
            ]),
          }),
        ],
      });
    });

    test("defaults delivery status to processing when no delivery exists yet", async () => {
      const req = {
        user: { id: "user-1" },
      };
      const res = createRes();
      const orders = [
        buildOrder({
          _id: "orderABCDEFGH",
          status: "paid",
          paidAt: new Date("2026-04-21T10:00:00.000Z"),
        }),
      ];

      Order.find.mockReturnValue(createQuery(orders));
      Delivery.find.mockReturnValue(createQuery([]));

      await getMyOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].orders[0]).toEqual(
        expect.objectContaining({
          id: "orderABCDEFGH",
          deliveryStatus: "processing",
          trackingNumber: "TRK-ABCDEFGH",
        }),
      );
    });

    test("returns 500 when fetching orders fails", async () => {
      const req = {
        user: { id: "user-1" },
      };
      const res = createRes();

      Order.find.mockImplementation(() => {
        throw new Error("query failed");
      });

      await getMyOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Failed to fetch orders",
        error: "query failed",
      });
    });
  });

  describe("cancelMyOrder", () => {
    test("cancels an owned processing order and restores stock", async () => {
      const req = {
        params: { orderId: "order12345678" },
        user: { id: "user-1" },
      };
      const res = createRes();
      const order = buildOrder({
        _id: "order12345678",
        status: "paid",
        paidAt: new Date("2026-04-21T10:00:00.000Z"),
      });
      order.toObject = jest.fn(() => ({
        _id: order._id,
        userId: order.userId,
        cartId: order.cartId,
        items: order.items,
        totalPrice: order.totalPrice,
        status: order.status,
        paidAt: order.paidAt,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      }));
      const delivery = {
        orderId: "order12345678",
        status: "processing",
        save: jest.fn().mockResolvedValue(true),
      };

      Order.findById.mockResolvedValue(order);
      Order.findOneAndUpdate.mockImplementation(async () => {
        order.status = "cancelled";
        return order;
      });
      Delivery.findOne.mockResolvedValue(delivery);
      Product.findOneAndUpdate.mockResolvedValue({ productId: "restored-product" });

      await cancelMyOrder(req, res);

      expect(Order.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: "order12345678",
          userId: "user-1",
          status: "paid",
        },
        { status: "cancelled" },
        expect.objectContaining({
          returnDocument: "after",
        }),
      );
      expect(Product.findOneAndUpdate).toHaveBeenNthCalledWith(
        1,
        { productId: "prod-1" },
        { $inc: { quantityInStock: 2 } },
        expect.objectContaining({
          returnDocument: "after",
        }),
      );
      expect(Product.findOneAndUpdate).toHaveBeenNthCalledWith(
        2,
        { productId: "prod-2" },
        { $inc: { quantityInStock: 1 } },
        expect.objectContaining({
          returnDocument: "after",
        }),
      );
      expect(order.status).toBe("cancelled");
      expect(order.save).not.toHaveBeenCalled();
      expect(delivery.status).toBe("cancelled");
      expect(delivery.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Order cancelled successfully",
        order: expect.objectContaining({
          id: "order12345678",
          status: "cancelled",
          deliveryStatus: "cancelled",
        }),
      });
    });

    test("rejects cancellation for orders owned by another user", async () => {
      const req = {
        params: { orderId: "order12345678" },
        user: { id: "user-2" },
      };
      const res = createRes();
      const order = buildOrder({
        _id: "order12345678",
        status: "paid",
        userId: "user-1",
      });

      Order.findById.mockResolvedValue(order);

      await cancelMyOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Access denied" });
      expect(Product.findOneAndUpdate).not.toHaveBeenCalled();
      expect(order.save).not.toHaveBeenCalled();
    });

    test("rejects cancellation after delivery has moved forward", async () => {
      const req = {
        params: { orderId: "order12345678" },
        user: { id: "user-1" },
      };
      const res = createRes();
      const order = buildOrder({
        _id: "order12345678",
        status: "paid",
      });

      Order.findById.mockResolvedValue(order);
      Delivery.findOne.mockResolvedValue({
        orderId: "order12345678",
        status: "out_for_delivery",
      });

      await cancelMyOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Orders cannot be cancelled after shipment or delivery",
      });
      expect(Product.findOneAndUpdate).not.toHaveBeenCalled();
      expect(order.save).not.toHaveBeenCalled();
    });
  });

  describe("deliveryController", () => {
    test("getAllDeliveries enriches deliveries with customer data", async () => {
      const req = {};
      const res = createRes();
      const deliveries = [
        {
          _id: "delivery-1",
          orderId: "order-1",
          userId: "user-1",
          items: [{ productId: "prod-1", quantity: 1 }],
          totalPrice: 50,
          address: "Main Street",
          status: "processing",
          createdAt: new Date("2026-04-22T10:00:00.000Z"),
          updatedAt: new Date("2026-04-22T10:00:00.000Z"),
        },
      ];
      const users = [
        {
          _id: "user-1",
          name: "Ada Lovelace",
          email: "ada@example.com",
        },
      ];

      Delivery.find.mockReturnValue(createQuery(deliveries));
      User.find.mockReturnValue(createQuery(users));
      Invoice.find.mockReturnValue(createQuery([]));

      await getAllDeliveries(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: [
          expect.objectContaining({
            id: "delivery-1",
            customerName: "Ada Lovelace",
            customerEmail: "ada@example.com",
            status: "processing",
          }),
        ],
      });
    });

    test("updateDeliveryStatus rejects missing status values", async () => {
      const req = {
        params: { id: "delivery-1" },
        body: { status: "   " },
      };
      const res = createRes();
      const next = jest.fn();

      await updateDeliveryStatus(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "status is required",
          statusCode: 400,
          code: "VALIDATION_ERROR",
        }),
      );
    });

    test("updateDeliveryStatus rejects invalid delivery status transitions", async () => {
      const req = {
        params: { id: "delivery-1" },
        body: { status: "pending_payment" },
      };
      const res = createRes();
      const next = jest.fn();

      await updateDeliveryStatus(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          code: "INVALID_DELIVERY_STATUS",
        }),
      );
      expect(Delivery.findById).not.toHaveBeenCalled();
    });

    test("updateDeliveryStatus saves an allowed status and returns serialized delivery data", async () => {
      const req = {
        params: { id: "delivery-1" },
        body: { status: "out_for_delivery" },
      };
      const res = createRes();
      const next = jest.fn();
      const delivery = {
        _id: "delivery-1",
        orderId: "order-1",
        userId: "user-1",
        items: [{ productId: "prod-1", quantity: 1 }],
        totalPrice: 50,
        address: "Main Street",
        status: "processing",
        createdAt: new Date("2026-04-22T10:00:00.000Z"),
        updatedAt: new Date("2026-04-22T10:00:00.000Z"),
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockImplementation(function toObject() {
          return {
            _id: this._id,
            orderId: this.orderId,
            userId: this.userId,
            items: this.items,
            totalPrice: this.totalPrice,
            address: this.address,
            status: this.status,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
          };
        }),
      };

      Delivery.findById.mockResolvedValue(delivery);
      User.findById.mockReturnValue(
        createQuery({
          _id: "user-1",
          name: "Ada Lovelace",
          email: "ada@example.com",
        }),
      );
      Invoice.findOne.mockReturnValue(createQuery(null));

      await updateDeliveryStatus(req, res, next);

      expect(delivery.status).toBe("out_for_delivery");
      expect(delivery.save).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Delivery status updated successfully",
        data: expect.objectContaining({
          id: "delivery-1",
          customerName: "Ada Lovelace",
          customerEmail: "ada@example.com",
          status: "out_for_delivery",
        }),
      });
    });
  });

  describe("delivery permissions", () => {
    test("authorize blocks non-product-manager users from delivery updates", () => {
      const req = {
        user: { id: "user-1", role: "customer" },
      };
      const res = createRes();
      const next = jest.fn();

      authorize("product_manager")(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "You are not allowed to access this resource",
          statusCode: 403,
          code: "FORBIDDEN",
        }),
      );
    });

    test("authorize allows product managers to update delivery status", () => {
      const req = {
        user: { id: "manager-1", role: "product_manager" },
      };
      const res = createRes();
      const next = jest.fn();

      authorize("product_manager")(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });
  });
});
