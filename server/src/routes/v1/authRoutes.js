/*
 * Memat Inc
 * Copyright (c) 2025-Present Memat Digi
 * Contact at mematdigi.com
 */
const express = require('express');
const { authController } = require("../../controllers/index");
// const { verifyRestAPIKey } = require('../../middlewares/validate-rest-api-key');
const jwtVerify = require('../../middleware/verify-token');
const { authMiddleware } = require('../../middleware/auth');
const { blockMobile } = require('../../middleware/deviceCheck'); // ← FIX: destructure karo
const router = express.Router();
// const authValidation = require('../../validations/auth.validation');
// const validate = require('../../middlewares/validate');

// Login route
router.post('/login', blockMobile,
    // validate(authValidation.login), 
authController.login);

// Change Password route
router.post('/register', blockMobile,
    //  verifyRestAPIKey, 
    //  validate(authValidation.register), 
authController.register);

// Get user profile (protected route)
router.get('/profile', authMiddleware, authController.getProfile);

// // Forgot Password route
// router.post('/forgot-password', verifyRestAPIKey, validate(authValidation.forgotPassword), authController.forgotPassword);

// // Reset Password route
// router.post('/reset-password', verifyRestAPIKey, validate(authValidation.resetPassword), jwtVerify.verifyUserToken, authController.resetPassword);

module.exports = router;