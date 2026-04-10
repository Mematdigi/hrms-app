const statusCodes = require("http-status");
const ApiError = require("../utils/ApiError");

const errorConverter = (err, req, res, next) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    // ── Mongoose ValidationError (e.g. required field missing) ──────────────
    if (err.name === "ValidationError") {
      const message = Object.values(err.errors)
        .map((e) => e.message)
        .join("; ");
      error = new ApiError(400, message, false, err.stack);
    }

    // ── Mongoose CastError (bad ObjectId) ────────────────────────────────────
    else if (err.name === "CastError") {
      error = new ApiError(
        400,
        `Invalid value for field "${err.path}"`,
        false,
        err.stack
      );
    }

    // ── Mongoose duplicate key ────────────────────────────────────────────────
    else if (err.code === 11000) {
      const field = Object.keys(err.keyValue || {})[0] || "field";
      error = new ApiError(409, `Duplicate value for ${field}`, false, err.stack);
    }

    // ── JWT errors ────────────────────────────────────────────────────────────
    else if (err.name === "JsonWebTokenError") {
      error = new ApiError(401, "Invalid token", false, err.stack);
    }

    else if (err.name === "TokenExpiredError") {
      error = new ApiError(401, "Token expired", false, err.stack);
    }

    // ── Everything else ───────────────────────────────────────────────────────
    else {
      const statusCode = err.statusCode || statusCodes.INTERNAL_SERVER_ERROR;
      const message = err.message || statusCodes[statusCode];
      error = new ApiError(statusCode, message, false, err.stack);
    }
  }

  next(error);
};

const errorHandler = (err, req, res, next) => {
  let { statusCode, message } = err;

  // ── Guard: statusCode must be a valid HTTP integer (100–599) ──────────────
  // Prevents RangeError crash when an error slips through with no statusCode.
  statusCode = parseInt(statusCode, 10);
  if (isNaN(statusCode) || statusCode < 100 || statusCode > 599) {
    statusCode = 500;
  }

  if (!message) {
    message = statusCodes[statusCode] || "Internal Server Error";
  }

  res.locals.errorMessage = message;

  const response = {
    code: statusCode,
    message,
  };

  res.status(statusCode).send(response);
};

module.exports = {
  errorConverter,
  errorHandler,
};