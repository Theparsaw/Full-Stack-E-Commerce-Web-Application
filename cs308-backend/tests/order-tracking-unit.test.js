const { serializeOrder, serializeTrackedOrder } = require("../utils/orderTracking");

const createOrder = (overrides = {}) => ({
  _id: "65f0000000000000abcdef12",
  userId: "user-1",
  cartId: "cart-1",
  items: [{ productId: "p001", quantity: 1 }],
  totalPrice: 1299,
  status: "paid",
  paidAt: new Date("2026-01-10T12:00:00.000Z"),
  createdAt: new Date("2026-01-09T12:00:00.000Z"),
  updatedAt: new Date("2026-01-10T12:30:00.000Z"),
  ...overrides,
});

describe("orderTracking utilities", () => {
  test("serializeOrder returns the public order fields", () => {
    const order = createOrder();

    expect(serializeOrder(order)).toEqual({
      id: order._id,
      userId: "user-1",
      cartId: "cart-1",
      items: order.items,
      totalPrice: 1299,
      status: "paid",
      paidAt: order.paidAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    });
  });

  test("serializeTrackedOrder builds a processing timeline by default", () => {
    const tracked = serializeTrackedOrder(createOrder());

    expect(tracked.deliveryStatus).toBe("processing");
    expect(tracked.trackingNumber).toBe("TRK-ABCDEF12");
    expect(tracked.estimatedDeliveryAt).toEqual(new Date("2026-01-15T12:00:00.000Z"));
    expect(tracked.timeline.map((step) => step.state)).toEqual([
      "current",
      "pending",
      "pending",
    ]);
  });

  test("serializeOrder merges duplicate same-product lines for customer order actions", () => {
    const order = createOrder({
      items: [
        { productId: "p001", name: "Keyboard", quantity: 1, unitPrice: 80 },
        { productId: "p001", name: "Keyboard", quantity: 2, unitPrice: 80, returnedQuantity: 1 },
      ],
    });

    expect(serializeOrder(order).items).toEqual([
      {
        productId: "p001",
        name: "Keyboard",
        quantity: 3,
        unitPrice: 80,
        returnedQuantity: 1,
        status: "active",
      },
    ]);
  });

  test("uses valid delivery status from the delivery record", () => {
    const tracked = serializeTrackedOrder(createOrder(), {
      status: "out_for_delivery",
      address: "123 Test Street",
    });

    expect(tracked.deliveryStatus).toBe("out_for_delivery");
    expect(tracked.deliveryAddress).toBe("123 Test Street");
    expect(tracked.timeline.map((step) => step.key)).toEqual([
      "processing",
      "out_for_delivery",
      "delivered",
    ]);
    expect(tracked.timeline.map((step) => step.state)).toEqual([
      "completed",
      "current",
      "pending",
    ]);
  });

  test("builds a cancelled timeline for cancelled orders", () => {
    const order = createOrder({ status: "cancelled", paidAt: null });
    const tracked = serializeTrackedOrder(order);

    expect(tracked.deliveryStatus).toBe("cancelled");
    expect(tracked.estimatedDeliveryAt).toBeNull();
    expect(tracked.timeline).toEqual([
      {
        key: "processing",
        label: "Processing",
        date: order.createdAt,
        state: "completed",
        isLast: false,
      },
      {
        key: "cancelled",
        label: "Cancelled",
        date: new Date("2026-01-10T12:00:00.000Z"),
        state: "current",
        isLast: true,
      },
    ]);
  });
});
