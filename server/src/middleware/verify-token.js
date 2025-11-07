
const statusCodes = require("http-status");
const ApiError = require("../utils/ApiError");
const { tokenService } = require("../services");

const verifyToken = async (req, res, next) => {
  res.lang = req.headers.lang ? req.headers.lang : "en";
  const { authorization } = req.headers;
  console.log('headers -----', authorization);
  if (!authorization) {
    return next(
      new ApiError(
        statusCodes.UNAUTHORIZED,
        statusCodes[statusCodes.UNAUTHORIZED]
      )
    );
  }
  if (!authorization && authorization.split(" ")[0] === "Bearer") {
    return next(
      new ApiError(
        statusCodes.UNAUTHORIZED,
        statusCodes[statusCodes.UNAUTHORIZED]
      )
    );
  }
  const decoded = await tokenService.verifyToken(authorization.split(" ")[1]);
  if (!decoded) {
    return next(
      new ApiError(
        statusCodes.UNAUTHORIZED,
        statusCodes[statusCodes.UNAUTHORIZED]
      )
    );
  }
  console.log('user ------', decoded.id);
  req.userData = {
    mobile_number: decoded.mobile_number,
    first_name: decoded.first_name,
    last_name: decoded.last_name,
    id: decoded.id,
    email: decoded.email,
    profile_picture: decoded.profile_picture,
    device_token: decoded.device_token,
    is_active: decoded.is_active,

    user_type: decoded.user_type,
  };
  next();
};

const verifyOtpToken = async (req, res, next) => {
  res.lang = req.headers.lang ? req.headers.lang : "en";
  const { authorization } = req.headers;
  if (!authorization) {
    return next(
      new ApiError(
        statusCodes.UNAUTHORIZED,
        statusCodes[statusCodes.UNAUTHORIZED]
      )
    );
  }
  if (!authorization && authorization.split(" ")[0] === "Bearer") {
    return next(
      new ApiError(
        statusCodes.UNAUTHORIZED,
        statusCodes[statusCodes.UNAUTHORIZED]
      )
    );
  }
  const decoded = await tokenService.verifyOtpToken(
    authorization.split(" ")[1]
  );
  if (!decoded) {
    return next(
      new ApiError(
        statusCodes.UNAUTHORIZED,
        statusCodes[statusCodes.UNAUTHORIZED]
      )
    );
  }
  // if (!decoded.status) {
  //   return next(new ApiError(statusCodes.UNAUTHORIZED, statusCodes[statusCodes.UNAUTHORIZED]));
  // }
  // console.log(authorization);
  // console.log(decoded);

  req.userData = {
    mobile_number: decoded.mobile_number,
    first_name: decoded.first_name,
    last_name: decoded.last_name,
    id: decoded.id,
    email: decoded.email,
    profile_picture: decoded.profile_picture,
    device_token: decoded.device_token,
    is_active: decoded.is_active,
    experience_level: decoded.experience_level,
    facebook_uid: decoded.facebook_uid,
    google_uid: decoded.google_uid,
    apple_uid: decoded.apple_uid,
    mds_id: decoded.mds_id,
    touchpoint: decoded.touchpoint,
    user_type: decoded.user_type,
    points: decoded.points,
    mindful_days: decoded.mindful_days,
  };
  next();
};

module.exports = { verifyToken, verifyOtpToken };
