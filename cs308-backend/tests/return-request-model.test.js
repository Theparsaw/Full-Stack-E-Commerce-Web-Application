const mongoose = require("mongoose");
const ReturnRequest = require("../models/ReturnRequest");
const connectDB = require("../config/db");
const dotenv = require("dotenv");

dotenv.config();

const testUserId = `user-return-test-${Date.now()}`;
const testOrderId = `order-return-test-${Date.now()}`;

const validItem = {
  productId: "p001",
  name: "Test Product",
  unitPrice: 99.99,
  quantity: 1,
};

beforeAll(async () => {
  await connectDB();
});

afterAll(async () => {
  await ReturnRequest.deleteMany({ userId: { $regex: "^user-return-test-" } });
  await mongoose.connection.close();
});

describe("ReturnRequest Model Validation", () => {
  test("Creates a valid return request successfully", async () => {
    const rr = await ReturnRequest.create({
      userId: testUserId,
      orderId: testOrderId,
      items: [validItem],
      reason: "Product was damaged on arrival",
      refundAmount: 99.99,
    });
    expect(rr.status).toBe("pending");
    expect(rr.refundAmount).toBe(99.99);
    expect(rr.managerNotes).toBe("");
    expect(rr.rejectionReason).toBe("");
    expect(rr.reviewedBy).toBeNull();
    expect(rr.resolvedAt).toBeNull();
    expect(rr.resolutionDate).toBeNull();
  });

  test("Fails without userId", async () => {
    const rr = new ReturnRequest({
      orderId: `order-${Date.now()}`,
      items: [validItem],
      reason: "Missing userId test",
      refundAmount: 50,
    });
    await expect(rr.save()).rejects.toThrow();
  });

  test("Fails without orderId", async () => {
    const rr = new ReturnRequest({
      userId: `user-${Date.now()}`,
      items: [validItem],
      reason: "Missing orderId test",
      refundAmount: 50,
    });
    await expect(rr.save()).rejects.toThrow();
  });

  test("Fails without reason", async () => {
    const rr = new ReturnRequest({
      userId: `user-no-reason-${Date.now()}`,
      orderId: `order-no-reason-${Date.now()}`,
      items: [validItem],
      refundAmount: 50,
    });
    await expect(rr.save()).rejects.toThrow();
  });

  test("Fails with negative refundAmount", async () => {
    const rr = new ReturnRequest({
      userId: `user-neg-${Date.now()}`,
      orderId: `order-neg-${Date.now()}`,
      items: [validItem],
      reason: "Negative refund test",
      refundAmount: -10,
    });
    await expect(rr.save()).rejects.toThrow();
  });

  test("Fails with invalid status", async () => {
    const rr = new ReturnRequest({
      userId: `user-bad-status-${Date.now()}`,
      orderId: `order-bad-status-${Date.now()}`,
      items: [validItem],
      reason: "Bad status test",
      refundAmount: 50,
      status: "invalid_status",
    });
    await expect(rr.save()).rejects.toThrow();
  });

  test("Allows multiple return requests for the same user and order", async () => {
    const dup = new ReturnRequest({
      userId: testUserId,
      orderId: testOrderId,
      items: [validItem],
      reason: "Duplicate request test",
      refundAmount: 99.99,
    });
    await expect(dup.save()).resolves.toMatchObject({
      userId: testUserId,
      orderId: testOrderId,
      status: "pending",
    });
  });

  test("Has timestamps after creation", async () => {
    const rr = await ReturnRequest.findOne({ userId: testUserId });
    expect(rr.createdAt).toBeDefined();
    expect(rr.updatedAt).toBeDefined();
  });

  test("Default status is pending", async () => {
    const rr = await ReturnRequest.findOne({ userId: testUserId });
    expect(rr.status).toBe("pending");
  });
});
