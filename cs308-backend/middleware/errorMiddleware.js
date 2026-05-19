const AppError = require("../utils/appError");

const notFound = (req, res, next) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404, "NOT_FOUND"));
};

const errorHandler = (error, req, res, next) => {
  let statusCode = error.statusCode || 500;
  let code = error.code || "INTERNAL_SERVER_ERROR";

  // Convert Mongoose validation errors into 400 responses
  if (error.name === "ValidationError") {
    statusCode = 400;
    code = "VALIDATION_ERROR";
    error.message = Object.values(error.errors)
      .map((e) => e.message)
      .join(", ");
  }

  // Convert multer upload errors into friendly API responses for the profile form
  if (error.name === "MulterError") {
    statusCode = 400;
    code = error.code || "UPLOAD_ERROR";

    if (error.code === "LIMIT_FILE_SIZE") {
      error.message = "Please choose an image smaller than 2MB";
    }
  }

  if (res.headersSent) {
    return next(error);
  }

  const payload = {
    message: error.message || "Internal server error",
    code,
  };

  if (error.details) {
    payload.details = error.details;
  }

  if (process.env.NODE_ENV !== "production" && !error.isOperational && error.stack) {
    payload.stack = error.stack;
  }

  return res.status(statusCode).json(payload);
};

module.exports = {
  notFound,
  errorHandler,
};
