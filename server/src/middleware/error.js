
const statusCodes = require("http-status");
const ApiError = require("../utils/ApiError");

const errorConverter = (err, req, res, next) => {
  let error = err;
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || statusCodes.INTERNAL_SERVER_ERROR;
    const message = error.message || statusCodes[statusCode];
    error = new ApiError(statusCode, message, false, err.stack);
  }
  next(error);
};

const errorHandler = (err, req, res, next) => {
  let { statusCode, message } = err;

console.log(err)
  res.locals.errorMessage = err.message;

  const response = {
    code: statusCode,
    message,
  };
console.log(statusCode)
  res.status(statusCode).send(response);
};

module.exports = {
  errorConverter,
  errorHandler
};
