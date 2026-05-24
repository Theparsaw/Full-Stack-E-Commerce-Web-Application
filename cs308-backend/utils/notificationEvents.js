const clientsByUserId = new Map();

const sendEvent = (res, event, data) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

const addNotificationClient = (userId, res) => {
  const normalizedUserId = String(userId);
  const clients = clientsByUserId.get(normalizedUserId) || new Set();

  clients.add(res);
  clientsByUserId.set(normalizedUserId, clients);

  sendEvent(res, "connected", { ok: true });

  return () => {
    clients.delete(res);

    if (clients.size === 0) {
      clientsByUserId.delete(normalizedUserId);
    }
  };
};

const publishNotification = (notification) => {
  if (!notification) {
    return;
  }

  const payload =
    typeof notification.toObject === "function"
      ? notification.toObject()
      : notification;
  const clients = clientsByUserId.get(String(payload.userId));

  if (!clients || clients.size === 0) {
    return;
  }

  for (const client of clients) {
    sendEvent(client, "notification", payload);
  }
};

module.exports = {
  addNotificationClient,
  publishNotification,
};
