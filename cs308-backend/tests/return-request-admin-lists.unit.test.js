jest.mock("../models/ReturnRequest", () => ({
  find: jest.fn(),
}));

const ReturnRequest = require("../models/ReturnRequest");
const {
  getPendingReturnRequests,
  getReturnHistory,
} = require("../controllers/returnRequestController");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createQuery = (result, error = null) => {
  const query = {
    populate: jest.fn(),
    sort: jest.fn(),
  };

  query.populate.mockImplementation(() => query);

  if (error) {
    query.sort.mockRejectedValue(error);
  } else {
    query.sort.mockResolvedValue(result);
  }

  return query;
};

describe("returnRequestController admin list handlers", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test("getPendingReturnRequests returns pending requests with customer details sorted newest first", async () => {
    const pendingRequests = [
      {
        _id: "return-2",
        status: "pending",
        userId: { name: "Ada", email: "ada@example.com" },
      },
      {
        _id: "return-1",
        status: "pending",
        userId: { name: "Linus", email: "linus@example.com" },
      },
    ];
    const query = createQuery(pendingRequests);
    ReturnRequest.find.mockReturnValue(query);

    const res = createRes();

    await getPendingReturnRequests({}, res);

    expect(ReturnRequest.find).toHaveBeenCalledWith({ status: "pending" });
    expect(query.populate).toHaveBeenCalledWith("userId", "name email");
    expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      count: 2,
      data: pendingRequests,
    });
  });

  test("getPendingReturnRequests returns an empty admin queue cleanly", async () => {
    const query = createQuery([]);
    ReturnRequest.find.mockReturnValue(query);

    const res = createRes();

    await getPendingReturnRequests({}, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      count: 0,
      data: [],
    });
  });

  test("getPendingReturnRequests returns 500 when loading the queue fails", async () => {
    const query = createQuery(null, new Error("queue lookup failed"));
    ReturnRequest.find.mockReturnValue(query);

    const res = createRes();

    await getPendingReturnRequests({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Server Error",
      error: "queue lookup failed",
    });
  });

  test("getReturnHistory returns resolved requests with both customer and reviewer details", async () => {
    const history = [
      {
        _id: "return-3",
        status: "approved",
        userId: { name: "Ada", email: "ada@example.com" },
        reviewedBy: { name: "Manager", email: "manager@example.com" },
      },
    ];
    const query = createQuery(history);
    ReturnRequest.find.mockReturnValue(query);

    const res = createRes();

    await getReturnHistory({}, res);

    expect(ReturnRequest.find).toHaveBeenCalledWith({
      status: { $ne: "pending" },
    });
    expect(query.populate).toHaveBeenNthCalledWith(1, "userId", "name email");
    expect(query.populate).toHaveBeenNthCalledWith(2, "reviewedBy", "name email");
    expect(query.sort).toHaveBeenCalledWith({ resolvedAt: -1 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      count: 1,
      data: history,
    });
  });

  test("getReturnHistory returns 500 when loading resolved requests fails", async () => {
    const query = createQuery(null, new Error("history lookup failed"));
    ReturnRequest.find.mockReturnValue(query);

    const res = createRes();

    await getReturnHistory({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Server Error",
      error: "history lookup failed",
    });
  });
});
