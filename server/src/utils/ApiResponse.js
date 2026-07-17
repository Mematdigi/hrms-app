
const apiResponse = (message, data = [], code = 200, success = true) => {
  return {
    message,
    data,
    code,
  };
};

module.exports = apiResponse;
