const fs = require("fs");
const path = require("path");
const multer = require("multer");
const AppError = require("../utils/appError");

const profileUploadsDir = path.join(__dirname, "..", "uploads", "profile-images");
const returnUploadsDir = path.join(__dirname, "..", "uploads", "return-photos");

// Make sure the upload folder exists before multer tries to write files into it
fs.mkdirSync(profileUploadsDir, { recursive: true });
fs.mkdirSync(returnUploadsDir, { recursive: true });

const createImageStorage = (uploadsDir, prefix) => multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const safeExtension = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    cb(null, `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExtension}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new AppError("Please upload a valid image file", 400, "INVALID_FILE_TYPE"));
  }

  return cb(null, true);
};

const uploadProfilePhoto = multer({
  storage: createImageStorage(profileUploadsDir, "profile"),
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});

const uploadReturnPhotos = multer({
  storage: createImageStorage(returnUploadsDir, "return"),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },
});

const uploadProductImage = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

module.exports = {
  uploadProfilePhoto,
  uploadReturnPhotos,
  uploadProductImage,
};
