/*
 * Memat Digi Inc.
 * www.mematdigi.com
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const apiResponse = require('../utils/ApiResponse');
const catchAsync = require('../utils/catchAsync');
const {
  tokenService,
} = require("../services");
const ApiError = require('../utils/ApiError');

class AuthController {

  register = catchAsync(async (req, res) => {
    const { firstName, lastName, email, password, role } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json(apiResponse(400, "Missing required fields"));
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json(apiResponse(400, "Email already exists"));
    }

    // const hashedPassword = await bcrypt.hash(password, 10);
      let lastEmployee = await User.findOne().sort({ employeeId: -1 })
      
      if(lastEmployee == null){
        lastEmployee = 1;
      }else 
      {
       lastEmployee = lastEmployee.employeeId
      }


    const nextEmployeeId = lastEmployee  ? parseInt(lastEmployee, 10) + 1 : 1; // Increment by 1 or start from 1
const employeeId = nextEmployeeId
console.log("employeeId",employeeId)
  console.log("lastEmployee",lastEmployee)
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role: role || 'employee',
      employeeId
    });

    const token = tokenService.generateToken(user);

    return res.status(200).json(apiResponse("User registered successfully", {
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName
      }
    }));
  });

  // 🔹 Login existing user
  login = catchAsync(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
           throw new ApiError(400, "Missing credentials");
    }
    const user = await User.findOne({ email });
    if (!user) {
     throw new ApiError(401, "Invalid credentials");
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
     throw new ApiError(401, "Invalid credentials");
    }
    const token = tokenService.generateToken(user);
    return res.status(200).json(apiResponse("Login successful", {
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName
      }
    }));
  });

  // 🔹 Get logged-in user's profile
  getProfile = catchAsync(async (req, res) => {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json(apiResponse(404, "User not found"));
    }

    return res.status(200).json(apiResponse(200, "User profile fetched successfully", user));
  });

}

module.exports = new AuthController();
