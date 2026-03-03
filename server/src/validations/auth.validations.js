// validators/auth.validation.js
const Joi = require("joi");
const JoiPhoneNumber = Joi.extend(require("joi-phone-number"));

const signUp = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(80).required(),
    email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).required(),
    password: Joi.string()
      .min(8)
      .max(64)
      .pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/) // at least 1 letter & 1 number
      .required()
      .messages({
        "string.pattern.base": "Password must contain at least one letter and one number.",
      }),
    role: Joi.string().valid("Customer", "Agent").required(),
  }),
};




module.exports = { signUp };
