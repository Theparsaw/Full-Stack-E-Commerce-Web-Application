const ChatConversation = require("../models/ChatConversation");
const ChatMessage = require("../models/ChatMessage");
const Order = require("../models/Order");
const Delivery = require("../models/Delivery");
const Wishlist = require("../models/Wishlist");
const User = require("../models/User");

// ── Customer: start a new conversation ───────────────────────────────────────
const startConversation = async (req, res) => {
  try {
    const { subject } = req.body;

    // Check if customer already has an open conversation
    const existing = await ChatConversation.findOne({
      customerId: req.user.id,
      status: { $in: ["unclaimed", "active"] },
    });

    if (existing) {
      return res.status(200).json({ conversation: existing });
    }

    const conversation = await ChatConversation.create({
      customerId: req.user.id,
      subject: subject || "Support Request",
    });

    return res.status(201).json({ conversation });
  } catch (error) {
    return res.status(500).json({ message: "Failed to start conversation", error: error.message });
  }
};

// ── Customer: get their active conversation ───────────────────────────────────
const getMyConversation = async (req, res) => {
  try {
    const conversation = await ChatConversation.findOne({
      customerId: req.user.id,
      status: { $in: ["unclaimed", "active"] },
    });

    return res.status(200).json({ conversation: conversation || null });
  } catch (error) {
    return res.status(500).json({ message: "Failed to get conversation", error: error.message });
  }
};

// ── Send a message (customer or agent) ───────────────────────────────────────
const sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { text } = req.body;

    const conversation = await ChatConversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Only conversation participants can send messages
    const isCustomer = String(conversation.customerId) === String(req.user.id);
    const isAgent =
      req.user.role === "support_agent" &&
      (conversation.agentId === null ||
        String(conversation.agentId) === String(req.user.id));

    if (!isCustomer && !isAgent) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (conversation.status === "closed") {
      return res.status(400).json({ message: "Conversation is closed" });
    }

    const user = await User.findById(req.user.id).select("name");

    let attachmentUrl = null;
    let attachmentName = null;

    if (req.file) {
      attachmentUrl = `/chat-attachments/${req.file.filename}`;
      attachmentName = req.file.originalname;
    }

    if (!text && !attachmentUrl) {
      return res.status(400).json({ message: "Message text or attachment is required" });
    }

    const message = await ChatMessage.create({
      conversationId,
      senderId: req.user.id,
      senderRole: req.user.role,
      senderName: user?.name || req.user.role,
      text: text || "",
      attachmentUrl,
      attachmentName,
    });

    return res.status(201).json({ message });
  } catch (error) {
    return res.status(500).json({ message: "Failed to send message", error: error.message });
  }
};

// ── Get messages for a conversation ──────────────────────────────────────────
const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await ChatConversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const isCustomer = conversation.customerId === req.user.id;
    const isAgent = req.user.role === "support_agent";

    if (!isCustomer && !isAgent) {
      return res.status(403).json({ message: "Access denied" });
    }

    const messages = await ChatMessage.find({ conversationId }).sort({ createdAt: 1 });
    return res.status(200).json({ messages });
  } catch (error) {
    return res.status(500).json({ message: "Failed to get messages", error: error.message });
  }
};

// ── Agent: get all unclaimed conversations ────────────────────────────────────
const getUnclaimedConversations = async (req, res) => {
  try {
    const conversations = await ChatConversation.find({ status: "unclaimed" })
      .sort({ createdAt: 1 });

    // Enrich with customer name
    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const customer = await User.findById(conv.customerId).select("name email");
        return {
          ...conv.toObject(),
          customerName: customer?.name || "Unknown",
          customerEmail: customer?.email || "",
        };
      })
    );

    return res.status(200).json({ conversations: enriched });
  } catch (error) {
    return res.status(500).json({ message: "Failed to get conversations", error: error.message });
  }
};

// ── Agent: get all their active conversations ─────────────────────────────────
const getMyAgentConversations = async (req, res) => {
  try {
    const conversations = await ChatConversation.find({
      agentId: req.user.id,
      status: "active",
    }).sort({ updatedAt: -1 });

    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const customer = await User.findById(conv.customerId).select("name email");
        return {
          ...conv.toObject(),
          customerName: customer?.name || "Unknown",
          customerEmail: customer?.email || "",
        };
      })
    );

    return res.status(200).json({ conversations: enriched });
  } catch (error) {
    return res.status(500).json({ message: "Failed to get conversations", error: error.message });
  }
};

// ── Agent: claim a conversation ───────────────────────────────────────────────
const claimConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await ChatConversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (conversation.status !== "unclaimed") {
      return res.status(400).json({ message: "Conversation already claimed" });
    }

    conversation.agentId = req.user.id;
    conversation.status = "active";
    await conversation.save();

    const customer = await User.findById(conversation.customerId).select("name email");

    return res.status(200).json({
      conversation: {
        ...conversation.toObject(),
        customerName: customer?.name || "Unknown",
        customerEmail: customer?.email || "",
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to claim conversation", error: error.message });
  }
};

// ── Agent: get customer context (orders, deliveries, wishlist) ────────────────
const getCustomerContext = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await ChatConversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (conversation.agentId !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const customerId = conversation.customerId;

    const [orders, deliveries, wishlist, customer] = await Promise.all([
      Order.find({ userId: customerId }).sort({ createdAt: -1 }).limit(5).lean(),
      Delivery.find({ userId: customerId }).sort({ createdAt: -1 }).limit(5).lean(),
      Wishlist.findOne({ userId: customerId }).lean(),
      User.findById(customerId).select("name email address taxId").lean(),
    ]);

    return res.status(200).json({
      customer,
      orders,
      deliveries,
      wishlistItems: wishlist?.items || [],
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to get customer context", error: error.message });
  }
};

// ── Close conversation ────────────────────────────────────────────────────────
const closeConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await ChatConversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const isAgent = conversation.agentId === req.user.id;
    const isCustomer = conversation.customerId === req.user.id;

    if (!isAgent && !isCustomer) {
      return res.status(403).json({ message: "Access denied" });
    }

    conversation.status = "closed";
    await conversation.save();

    return res.status(200).json({ message: "Conversation closed" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to close conversation", error: error.message });
  }
};

module.exports = {
  startConversation,
  getMyConversation,
  sendMessage,
  getMessages,
  getUnclaimedConversations,
  getMyAgentConversations,
  claimConversation,
  getCustomerContext,
  closeConversation,
};
