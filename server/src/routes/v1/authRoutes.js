/*
 * Memat Inc
 * Copyright (c) 2025-Present Memat Digi
 * Contact at mematdigi.com
 */

const express = require('express');
const { authController } = require("../../controllers/index");
// const { verifyRestAPIKey } = require('../../middlewares/validate-rest-api-key');
const jwtVerify = require('../../middleware/verify-token');
const router = express.Router();
// const authValidation = require('../../validations/auth.validation');
// const validate = require('../../middlewares/validate');

// Login route
router.post('/login', 
    // validate(authValidation.login), 
authController.login);

// Change Password route
router.post('/register',
    //  verifyRestAPIKey, 
    //  validate(authValidation.register), 
authController.register);

// // Forgot Password route
// router.post('/forgot-password', verifyRestAPIKey, validate(authValidation.forgotPassword), authController.forgotPassword);

// // Reset Password route
// router.post('/reset-password', verifyRestAPIKey, validate(authValidation.resetPassword), jwtVerify.verifyUserToken, authController.resetPassword);

module.exports = router;
