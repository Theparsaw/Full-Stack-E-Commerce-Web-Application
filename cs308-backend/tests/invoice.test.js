jest.mock("../models/Invoice", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock("../models/Order", () => ({
  findOne: jest.fn(),
  find: jest.fn(),
}));

jest.mock("../models/Product", () => ({
  find: jest.fn(),
}));

jest.mock("../models/ReturnRequest", () => ({
  find: jest.fn(),
}));

jest.mock("../models/User", () => ({
  findById: jest.fn(),
  find: jest.fn(),
}));

jest.mock("../utils/invoiceGenerator", () => ({
  generateInvoicePDF: jest.fn(),
}));

const Invoice = require("../models/Invoice");
const Order = require("../models/Order");
const Product = require("../models/Product");
const ReturnRequest = require("../models/ReturnRequest");
const User = require("../models/User");
const { generateInvoicePDF } = require("../utils/invoiceGenerator");
const { encryptValue } = require("../utils/encryption");
const {
  downloadInvoice,
  downloadSalesInvoice,
  getMyInvoices,
  getSalesInvoices,
  getSalesReport,
} = require("../controllers/invoiceController");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
};

const createQuery = (data) => ({
  sort: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(data),
});

describe("invoiceController", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test("getMyInvoices returns invoices for the authenticated user", async () => {
    const invoices = [
      {
        _id: "invoice-1",
        orderId: "order-1",
        invoiceNumber: "INV-ORDER1",
        amount: 120,
        status: "emailed",
        createdAt: new Date("2026-04-20T10:00:00.000Z"),
        updatedAt: new Date("2026-04-20T10:00:00.000Z"),
      },
    ];
    const query = createQuery(invoices);
    Invoice.find.mockReturnValue(query);

    const req = { user: { id: "user-1" } };
    const res = createRes();

    await getMyInvoices(req, res);

    expect(Invoice.find).toHaveBeenCalledWith({ userId: "user-1" });
    expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      invoices: [
        {
          id: "invoice-1",
          orderId: "order-1",
          invoiceNumber: "INV-ORDER1",
          amount: 120,
          status: "emailed",
          createdAt: invoices[0].createdAt,
          updatedAt: invoices[0].updatedAt,
        },
      ],
    });
  });

  test("getMyInvoices decrypts invoice numbers returned by lean queries", async () => {
    const encryptedInvoiceNumber = encryptValue("INV-ENCRYPTED");
    const invoices = [
      {
        _id: "invoice-1",
        orderId: "order-1",
        invoiceNumber: encryptedInvoiceNumber,
        amount: 120,
        status: "generated",
      },
    ];
    Invoice.find.mockReturnValue(createQuery(invoices));
    const res = createRes();

    await getMyInvoices({ user: { id: "user-1" } }, res);

    expect(res.json).toHaveBeenCalledWith({
      invoices: [
        expect.objectContaining({
          invoiceNumber: "INV-ENCRYPTED",
        }),
      ],
    });
  });

  test("downloadInvoice regenerates a PDF for the invoice owner", async () => {
    const invoice = {
      _id: "invoice-1",
      orderId: "order-1",
      userId: "user-1",
      invoiceNumber: "INV-ORDER1",
      amount: 120,
      status: "emailed",
    };
    const order = {
      _id: "order-1",
      userId: "user-1",
      items: [{ productId: "prod-1", name: "Phone", unitPrice: 120, quantity: 1 }],
      totalPrice: 120,
      status: "paid",
    };
    const pdfBuffer = Buffer.from("pdf");
    const user = {
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      address: "123 Test Street",
    };

    Invoice.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(invoice) });
    Order.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(order) });
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
    generateInvoicePDF.mockResolvedValue(pdfBuffer);

    const req = {
      params: { invoiceId: "invoice-1" },
      user: { id: "user-1", name: "Test User", email: "test@example.com" },
    };
    const res = createRes();

    await downloadInvoice(req, res);

    expect(Invoice.findOne).toHaveBeenCalledWith({
      _id: "invoice-1",
      userId: "user-1",
    });
    expect(Order.findOne).toHaveBeenCalledWith({
      _id: "order-1",
      userId: "user-1",
      status: "paid",
    });
    expect(User.findById).toHaveBeenCalledWith("user-1");
    expect(generateInvoicePDF).toHaveBeenCalledWith(order, user);
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      'attachment; filename="INV-ORDER1.pdf"'
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(pdfBuffer);
  });

  test("downloadInvoice returns 404 when the invoice is not owned by the user", async () => {
    Invoice.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    const req = {
      params: { invoiceId: "invoice-1" },
      user: { id: "user-1" },
    };
    const res = createRes();

    await downloadInvoice(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Invoice not found" });
    expect(generateInvoicePDF).not.toHaveBeenCalled();
  });

  test("getSalesInvoices returns invoices in a date range with customer data", async () => {
    const invoices = [
      {
        _id: "invoice-1",
        orderId: "order-1",
        userId: "user-1",
        invoiceNumber: "INV-ORDER1",
        amount: 120,
        status: "emailed",
        createdAt: new Date("2026-04-20T10:00:00.000Z"),
        updatedAt: new Date("2026-04-20T10:00:00.000Z"),
      },
    ];
    const users = [
      {
        _id: "user-1",
        name: "Ada Lovelace",
        email: "ada@example.com",
      },
    ];
    const invoiceQuery = createQuery(invoices);
    const userQuery = createQuery(users);
    Invoice.find.mockReturnValue(invoiceQuery);
    User.find.mockReturnValue(userQuery);

    const req = {
      query: {
        startDate: "2026-04-01",
        endDate: "2026-04-30",
      },
    };
    const res = createRes();

    await getSalesInvoices(req, res);

    expect(Invoice.find).toHaveBeenCalledWith({
      createdAt: {
        $gte: new Date("2026-04-01"),
        $lte: new Date("2026-04-30T23:59:59.999Z"),
      },
    });
    expect(User.find).toHaveBeenCalledWith({ _id: { $in: ["user-1"] } });
    expect(userQuery.select).toHaveBeenCalledWith("_id name email");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      invoices: [
        expect.objectContaining({
          id: "invoice-1",
          customerName: "Ada Lovelace",
          customerEmail: "ada@example.com",
        }),
      ],
      summary: {
        count: 1,
        totalAmount: 120,
      },
    });
  });

  test("getSalesReport calculates net revenue and profit from product costs", async () => {
    const orders = [
      {
        _id: "order-1",
        status: "paid",
        totalPrice: 180,
        paidAt: new Date("2026-04-20T10:00:00.000Z"),
        createdAt: new Date("2026-04-20T09:00:00.000Z"),
        items: [
          {
            productId: "p001",
            name: "Phone",
            originalPrice: 100,
            unitPrice: 90,
            costPrice: 60,
            quantity: 2,
          },
        ],
      },
    ];
    const orderQuery = createQuery(orders);
    Order.find.mockReturnValue(orderQuery);
    ReturnRequest.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    Product.find.mockReturnValue(createQuery([]));

    const req = {
      query: {
        startDate: "2026-04-01",
        endDate: "2026-04-30",
      },
    };
    const res = createRes();

    await getSalesReport(req, res);

    expect(Order.find).toHaveBeenCalledWith({
      status: "paid",
      paidAt: {
        $gte: new Date("2026-04-01"),
        $lte: new Date("2026-04-30T23:59:59.999Z"),
      },
    });
    expect(orderQuery.sort).toHaveBeenCalledWith({ paidAt: 1, createdAt: 1 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      summary: {
        grossRevenue: 180,
        refunds: 0,
        revenue: 180,
        costOfGoods: 120,
        profitLoss: 60,
        discountLoss: 20,
        orderCount: 1,
        itemsSold: 2,
        returnedItems: 0,
        legacyCostItems: 0,
        chart: [
          {
            date: "2026-04-20",
            grossRevenue: 180,
            refunds: 0,
            revenue: 180,
            costOfGoods: 120,
            profitLoss: 60,
            discountLoss: 20,
            orders: 1,
            itemsSold: 2,
            returnedItems: 0,
          },
        ],
      },
    });
  });

  test("getSalesReport subtracts approved refunds and reverses refunded item cost", async () => {
    const order = {
      _id: "order-1",
      status: "paid",
      totalPrice: 200,
      paidAt: new Date("2026-04-20T10:00:00.000Z"),
      items: [
        {
          productId: "p001",
          name: "Phone",
          unitPrice: 100,
          originalPrice: 100,
          costPrice: 60,
          quantity: 2,
        },
      ],
    };
    const refund = {
      orderId: "order-1",
      status: "approved",
      refundAmount: 100,
      resolvedAt: new Date("2026-04-22T10:00:00.000Z"),
      items: [{ productId: "p001", name: "Phone", unitPrice: 100, quantity: 1 }],
    };

    Order.find.mockReturnValue(createQuery([order]));
    ReturnRequest.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([refund]) });
    Product.find.mockReturnValue(createQuery([]));
    const res = createRes();

    await getSalesReport(
      { query: { startDate: "2026-04-01", endDate: "2026-04-30" } },
      res
    );

    expect(res.json).toHaveBeenCalledWith({
      summary: expect.objectContaining({
        grossRevenue: 200,
        refunds: 100,
        revenue: 100,
        costOfGoods: 60,
        profitLoss: 40,
        itemsSold: 2,
        returnedItems: 1,
      }),
    });
  });

  test("downloadSalesInvoice lets sales managers download any paid invoice", async () => {
    const invoice = {
      _id: "invoice-1",
      orderId: "order-1",
      userId: "user-1",
      invoiceNumber: "INV-ORDER1",
      amount: 120,
      status: "emailed",
    };
    const order = {
      _id: "order-1",
      userId: "user-1",
      items: [{ productId: "prod-1", name: "Phone", unitPrice: 120, quantity: 1 }],
      totalPrice: 120,
      status: "paid",
    };
    const user = {
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      address: "123 Test Street",
    };
    const pdfBuffer = Buffer.from("pdf");

    Invoice.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(invoice) });
    Order.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(order) });
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
    generateInvoicePDF.mockResolvedValue(pdfBuffer);

    const req = {
      params: { invoiceId: "invoice-1" },
      user: { id: "sales-1", role: "sales_manager" },
    };
    const res = createRes();

    await downloadSalesInvoice(req, res);

    expect(Invoice.findOne).toHaveBeenCalledWith({ _id: "invoice-1" });
    expect(Order.findOne).toHaveBeenCalledWith({
      _id: "order-1",
      status: "paid",
    });
    expect(generateInvoicePDF).toHaveBeenCalledWith(order, user);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(pdfBuffer);
  });
});
