const express = require("express");
const {
  register,
  login,
  getCurrentUser,
  updateCurrentUser,
  changeCurrentUserPassword,
} = require("../controllers/authController");
const { authMiddleware } = require("../middleware/authMiddleware");
const { uploadProfilePhoto } = require("../middleware/uploadMiddleware");
const router = express.Router();

router.post("/register", register);
router.post("/login", login);

// Return the current logged-in user's profile information
router.get("/me", authMiddleware, getCurrentUser);

// Save profile changes for the currently logged-in user
router.put("/me", authMiddleware, uploadProfilePhoto.single("profileImage"), updateCurrentUser);
router.put("/me/password", authMiddleware, changeCurrentUserPassword);

module.exports = router;
