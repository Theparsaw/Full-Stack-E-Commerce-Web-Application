const addDays = (dateValue, days) => {
  const date = new Date(dateValue);
  date.setDate(date.getDate() + days);
  return date;
};

const VALID_DELIVERY_STATUSES = [
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

const getDeliveryStatus = (order, delivery = null) => {
  const deliveryStatus = delivery?.status;

  if (VALID_DELIVERY_STATUSES.includes(deliveryStatus)) {
    return deliveryStatus;
  }

  if (order.status === "cancelled") {
    return "cancelled";
  }

  if (order.status !== "paid") {
    return "processing";
  }

  return "processing";
};

const buildNormalTimeline = (order, deliveryStatus) => {
  const baseDate = order.paidAt || order.createdAt;

  const steps = [
    {
      key: "processing",
      label: "Processing",
      date: baseDate,
    },
    {
      key: "out_for_delivery",
      label: "In transit",
      date: addDays(baseDate, 3),
    },
    {
      key: "delivered",
      label: "Delivered",
      date: addDays(baseDate, 5),
    },
  ];

  const timelineStatus =
    deliveryStatus === "shipped" ? "out_for_delivery" : deliveryStatus;
  const currentIndex = steps.findIndex((step) => step.key === timelineStatus);

  return steps.map((step, index) => ({
    ...step,
    state:
      index < currentIndex
        ? "completed"
        : index === currentIndex
          ? "current"
          : "pending",
    isLast: index === steps.length - 1,
  }));
};

const buildCancelledTimeline = (order) => {
  const baseDate = order.paidAt || order.createdAt;

  const steps = [
    {
      key: "processing",
      label: "Processing",
      date: baseDate,
      state: "completed",
      isLast: false,
    },
    {
      key: "cancelled",
      label: "Cancelled",
      date: addDays(baseDate, 1),
      state: "current",
      isLast: true,
    },
  ];

  return steps;
};

const buildTimeline = (order, delivery = null) => {
  const deliveryStatus = getDeliveryStatus(order, delivery);

  if (deliveryStatus === "cancelled") {
    return buildCancelledTimeline(order);
  }

  return buildNormalTimeline(order, deliveryStatus);
};

const getEstimatedDeliveryAt = (order, deliveryStatus) => {
  const baseDate = order.paidAt || order.createdAt;

  if (deliveryStatus === "delivered") {
    return addDays(baseDate, 5);
  }

  if (deliveryStatus === "out_for_delivery") {
    return addDays(baseDate, 5);
  }

  if (deliveryStatus === "shipped") {
    return addDays(baseDate, 5);
  }

  if (deliveryStatus === "cancelled") {
    return null;
  }

  return addDays(baseDate, 5);
};

const mergeOrderItemsByProductId = (items = []) => {
  const itemsByProductId = new Map();

  for (const item of items) {
    const itemObject = typeof item.toObject === "function" ? item.toObject() : item;
    const productId = String(itemObject.productId || "").trim();
    if (!productId) continue;

    const existingItem = itemsByProductId.get(productId);
    const quantity = Number(itemObject.quantity || 0);
    const returnedQuantity = Number(itemObject.returnedQuantity || 0);

    if (existingItem) {
      existingItem.quantity += quantity;
      existingItem.returnedQuantity = Number(existingItem.returnedQuantity || 0) + returnedQuantity;
      if (existingItem.returnedQuantity > 0 || itemObject.returnedQuantity !== undefined) {
        existingItem.status = existingItem.returnedQuantity >= existingItem.quantity ? "returned" : "active";
      }
      continue;
    }

    const mergedItem = {
      ...itemObject,
      productId,
      quantity,
    };

    if (itemObject.returnedQuantity !== undefined) {
      mergedItem.returnedQuantity = returnedQuantity;
      mergedItem.status = returnedQuantity >= quantity ? "returned" : itemObject.status;
    }

    itemsByProductId.set(productId, mergedItem);
  }

  return Array.from(itemsByProductId.values());
};

const serializeOrder = (order) => {
  const orderObject = typeof order.toObject === "function" ? order.toObject() : order;

  return {
    id: orderObject._id,
    userId: orderObject.userId,
    cartId: orderObject.cartId,
    items: mergeOrderItemsByProductId(orderObject.items),
    totalPrice: orderObject.totalPrice,
    status: orderObject.status,
    paidAt: orderObject.paidAt,
    createdAt: orderObject.createdAt,
    updatedAt: orderObject.updatedAt,
  };
};

const serializeTrackedOrder = (order, delivery = null) => {
  const baseOrder = serializeOrder(order);
  const deliveryStatus = getDeliveryStatus(order, delivery);
  const timeline = buildTimeline(order, delivery);

  return {
    ...baseOrder,
    deliveryStatus,
    deliveryAddress: delivery?.address || null,
    trackingNumber: `TRK-${String(order._id).slice(-8).toUpperCase()}`,
    estimatedDeliveryAt: getEstimatedDeliveryAt(order, deliveryStatus),
    timeline,
  };
};

module.exports = {
  mergeOrderItemsByProductId,
  serializeOrder,
  serializeTrackedOrder,
};
