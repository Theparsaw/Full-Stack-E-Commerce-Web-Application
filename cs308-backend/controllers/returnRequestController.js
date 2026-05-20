const fs = require("fs");
const mongoose = require("mongoose");
const ReturnRequest = require("../models/ReturnRequest");
const Order = require("../models/Order");
const Delivery = require("../models/Delivery");
const Product = require("../models/Product");

const normalizeRequestedReturnItems = (items, itemProductIds) => {
  if (Array.isArray(items)) {
    return items.map((item) => ({
      productId: String(item?.productId || "").trim(),
      quantity: item?.quantity,
    }));
  }

  if (typeof items === "string") {
    try {
      const parsedItems = JSON.parse(items);
      return normalizeRequestedReturnItems(parsedItems, itemProductIds);
    } catch (_error) {
      return [];
    }
  }

  if (Array.isArray(itemProductIds)) {
    return itemProductIds.map((productId) => ({
      productId: String(productId || "").trim(),
      quantity: 1,
    }));
  }

  return [];
};

const serializeReturnRequest = (request) => {
  const serialized = {
    id: String(request._id),
    orderId: request.orderId,
    status: request.status,
  };

  if (request.items !== undefined) serialized.items = request.items;
  if (request.reason !== undefined) serialized.reason = request.reason;
  if (request.photoUrls !== undefined) serialized.photoUrls = request.photoUrls;
  if (request.refundAmount !== undefined) serialized.refundAmount = request.refundAmount;
  if (request.resolvedAt !== undefined) serialized.resolvedAt = request.resolvedAt;
  if (request.createdAt !== undefined) serialized.createdAt = request.createdAt;
  if (request.updatedAt !== undefined) serialized.updatedAt = request.updatedAt;
  if (request.managerNotes !== undefined) serialized.managerNotes = request.managerNotes;
  if (request.reviewedBy !== undefined) serialized.reviewedBy = request.reviewedBy;

  return serialized;
};

const findExistingReturnRequests = async (userId, orderId) => {
  const query = ReturnRequest.find({ userId, orderId });
  if (!query) return null;
  return typeof query.lean === "function" ? query.lean() : query;
};

const cleanupUploadedReturnPhotos = async (files = []) => {
  await Promise.all(
    files.map((file) => fs.promises.unlink(file.path).catch(() => null))
  );
};

const getMyReturnRequests = async (req, res) => {
  try {
    const returnRequests = await ReturnRequest.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ returnRequests: returnRequests.map(serializeReturnRequest) });
  } catch (error) {
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};

const createReturnRequest = async (req, res) => {
  const uploadedFiles = Array.isArray(req.files) ? req.files : [];
  const fail = async (statusCode, payload) => {
    await cleanupUploadedReturnPhotos(uploadedFiles);
    return res.status(statusCode).json(payload);
  };

  try {
    const { orderId, items, itemProductIds, reason } = req.body;
    const requestedItems = normalizeRequestedReturnItems(items, itemProductIds);
    const photoUrls = uploadedFiles.map((file) => `/uploads/return-photos/${file.filename}`);

    const order = await Order.findOne({ _id: orderId, userId: req.user.id, status: "paid" }).lean();
    if (!order) return fail(404, { message: "Order not found" });

    const delivery = await Delivery.findOne({ orderId }).lean();
    if (!delivery || delivery.status !== "delivered") {
      return fail(400, { message: "Returns can only be requested after delivery" });
    }

    if (requestedItems.length === 0) {
      return fail(400, { message: "Select at least one item to return" });
    }

    let refundAmount = 0;
    const processedItems = [];
    const seenProductIds = new Set();
    const existingRequests = await findExistingReturnRequests(req.user.id, orderId) || [];
    const returnedQuantityByProductId = existingRequests
      .filter((request) => request.status !== "rejected")
      .flatMap((request) => request.items || [])
      .reduce((acc, item) => {
        acc[item.productId] = (acc[item.productId] || 0) + Number(item.quantity || 0);
        return acc;
      }, {});

    for (const requestedItem of requestedItems) {
      const requestedProductId = requestedItem.productId;
      const requestedQuantity = Number(requestedItem.quantity);

      if (!requestedProductId) {
        return fail(400, { message: "Each return item must include a product ID" });
      }

      if (seenProductIds.has(requestedProductId)) {
        return fail(400, { message: "Duplicate return items are not allowed" });
      }
      seenProductIds.add(requestedProductId);

      if (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0) {
        return fail(400, { message: "Return quantity must be a positive integer" });
      }

      const orderItem = order.items.find(i => String(i.productId) === requestedProductId);
      if (!orderItem) return fail(400, { message: "Selected return items are not part of this order" });

      if (requestedQuantity > Number(orderItem.quantity)) {
        return fail(400, { message: "Return quantity cannot exceed the ordered quantity" });
      }

      const alreadyReturnedQuantity = returnedQuantityByProductId[requestedProductId] || 0;
      if (alreadyReturnedQuantity + requestedQuantity > Number(orderItem.quantity)) {
        return fail(400, { message: "Return quantity cannot exceed the remaining returnable quantity" });
      }
      
      refundAmount += orderItem.unitPrice * requestedQuantity;
      processedItems.push({ ...orderItem, quantity: requestedQuantity });
    }

    const returnRequest = await ReturnRequest.create({
      userId: req.user.id, orderId, items: processedItems, reason: String(reason || "").trim(), photoUrls, refundAmount,
    });

    return res.status(201).json(returnRequest);
  } catch (error) {
    await cleanupUploadedReturnPhotos(uploadedFiles);
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};

const getPendingReturnRequests = async (req, res) => {
  try {
    const pendingRequests = await ReturnRequest.find({ status: "pending" })
      .populate("userId", "name email")
      .sort({ createdAt: -1 }); 
    return res.status(200).json({ success: true, count: pendingRequests.length, data: pendingRequests });
  } catch (error) {
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};

const rejectReturnRequest = async (req, res) => {
  try {
    const { managerNotes } = req.body;
    const returnReq = await ReturnRequest.findById(req.params.id);

    if (!returnReq || returnReq.status !== "pending") return res.status(400).json({ message: "Invalid request" });

    returnReq.status = "rejected";
    returnReq.managerNotes = managerNotes || "";
    returnReq.resolvedAt = new Date();
    returnReq.reviewedBy = req.user.id;
    await returnReq.save();

    return res.status(200).json({ success: true, data: returnReq });
  } catch (error) {
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};

const approveReturnRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const returnReq = await ReturnRequest.findById(req.params.id).session(session);
    
    // Prevent repeated stock restoration (Acceptance Criteria 3)
    if (!returnReq || returnReq.status !== "pending") {
      return res.status(400).json({ message: "Invalid request or already processed" });
    }

    for (const item of returnReq.items) {
      // 1. Add returned quantity back to stock (Acceptance Criteria 1)
      await Product.findOneAndUpdate(
        { productId: item.productId },
        { $inc: { quantityInStock: item.quantity } },
        { session }
      );

      // 2. NEW: Update order item return status
      // This reaches into the Order's item array and flags the specific product as "returned"
      await Order.findOneAndUpdate(
        { _id: returnReq.orderId, "items.productId": item.productId },
        { $set: { "items.$.status": "returned" } }, 
        { session }
      );
    }

    // Update return request status to approved and store date
    returnReq.status = "approved";
    returnReq.resolvedAt = new Date();
    returnReq.reviewedBy = req.user.id;
    await returnReq.save({ session });

    await session.commitTransaction();
    session.endSession();
    
    return res.status(200).json({ success: true, data: returnReq });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};

const getReturnHistory = async (req, res) => {
  try {
    // Fetch all requests that are NO LONGER pending
    const history = await ReturnRequest.find({ status: { $ne: "pending" } })
      .populate("userId", "name email")
      .sort({ resolvedAt: -1 }); // Newest first

    return res.status(200).json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = {
  getMyReturnRequests, createReturnRequest, getPendingReturnRequests, rejectReturnRequest, approveReturnRequest, getReturnHistory,
};
