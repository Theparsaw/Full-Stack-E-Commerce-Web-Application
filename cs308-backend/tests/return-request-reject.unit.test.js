jest.mock("../models/ReturnRequest", () => ({
  findById: jest.fn(),
}));

const ReturnRequest = require("../models/ReturnRequest");
const {
  rejectReturnRequest,
} = require("../controllers/returnRequestController");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const buildReturnRequest = (overrides = {}) => ({
  _id: "return-1",
  status: "pending",
  managerNotes: "",
  rejectionReason: "",
  reviewedBy: null,
  resolvedAt: null,
  resolutionDate: null,
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

describe("returnRequestController rejectReturnRequest", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test("rejectReturnRequest marks a pending return as rejected and stores review metadata", async () => {
    const returnReq = buildReturnRequest();
    ReturnRequest.findById.mockResolvedValue(returnReq);

    const req = {
      params: { id: "return-1" },
      body: { managerNotes: "Packaging was opened" },
      user: { id: "sales-1" },
    };
    const res = createRes();

    await rejectReturnRequest(req, res);

    expect(ReturnRequest.findById).toHaveBeenCalledWith("return-1");
    expect(returnReq.status).toBe("rejected");
    expect(returnReq.reviewedBy).toBe("sales-1");
    expect(returnReq.resolvedAt).toBeInstanceOf(Date);
    expect(returnReq.resolutionDate).toBe(returnReq.resolvedAt);
    expect(returnReq.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: returnReq,
    });
  });

  test("rejectReturnRequest trims manager notes and copies them into rejectionReason", async () => {
    const returnReq = buildReturnRequest();
    ReturnRequest.findById.mockResolvedValue(returnReq);

    const req = {
      params: { id: "return-1" },
      body: { managerNotes: "  Seal was broken on arrival  " },
      user: { id: "sales-1" },
    };
    const res = createRes();

    await rejectReturnRequest(req, res);

    expect(returnReq.managerNotes).toBe("Seal was broken on arrival");
    expect(returnReq.rejectionReason).toBe("Seal was broken on arrival");
  });

  test("rejectReturnRequest normalizes missing manager notes to empty strings", async () => {
    const returnReq = buildReturnRequest();
    ReturnRequest.findById.mockResolvedValue(returnReq);

    const req = {
      params: { id: "return-1" },
      body: {},
      user: { id: "sales-1" },
    };
    const res = createRes();

    await rejectReturnRequest(req, res);

    expect(returnReq.managerNotes).toBe("");
    expect(returnReq.rejectionReason).toBe("");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("rejectReturnRequest returns 400 when the request is missing or already processed", async () => {
    ReturnRequest.findById
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(buildReturnRequest({ status: "approved" }));

    const missingRes = createRes();
    await rejectReturnRequest(
      {
        params: { id: "missing-return" },
        body: { managerNotes: "Nope" },
        user: { id: "sales-1" },
      },
      missingRes
    );

    const processedRes = createRes();
    await rejectReturnRequest(
      {
        params: { id: "approved-return" },
        body: { managerNotes: "Nope" },
        user: { id: "sales-1" },
      },
      processedRes
    );

    expect(missingRes.status).toHaveBeenCalledWith(400);
    expect(missingRes.json).toHaveBeenCalledWith({ message: "Invalid request" });
    expect(processedRes.status).toHaveBeenCalledWith(400);
    expect(processedRes.json).toHaveBeenCalledWith({ message: "Invalid request" });
  });

  test("rejectReturnRequest returns 500 when saving the decision fails", async () => {
    const returnReq = buildReturnRequest({
      save: jest.fn().mockRejectedValue(new Error("save failed")),
    });
    ReturnRequest.findById.mockResolvedValue(returnReq);

    const req = {
      params: { id: "return-1" },
      body: { managerNotes: "Rejecting this request" },
      user: { id: "sales-1" },
    };
    const res = createRes();

    await rejectReturnRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Server Error",
      error: "save failed",
    });
  });
});
