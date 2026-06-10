const User = require("../models/User");
const bcrypt = require("bcrypt");
const fs = require("fs/promises");
const path = require("path");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { signAuthToken } = require("../utils/jwt");

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  profileImage: user.profileImage || "",
});

// Return the full profile fields that the profile page needs to display and edit
const sanitizeProfile = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  taxId: user.taxId || "",
  address: user.address || "",
  profileImage: user.profileImage || "",
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

// Remove an old local profile image file when it gets replaced or deleted
const deleteLocalProfileImage = async (imagePath) => {
  if (!imagePath || !imagePath.startsWith("/uploads/")) {
    return;
  }

  const fullPath = path.join(__dirname, "..", imagePath.replace(/^\//, ""));

  try {
    await fs.unlink(fullPath);
  } catch (_error) {
    // Ignore missing-file cleanup errors so profile updates still succeed
  }
};

const register = asyncHandler(async (req, res) => {
  const { name, email, password, taxId, address } = req.body;

  if (!name || !email || !password) {
    throw new AppError("Please provide name, email, and password", 400, "VALIDATION_ERROR");
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError("Email already in use", 400, "EMAIL_ALREADY_EXISTS");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    taxId,
    address,
    role: "customer",
  });

  const token = signAuthToken({ id: user._id, role: user.role });

  res.status(201).json({
    token,
    user: sanitizeUser(user),
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError("Please provide email and password", 400, "VALIDATION_ERROR");
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  const token = signAuthToken({ id: user._id, role: user.role });

  res.status(200).json({
    token,
    user: sanitizeUser(user),
  });
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  res.status(200).json({
    user: sanitizeProfile(user),
  });
});

// Update the logged-in user's editable profile fields
const updateCurrentUser = asyncHandler(async (req, res) => {
  // Multipart requests can reach this handler with an empty body object,
  // so default to {} before reading the submitted text fields.
  const { name, taxId, address, removeProfileImage } = req.body || {};

  // The profile page only allows these three fields to be edited
  if (!name || !taxId || !address) {
    throw new AppError(
      "Please provide name, tax ID, and address",
      400,
      "VALIDATION_ERROR"
    );
  }

  const user = await User.findById(req.user.id);

  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  user.name = name.trim();
  user.taxId = taxId.trim();
  user.address = address.trim();

  // Remove the old file if the user deletes the photo or uploads a replacement
  if (removeProfileImage === "true" && user.profileImage) {
    await deleteLocalProfileImage(user.profileImage);
    user.profileImage = "";
  }

  if (req.file) {
    if (user.profileImage) {
      await deleteLocalProfileImage(user.profileImage);
    }

    user.profileImage = `/uploads/profile-images/${req.file.filename}`;
  }

  await user.save();

  res.status(200).json({
    message: "Profile updated successfully",
    user: sanitizeProfile(user),
  });
});

const changeCurrentUserPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    throw new AppError(
      "Please provide current password and new password",
      400,
      "VALIDATION_ERROR"
    );
  }

  if (newPassword.length < 6) {
    throw new AppError(
      "New password must be at least 6 characters",
      400,
      "VALIDATION_ERROR"
    );
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
  if (!isCurrentPasswordValid) {
    throw new AppError("Current password is incorrect", 401, "INVALID_PASSWORD");
  }

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  res.status(200).json({ message: "Password changed successfully" });
});

module.exports = {
  register,
  login,
  getCurrentUser,
  updateCurrentUser,
  changeCurrentUserPassword,
};
