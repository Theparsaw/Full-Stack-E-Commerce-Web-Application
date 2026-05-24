jest.mock("../models/ReturnRequest", () => ({
  findOneAndUpdate: jest.fn(),
  findById: jest.fn(),
}));

jest.mock("../models/Order", () => ({
  findOne: jest.fn(),
}));

jest.mock("../models/Product", () => ({
  findOneAndUpdate: jest.fn(),
}));

const mongoose = require("mongoose");
const ReturnRequest = require("../models/ReturnRequest");
const Order = require("../models/Order");
const Product = require("../models/Product");
const {
  approveReturnRequest,
} = require("../controllers/returnRequestController");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createSession = () => ({
  startTransaction: jest.fn(),
  commitTransaction: jest.fn().mockResolvedValue(true),
  abortTransaction: jest.fn().mockResolvedValue(true),
  endSession: jest.fn(),
  inTransaction: jest.fn().mockReturnValue(true),
});

const buildOrder = (overrides = {}) => ({
  _id: "order-1",
  items: [
    {
      productId: "p001",
      quantity: 2,
      returnedQuantity: 0,
      status: "active",
    },
  ],
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

const buildReturnRequest = (overrides = {}) => ({
  _id: "return-1",
  orderId: "order-1",
  items: [{ productId: "p001", quantity: 2 }],
  status: "approved",
  ...overrides,
});

describe("returnRequestController approveReturnRequest", () => {
  let startSessionSpy;

  beforeEach(() => {
    jest.resetAllMocks();
    startSessionSpy = jest.spyOn(mongoose, "startSession");
  });

  afterEach(() => {
    startSessionSpy.mockRestore();
  });

  test("approveReturnRequest fully returns an item, restores stock, and commits the transaction", async () => {
    const session = createSession();
    const order = buildOrder();
    const returnReq = buildReturnRequest();

    startSessionSpy.mockResolvedValue(session);
    ReturnRequest.findOneAndUpdate.mockResolvedValue(returnReq);
    Order.findOne.mockReturnValue({
      session: jest.fn().mockResolvedValue(order),
    });
    Product.findOneAndUpdate.mockResolvedValue({
      productId: "p001",
      quantityInStock: 7,
    });

    const req = {
      params: { id: "return-1" },
      user: { id: "sales-1" },
    };
    const res = createRes();

    await approveReturnRequest(req, res);

    expect(ReturnRequest.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "return-1", status: "pending" },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "approved",
          reviewedBy: "sales-1",
        }),
      }),
      expect.objectContaining({ returnDocument: "after", session })
    );
    expect(order.items[0].returnedQuantity).toBe(2);
    expect(order.items[0].status).toBe("returned");
    expect(order.save).toHaveBeenCalledWith({ session });
    expect(Product.findOneAndUpdate).toHaveBeenCalledWith(
      { productId: "p001" },
      { $inc: { quantityInStock: 2 } },
      { returnDocument: "after", session }
    );
    expect(session.commitTransaction).toHaveBeenCalled();
    expect(session.abortTransaction).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: returnReq,
    });
  });

  test("approveReturnRequest keeps partially returned order items active", async () => {
    const session = createSession();
    const order = buildOrder({
      items: [
        {
          productId: "p001",
          quantity: 3,
          returnedQuantity: 1,
          status: "active",
        },
      ],
    });
    const returnReq = buildReturnRequest({
      items: [{ productId: "p001", quantity: 1 }],
    });

    startSessionSpy.mockResolvedValue(session);
    ReturnRequest.findOneAndUpdate.mockResolvedValue(returnReq);
    Order.findOne.mockReturnValue({
      session: jest.fn().mockResolvedValue(order),
    });
    Product.findOneAndUpdate.mockResolvedValue({
      productId: "p001",
      quantityInStock: 11,
    });

    const res = createRes();

    await approveReturnRequest(
      {
        params: { id: "return-2" },
        user: { id: "sales-2" },
      },
      res
    );

    expect(order.items[0].returnedQuantity).toBe(2);
    expect(order.items[0].status).toBe("active");
    expect(session.commitTransaction).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("approveReturnRequest returns 400 when the return was already processed or missing", async () => {
    const session = createSession();

    startSessionSpy.mockResolvedValue(session);
    ReturnRequest.findOneAndUpdate.mockResolvedValue(null);

    const res = createRes();

    await approveReturnRequest(
      {
        params: { id: "missing-return" },
        user: { id: "sales-1" },
      },
      res
    );

    expect(session.abortTransaction).toHaveBeenCalled();
    expect(session.commitTransaction).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid request or already processed",
    });
  });

  test("approveReturnRequest aborts and returns 404 when the product to restock is missing", async () => {
    const session = createSession();
    const order = buildOrder();
    const returnReq = buildReturnRequest();

    startSessionSpy.mockResolvedValue(session);
    ReturnRequest.findOneAndUpdate.mockResolvedValue(returnReq);
    Order.findOne.mockReturnValue({
      session: jest.fn().mockResolvedValue(order),
    });
    Product.findOneAndUpdate.mockResolvedValue(null);

    const res = createRes();

    await approveReturnRequest(
      {
        params: { id: "return-3" },
        user: { id: "sales-1" },
      },
      res
    );

    expect(session.abortTransaction).toHaveBeenCalled();
    expect(session.commitTransaction).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Product p001 was not found",
      error: "Product p001 was not found",
    });
  });

  test("approveReturnRequest retries a transient transaction error and succeeds on a later attempt", async () => {
    const firstSession = createSession();
    const secondSession = createSession();
    const transientError = new Error("temporary write conflict");
    transientError.hasErrorLabel = jest.fn((label) => label === "TransientTransactionError");

    startSessionSpy
      .mockResolvedValueOnce(firstSession)
      .mockResolvedValueOnce(secondSession);
    ReturnRequest.findOneAndUpdate
      .mockRejectedValueOnce(transientError)
      .mockResolvedValueOnce(buildReturnRequest({
        items: [{ productId: "p001", quantity: 1 }],
      }));
    Order.findOne.mockReturnValue({
      session: jest.fn().mockResolvedValue(buildOrder({
        items: [
          {
            productId: "p001",
            quantity: 2,
            returnedQuantity: 0,
            status: "active",
          },
        ],
      })),
    });
    Product.findOneAndUpdate.mockResolvedValue({
      productId: "p001",
      quantityInStock: 8,
    });

    const res = createRes();

    await approveReturnRequest(
      {
        params: { id: "return-4" },
        user: { id: "sales-9" },
      },
      res
    );

    expect(startSessionSpy).toHaveBeenCalledTimes(2);
    expect(firstSession.abortTransaction).toHaveBeenCalled();
    expect(secondSession.commitTransaction).toHaveBeenCalled();
    expect(secondSession.endSession).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
