const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const app = require("../server");
const User = require("../models/User");
const ReturnRequest = require("../models/ReturnRequest");
const Product = require("../models/Product");
const Order = require("../models/Order");

const uniqueSuffix = Date.now();
const salesManagerEmail = `refund-sales-${uniqueSuffix}@example.com`;
const customerEmail = `refund-customer-${uniqueSuffix}@example.com`;
const approvalProductId = `refund-approval-product-${uniqueSuffix}`;

let salesManagerToken;
let customerToken;
let pendingRequestId;
let salesManagerId;
let customerId;
let approvalOrderId;
let approvedRequestId;

const returnedItem = (productId = "p001") => ({
  productId,
  name: "Test Product",
  unitPrice: 100,
  quantity: 1,
});

beforeAll(async () => {
  const password = await bcrypt.hash("ManagerPass123!", 10);

  // 1. Create Sales Manager
  const manager = await User.create({
    name: "Refund Sales Manager",
    email: salesManagerEmail,
    password,
    role: "sales_manager",
  });
  salesManagerId = String(manager._id);

  // 2. Create Customer
  const customer = await User.create({
    name: "Refund Customer",
    email: customerEmail,
    password,
    role: "customer",
  });
  customerId = String(customer._id);

  // Log them in to get tokens
  const managerRes = await request(app).post("/api/auth/login").send({
    email: salesManagerEmail,
    password: "ManagerPass123!",
  });
  salesManagerToken = managerRes.body.token;

  const customerRes = await request(app).post("/api/auth/login").send({
    email: customerEmail,
    password: "ManagerPass123!",
  });
  customerToken = customerRes.body.token;

  // 3. Seed a pending Return Request directly into DB
  const returnReq = await ReturnRequest.create({
    userId: customerId,
    orderId: new mongoose.Types.ObjectId(),
    items: [returnedItem()],
    reason: "Defective out of box",
    refundAmount: 100,
    status: "pending",
  });
  pendingRequestId = returnReq._id;

  await Product.create({
    productId: approvalProductId,
    categoryId: "test",
    name: "Approval Test Product",
    model: "Approval",
    serialNumber: `approval-${uniqueSuffix}`,
    description: "Product used for return approval tests",
    quantityInStock: 5,
    price: 100,
    warrantyStatus: "none",
    distributorInfo: "none",
  });

  const approvalOrder = await Order.create({
    userId: customerId,
    cartId: `approval-cart-${uniqueSuffix}`,
    items: [returnedItem(approvalProductId)],
    totalPrice: 100,
    status: "paid",
    paidAt: new Date(),
  });
  approvalOrderId = approvalOrder._id;
});

afterAll(async () => {
  await ReturnRequest.deleteMany({ userId: customerId });
  await Order.findByIdAndDelete(approvalOrderId);
  await Product.deleteOne({ productId: approvalProductId });
  await User.deleteMany({ email: { $in: [salesManagerEmail, customerEmail] } });
  await mongoose.connection.close();
});

describe("Return Request Admin API (Sales Manager)", () => {
  test("GET /api/returns/pending requires authentication", async () => {
    const res = await request(app).get("/api/returns/pending");
    expect(res.statusCode).toBe(401);
  });

  test("GET /api/returns/pending is denied for regular customers", async () => {
    const res = await request(app)
      .get("/api/returns/pending")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  test("GET /api/returns/pending works for sales managers and returns an array", async () => {
    const res = await request(app)
      .get("/api/returns/pending")
      .set("Authorization", `Bearer ${salesManagerToken}`);
    
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    // Ensure our seeded pending request is in the list
    const found = res.body.data.find(req => req._id === pendingRequestId.toString());
    expect(found).toBeDefined();
    expect(found.status).toBe("pending");
  });

  test("PATCH /api/returns/:id/reject updates status to rejected", async () => {
    const res = await request(app)
      .patch(`/api/returns/${pendingRequestId}/reject`)
      .set("Authorization", `Bearer ${salesManagerToken}`)
      .send({ managerNotes: "Product seal was broken by user." });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    
    const updatedReq = await ReturnRequest.findById(pendingRequestId);
    expect(updatedReq.status).toBe("rejected");
    expect(updatedReq.managerNotes).toBe("Product seal was broken by user.");
    expect(updatedReq.rejectionReason).toBe("Product seal was broken by user.");
    expect(String(updatedReq.reviewedBy)).toBe(salesManagerId);
    expect(updatedReq.resolvedAt).toBeInstanceOf(Date);
    expect(updatedReq.resolutionDate).toBeInstanceOf(Date);
  });

  test("PATCH /api/returns/:id/approve stores reviewer and resolution date", async () => {
    const approvalRequest = await ReturnRequest.create({
      userId: customerId,
      orderId: approvalOrderId,
      items: [returnedItem(approvalProductId)],
      reason: "Approval decision data test",
      refundAmount: 100,
      status: "pending",
    });
    approvedRequestId = approvalRequest._id;

    const res = await request(app)
      .patch(`/api/returns/${approvedRequestId}/approve`)
      .set("Authorization", `Bearer ${salesManagerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    const updatedReq = await ReturnRequest.findById(approvedRequestId);
    expect(updatedReq.status).toBe("approved");
    expect(String(updatedReq.reviewedBy)).toBe(salesManagerId);
    expect(updatedReq.resolvedAt).toBeInstanceOf(Date);
    expect(updatedReq.resolutionDate).toBeInstanceOf(Date);
  });

  test("GET /api/returns/history shows manager decision details", async () => {
    const res = await request(app)
      .get("/api/returns/history")
      .set("Authorization", `Bearer ${salesManagerToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    const rejected = res.body.data.find(req => req._id === pendingRequestId.toString());
    expect(rejected.status).toBe("rejected");
    expect(rejected.managerNotes).toBe("Product seal was broken by user.");
    expect(rejected.rejectionReason).toBe("Product seal was broken by user.");
    expect(rejected.reviewedBy).toMatchObject({
      _id: salesManagerId,
      name: "Refund Sales Manager",
      email: salesManagerEmail,
    });
    expect(rejected.resolvedAt).toBeDefined();
    expect(rejected.resolutionDate).toBeDefined();

    const approved = res.body.data.find(req => req._id === approvedRequestId.toString());
    expect(approved.status).toBe("approved");
    expect(approved.reviewedBy).toMatchObject({
      _id: salesManagerId,
      name: "Refund Sales Manager",
      email: salesManagerEmail,
    });
    expect(approved.resolvedAt).toBeDefined();
    expect(approved.resolutionDate).toBeDefined();
  });
});
