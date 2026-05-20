// tests/customer-ownership-protection.test.js

jest.mock("../models/ReturnRequest", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
}));

jest.mock("../models/Order", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
  exists: jest.fn(),
}));

jest.mock("../models/Delivery", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  distinct: jest.fn(),
}));

jest.mock("../models/Product", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock("../models/Review", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
}));

jest.mock("../models/Wishlist", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
}));

jest.mock("../models/DiscountCampaign", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock("../models/Notification", () => ({
  findOneAndUpdate: jest.fn(),
}));

jest.mock("../models/User", () => ({
  find: jest.fn(),
  findById: jest.fn(),
}));

const mongoose = require("mongoose");

const ReturnRequest = require("../models/ReturnRequest");
const Order = require("../models/Order");
const Delivery = require("../models/Delivery");
const Product = require("../models/Product");
const Review = require("../models/Review");
const Wishlist = require("../models/Wishlist");
const DiscountCampaign = require("../models/DiscountCampaign");

const {
  getMyReturnRequests,
  createReturnRequest,
} = require("../controllers/returnRequestController");

const {
  updateReview,
} = require("../controllers/reviewController");

const {
  getWishlist,
  addWishlistItem,
} = require("../controllers/wishlistController");

const { authorize } = require("../middleware/authMiddleware");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

const createQuery = (data) => ({
  sort: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  populate: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(data),
});

describe("Customer data ownership protection", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    ReturnRequest.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
  });

  test("getMyReturnRequests only queries return requests owned by the authenticated customer", async () => {
    const req = {
      user: { id: "customer-1", role: "customer" },
    };
    const res = createRes();

    const returnRequests = [
      {
        _id: "return-1",
        userId: "customer-1",
        orderId: "order-1",
        status: "pending",
      },
    ];

    const query = createQuery(returnRequests);
    ReturnRequest.find.mockReturnValue(query);

    await getMyReturnRequests(req, res);

    expect(ReturnRequest.find).toHaveBeenCalledWith({ userId: "customer-1" });
    expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      returnRequests: [
        {
          id: "return-1",
          orderId: "order-1",
          status: "pending",
        },
      ],
    });
  });

  test("createReturnRequest does not allow a customer to return another customer's order", async () => {
    const req = {
      user: { id: "customer-2", role: "customer" },
      body: {
        orderId: "order-owned-by-customer-1",
        items: [{ productId: "p001", quantity: 1 }],
        reason: "Changed my mind",
      },
    };
    const res = createRes();

    Order.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    await createReturnRequest(req, res);

    expect(Order.findOne).toHaveBeenCalledWith({
      _id: "order-owned-by-customer-1",
      userId: "customer-2",
      status: "paid",
    });
    expect(ReturnRequest.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Order not found",
    });
  });

  test("createReturnRequest only creates a return request under the authenticated customer id", async () => {
    const req = {
      user: { id: "customer-1", role: "customer" },
      body: {
        orderId: "order-1",
        items: [{ productId: "p001", quantity: 1 }],
        reason: "Product is defective",
      },
    };
    const res = createRes();

    const order = {
      _id: "order-1",
      userId: "customer-1",
      status: "paid",
      paidAt: new Date(),
      items: [
        {
          productId: "p001",
          name: "MacBook Pro",
          unitPrice: 1000,
          quantity: 1,
        },
      ],
    };

    const delivery = {
      orderId: "order-1",
      status: "delivered",
    };

    const createdReturnRequest = {
      _id: "return-1",
      userId: "customer-1",
      orderId: "order-1",
      refundAmount: 1000,
      status: "pending",
    };

    Order.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(order),
    });

    Delivery.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(delivery),
    });

    ReturnRequest.create.mockResolvedValue(createdReturnRequest);

    await createReturnRequest(req, res);

    expect(ReturnRequest.create).toHaveBeenCalledWith({
      userId: "customer-1",
      orderId: "order-1",
      items: [
        expect.objectContaining({
          productId: "p001",
          name: "MacBook Pro",
          unitPrice: 1000,
          quantity: 1,
        }),
      ],
      reason: "Product is defective",
      photoUrls: [],
      refundAmount: 1000,
    });

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(createdReturnRequest);
  });

  test("updateReview blocks a customer from editing another customer's review", async () => {
    const reviewId = new mongoose.Types.ObjectId().toString();

    const req = {
      user: { id: "customer-2", role: "customer" },
      params: { id: reviewId },
      body: {
        rating: 5,
        comment: "Updated ownership-safe comment",
      },
    };
    const res = createRes();
    const next = jest.fn();

    const reviewOwnedBySomeoneElse = {
      _id: reviewId,
      userId: "customer-1",
      productId: "p001",
      rating: 4,
      comment: "Original approved comment",
      pendingComment: "",
      status: "approved",
      commentStatus: "approved",
      save: jest.fn(),
    };

    Review.findById.mockResolvedValue(reviewOwnedBySomeoneElse);

    await updateReview(req, res, next);

    expect(Review.findById).toHaveBeenCalledWith(reviewId);
    expect(reviewOwnedBySomeoneElse.save).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "You can only edit your own review",
        statusCode: 403,
        code: "FORBIDDEN",
      })
    );
  });

  test("getWishlist only fetches the wishlist of the authenticated customer", async () => {
    const req = {
      user: { id: "customer-1", role: "customer" },
    };
    const res = createRes();

    Wishlist.findOne.mockResolvedValue(null);

    await getWishlist(req, res);

    expect(Wishlist.findOne).toHaveBeenCalledWith({ userId: "customer-1" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      userId: "customer-1",
      items: [],
      totalItems: 0,
    });
  });

  test("addWishlistItem creates or updates wishlist data under the authenticated customer id", async () => {
    const req = {
      user: { id: "customer-1", role: "customer" },
      body: {
        productId: "p001",
        userId: "customer-2",
      },
    };
    const res = createRes();

    const product = {
      _id: "product-db-id",
      productId: "p001",
      categoryId: "laptops",
      name: "Laptop",
      model: "MacBook Pro",
      description: "Test product",
      quantityInStock: 5,
      price: 1000,
      warrantyStatus: "2 years",
      distributorInfo: "Apple",
      imageUrl: "",
      createdAt: new Date("2026-04-01T10:00:00.000Z"),
      updatedAt: new Date("2026-04-01T10:00:00.000Z"),
    };

    const wishlist = {
      _id: "wishlist-1",
      userId: "customer-1",
      items: [],
      createdAt: new Date("2026-04-01T10:00:00.000Z"),
      updatedAt: new Date("2026-04-01T10:00:00.000Z"),
      save: jest.fn().mockResolvedValue(true),
      removeUnavailableProductReferences: jest.fn(),
    };

    Product.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(product),
    });

    Wishlist.findOne.mockResolvedValue(null);
    Wishlist.create.mockResolvedValue(wishlist);

    Product.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([product]),
    });

    DiscountCampaign.find.mockResolvedValue([]);

    await addWishlistItem(req, res);

    expect(Wishlist.findOne).toHaveBeenCalledWith({ userId: "customer-1" });
    expect(Wishlist.create).toHaveBeenCalledWith({
      userId: "customer-1",
      items: [],
    });

    expect(wishlist.items).toEqual([
      expect.objectContaining({
        productId: "p001",
      }),
    ]);

    expect(wishlist.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        userId: "customer-1",
        totalItems: 1,
      })
    );
  });

  test("authorize blocks customers from sales-manager-only return management actions", () => {
    const req = {
      user: { id: "customer-1", role: "customer" },
    };
    const res = createRes();
    const next = jest.fn();

    authorize("sales_manager")(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "You are not allowed to access this resource",
        statusCode: 403,
        code: "FORBIDDEN",
      })
    );
  });
});
