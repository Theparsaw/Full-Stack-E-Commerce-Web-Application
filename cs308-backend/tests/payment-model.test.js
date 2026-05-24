const Payment = require("../models/Payment");

describe("Payment model", () => {
  test("accepts refunded status for completed payments that must be reversed", () => {
    const payment = new Payment({
      orderId: "order-1",
      userId: "user-1",
      amount: 120,
      status: "refunded",
      cardLast4: "4242",
      transactionId: "TXN-1",
      message: "Payment refunded due to stock concurrency error",
    });

    expect(payment.validateSync()).toBeUndefined();
  });
});
