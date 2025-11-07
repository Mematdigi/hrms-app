

const apiSuccess = (message, data = null, code = 200, success = true) => {
  return {
    message,
    data,
    code,
    success,
  };
};

module.exports = apiSuccess;
