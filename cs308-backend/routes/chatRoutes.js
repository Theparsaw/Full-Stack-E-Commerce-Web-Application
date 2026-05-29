const express = require("express");
const multer = require("multer");
const path = require("path");
const { authMiddleware, authorize } = require("../middleware/authMiddleware");
const {
  startConversation,
  getMyConversation,
  sendMessage,
  getMessages,
  getUnclaimedConversations,
  getMyAgentConversations,
  claimConversation,
  getCustomerContext,
  closeConversation,
} = require("../controllers/chatController");

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads/chat-attachments"));
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/gif"];
    cb(null, allowed.includes(file.mimetype));
  },
});

// Customer routes
router.post("/", authMiddleware, authorize("customer"), startConversation);
router.get("/my", authMiddleware, authorize("customer"), getMyConversation);
router.post("/:conversationId/messages", authMiddleware, upload.single("attachment"), sendMessage);
router.get("/:conversationId/messages", authMiddleware, getMessages);
router.patch("/:conversationId/close", authMiddleware, closeConversation);

// Support agent routes
router.get("/unclaimed", authMiddleware, authorize("support_agent"), getUnclaimedConversations);
router.get("/agent/my", authMiddleware, authorize("support_agent"), getMyAgentConversations);
router.patch("/:conversationId/claim", authMiddleware, authorize("support_agent"), claimConversation);
router.get("/:conversationId/context", authMiddleware, authorize("support_agent"), getCustomerContext);

module.exports = router;
