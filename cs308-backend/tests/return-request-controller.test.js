jest.mock("../models/Delivery", () => ({
  findOne: jest.fn(),
}));

jest.mock("../models/Order", () => ({
  findOne: jest.fn(),
}));

jest.mock("../models/ReturnRequest", () => ({
  create: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
}));

const Delivery = require("../models/Delivery");
const Order = require("../models/Order");
const ReturnRequest = require("../models/ReturnRequest");
const {
  createReturnRequest,
  getMyReturnRequests,
} = require("../controllers/returnRequestController");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createQuery = (data) => ({
  sort: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(data),
});

const buildOrder = (overrides = {}) => ({
  _id: "order-1",
  userId: "user-1",
  status: "paid",
  items: [
    { productId: "p001", name: "Keyboard", unitPrice: 80, quantity: 1 },
    { productId: "p002", name: "Mouse", unitPrice: 40, quantity: 2 },
  ],
  ...overrides,
});

describe("returnRequestController", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    ReturnRequest.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
  });

  test("getMyReturnRequests returns requests for the authenticated customer", async () => {
    const requests = [
      {
        _id: "return-1",
        orderId: "order-1",
        items: [{ productId: "p001", name: "Keyboard", unitPrice: 80, quantity: 1 }],
        reason: "Damaged",
        photoUrls: ["/uploads/return-photos/return-1.jpg"],
        refundAmount: 80,
        status: "pending",
        resolvedAt: null,
        createdAt: new Date("2026-04-20T10:00:00.000Z"),
        updatedAt: new Date("2026-04-20T10:00:00.000Z"),
      },
    ];
    const query = createQuery(requests);
    ReturnRequest.find.mockReturnValue(query);

    const req = { user: { id: "user-1" } };
    const res = createRes();

    await getMyReturnRequests(req, res);

    expect(ReturnRequest.find).toHaveBeenCalledWith({ userId: "user-1" });
    expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      returnRequests: [
        {
          id: "return-1",
          orderId: "order-1",
          items: requests[0].items,
          reason: "Damaged",
          photoUrls: ["/uploads/return-photos/return-1.jpg"],
          refundAmount: 80,
          status: "pending",
          resolvedAt: null,
          createdAt: requests[0].createdAt,
          updatedAt: requests[0].updatedAt,
        },
      ],
    });
  });

  test("createReturnRequest creates a request for a delivered paid order", async () => {
    const order = buildOrder();
    const createdRequest = {
      _id: "return-1",
      orderId: "order-1",
      items: [order.items[1]],
      reason: "Wrong product",
      refundAmount: 80,
      status: "pending",
      resolvedAt: null,
      createdAt: new Date("2026-04-20T10:00:00.000Z"),
      updatedAt: new Date("2026-04-20T10:00:00.000Z"),
    };

    Order.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(order) });
    Delivery.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ status: "delivered" }) });
    ReturnRequest.create.mockResolvedValue(createdRequest);

    const req = {
      user: { id: "user-1" },
      body: {
        orderId: "order-1",
        items: [{ productId: "p002", quantity: 1 }],
        reason: " Wrong product ",
      },
    };
    const res = createRes();

    await createReturnRequest(req, res);

    expect(Order.findOne).toHaveBeenCalledWith({
      _id: "order-1",
      userId: "user-1",
      status: "paid",
    });
    expect(Delivery.findOne).toHaveBeenCalledWith({ orderId: "order-1" });
    expect(ReturnRequest.create).toHaveBeenCalledWith({
      userId: "user-1",
      orderId: "order-1",
      items: [{ ...order.items[1], quantity: 1 }],
      reason: "Wrong product",
      photoUrls: [],
      refundAmount: 40,
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("createReturnRequest stores uploaded return photo URLs", async () => {
    const order = buildOrder();

    Order.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(order) });
    Delivery.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ status: "delivered" }) });
    ReturnRequest.create.mockResolvedValue({
      _id: "return-1",
      orderId: "order-1",
      items: [{ ...order.items[1], quantity: 1 }],
      reason: "Box was damaged",
      photoUrls: ["/uploads/return-photos/return-a.jpg"],
      refundAmount: 40,
      status: "pending",
      resolvedAt: null,
    });

    const req = {
      user: { id: "user-1" },
      body: {
        orderId: "order-1",
        items: JSON.stringify([{ productId: "p002", quantity: 1 }]),
        reason: "Box was damaged",
      },
      files: [{ filename: "return-a.jpg" }],
    };
    const res = createRes();

    await createReturnRequest(req, res);

    expect(ReturnRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        photoUrls: ["/uploads/return-photos/return-a.jpg"],
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("createReturnRequest allows a partial quantity return", async () => {
    const order = buildOrder();

    Order.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(order) });
    Delivery.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ status: "delivered" }) });
    ReturnRequest.create.mockResolvedValue({
      _id: "return-1",
      orderId: "order-1",
      items: [{ ...order.items[1], quantity: 1 }],
      reason: "Only one item was defective",
      refundAmount: 40,
      status: "pending",
      resolvedAt: null,
    });

    const req = {
      user: { id: "user-1" },
      body: {
        orderId: "order-1",
        items: [{ productId: "p002", quantity: 1 }],
        reason: "Only one item was defective",
      },
    };
    const res = createRes();

    await createReturnRequest(req, res);

    expect(ReturnRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [{ ...order.items[1], quantity: 1 }],
        refundAmount: 40,
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("createReturnRequest rejects quantities greater than ordered", async () => {
    Order.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(buildOrder()) });
    Delivery.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ status: "delivered" }) });

    const req = {
      user: { id: "user-1" },
      body: {
        orderId: "order-1",
        items: [{ productId: "p002", quantity: 3 }],
        reason: "Too many",
      },
    };
    const res = createRes();

    await createReturnRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Return quantity cannot exceed the ordered quantity",
    });
    expect(ReturnRequest.create).not.toHaveBeenCalled();
  });

  test("createReturnRequest rejects non-positive quantities", async () => {
    Order.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(buildOrder()) });
    Delivery.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ status: "delivered" }) });

    const req = {
      user: { id: "user-1" },
      body: {
        orderId: "order-1",
        items: [{ productId: "p002", quantity: 0 }],
        reason: "Invalid quantity",
      },
    };
    const res = createRes();

    await createReturnRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Return quantity must be a positive integer",
    });
    expect(ReturnRequest.create).not.toHaveBeenCalled();
  });

  test("createReturnRequest rejects decimal quantities", async () => {
    Order.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(buildOrder()) });
    Delivery.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ status: "delivered" }) });

    const req = {
      user: { id: "user-1" },
      body: {
        orderId: "order-1",
        items: [{ productId: "p002", quantity: 1.5 }],
        reason: "Invalid quantity",
      },
    };
    const res = createRes();

    await createReturnRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Return quantity must be a positive integer",
    });
    expect(ReturnRequest.create).not.toHaveBeenCalled();
  });

  test("createReturnRequest rejects missing product IDs", async () => {
    Order.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(buildOrder()) });
    Delivery.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ status: "delivered" }) });

    const req = {
      user: { id: "user-1" },
      body: {
        orderId: "order-1",
        items: [{ quantity: 1 }],
        reason: "Missing product",
      },
    };
    const res = createRes();

    await createReturnRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Each return item must include a product ID",
    });
    expect(ReturnRequest.create).not.toHaveBeenCalled();
  });

  test("createReturnRequest rejects non-delivered orders", async () => {
    Order.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(buildOrder()) });
    Delivery.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ status: "processing" }) });

    const req = {
      user: { id: "user-1" },
      body: { orderId: "order-1", itemProductIds: ["p001"], reason: "Damaged" },
    };
    const res = createRes();

    await createReturnRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Returns can only be requested after delivery",
    });
    expect(ReturnRequest.create).not.toHaveBeenCalled();
  });

  test("createReturnRequest rejects quantities that exceed remaining returnable quantity", async () => {
    Order.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(buildOrder()) });
    Delivery.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ status: "delivered" }) });
    ReturnRequest.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          _id: "return-1",
          orderId: "order-1",
          status: "pending",
          items: [{ productId: "p002", quantity: 1 }],
        },
      ]),
    });

    const req = {
      user: { id: "user-1" },
      body: { orderId: "order-1", items: [{ productId: "p002", quantity: 2 }], reason: "Damaged" },
    };
    const res = createRes();

    await createReturnRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Return quantity cannot exceed the remaining returnable quantity",
    });
    expect(ReturnRequest.create).not.toHaveBeenCalled();
  });

  test("createReturnRequest allows a different item from an order with an existing return", async () => {
    const order = buildOrder();
    Order.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(order) });
    Delivery.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ status: "delivered" }) });
    ReturnRequest.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          _id: "return-1",
          orderId: "order-1",
          status: "pending",
          items: [{ productId: "p001", quantity: 1 }],
        },
      ]),
    });
    ReturnRequest.create.mockResolvedValue({
      _id: "return-2",
      orderId: "order-1",
      items: [{ ...order.items[1], quantity: 1 }],
      reason: "Second item issue",
      refundAmount: 40,
      status: "pending",
    });

    const req = {
      user: { id: "user-1" },
      body: { orderId: "order-1", items: [{ productId: "p002", quantity: 1 }], reason: "Second item issue" },
    };
    const res = createRes();

    await createReturnRequest(req, res);

    expect(ReturnRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [{ ...order.items[1], quantity: 1 }],
        refundAmount: 40,
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("createReturnRequest rejects items that are not in the order", async () => {
    Order.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(buildOrder()) });
    Delivery.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ status: "delivered" }) });

    const req = {
      user: { id: "user-1" },
      body: { orderId: "order-1", itemProductIds: ["p999"], reason: "Damaged" },
    };
    const res = createRes();

    await createReturnRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Selected return items are not part of this order",
    });
    expect(ReturnRequest.create).not.toHaveBeenCalled();
  });
});
