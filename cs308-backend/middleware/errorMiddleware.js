const AppError = require("../utils/appError");

const notFound = (req, res, next) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404, "NOT_FOUND"));
};

const errorHandler = (error, req, res, next) => {
  let statusCode = error.statusCode || 500;
  let code = error.code || "INTERNAL_SERVER_ERROR";
  let message = error.message || "Internal server error";

  // Convert Mongoose validation errors into 400 responses
  if (error.name === "ValidationError") {
    statusCode = 400;
    code = "VALIDATION_ERROR";
    message = Object.values(error.errors)
      .map((e) => e.message)
      .join(", ");
  }

  // Convert Mongoose CastError (invalid ObjectId) into 400
  if (error.name === "CastError") {
    statusCode = 400;
    code = "INVALID_ID";
    message = `Invalid value for field: ${error.path}`;
  }

  // Convert MongoDB duplicate key error into 400
  if (error.code === 11000) {
    statusCode = 400;
    code = "DUPLICATE_KEY";
    const field = Object.keys(error.keyValue || {})[0] || "field";
    message = `A record with this ${field} already exists`;
  }

  // Convert multer upload errors into friendly API responses for the profile form
  if (error.name === "MulterError") {
    statusCode = 400;
    code = error.code || "UPLOAD_ERROR";
    if (error.code === "LIMIT_FILE_SIZE") {
      message = "Please choose an image smaller than 2MB";
    }
  }

  if (res.headersSent) {
    return next(error);
  }

  const payload = {
    message,
    code,
  };

  if (error.details) {
    payload.details = error.details;
  }

  // Only expose stack traces in development, never in production
  if (process.env.NODE_ENV === "development" && error.stack) {
    payload.stack = error.stack;
  }

  return res.status(statusCode).json(payload);
};

module.exports = {
  notFound,
  errorHandler,
};
