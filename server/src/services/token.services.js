/*
 * Copper Digital Inc
 * Copyright (c) 2023-Present Copper Digital
 * Contact at copper digital dot com
 */
const jwt = require("jsonwebtoken");
const moment = require("moment");
// const { TokenModel } = require("../model/index");

class TokenService {

  generateToken = (user) => {
    return jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
  };

}
module.exports = new TokenService();
