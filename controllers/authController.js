import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sendEmail from '../utils/sendEmail.js';
import { logAudit } from './auditController.js';

// @desc    Auth User & Get Token
// @route   POST /api/auth/login
export const authUser = async (req, res) => {
    const { identifier, password } = req.body; // 'identifier' can be Email OR RegNo

    try {
        // 1. Find User by Email OR Register Number
        const user = await User.findOne({
            $or: [
                { email: identifier },
                { registerNumber: identifier }
            ]
        });

        // 2. Check if User exists and Password matches
        if (user && (await bcrypt.compare(password, user.password))) {

            // Check if account is active
            if (!user.isActive) {
                return res.status(401).json({ message: 'Account is blocked. Contact Admin.' });
            }
            await logAudit(user._id, 'LOGIN', `User ${user.name} logged in`);

            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                registerNumber: user.registerNumber,
                department: user.department,
                role: user.role,
                token: generateToken(user._id),
            });
        } else {
            res.status(401).json({ message: 'Invalid Register Number/Email or Password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Forgot Password - Send OTP
// @route   POST /api/auth/forgot-password
export const forgotPassword = async (req, res) => {
    const { identifier } = req.body; // Email or RegisterNo

    try {
        const user = await User.findOne({
            $or: [{ email: identifier }, { registerNumber: identifier }]
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!user.email) {
            return res.status(400).json({ message: 'No email attached to this account. Contact Admin.' });
        }

        // 1. Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // 2. Save to DB (Valid for 10 mins)
        user.resetPasswordOtp = otp;
        user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
        await user.save();

        // 3. Send Email
        const otpHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 500px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05); text-align: center; }
          .header { background-color: #2c3e50; padding: 30px; }
          .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
          .content { padding: 40px 30px; }
          .otp-box { background-color: #f0f2f5; font-size: 36px; letter-spacing: 8px; font-weight: bold; color: #2c3e50; padding: 20px; margin: 20px 0; border-radius: 8px; border: 1px dashed #ccc; display: inline-block; }
          .message { color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px; }
          .expiry { color: #e74c3c; font-size: 13px; font-weight: bold; }
          .footer { background-color: #f9f9f9; padding: 15px; font-size: 12px; color: #888; border-top: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔒 Password Reset</h1>
          </div>
          <div class="content">
            <p class="message">You requested to reset your library account password. Use the code below to proceed.</p>
            
            <div class="otp-box">${otp}</div>
            
            <p class="expiry">This code is valid for 10 minutes.</p>
            <p style="font-size: 12px; color: #999; margin-top: 30px;">If you did not request this, please ignore this email.</p>
          </div>
          <div class="footer">
            Government Polytechnic, Kampli • Library System
          </div>
        </div>
      </body>
      </html>
    `;

        try {
            await sendEmail({
                email: user.email,
                subject: 'Password Reset OTP - PolyLibrary',
                otp: otp,
                message: `Your OTP is ${otp}`,
                html: otpHtml
            });

            console.log(`OTP for ${user.email}: ${otp}`); // For debugging if email fails
            res.json({ message: `OTP sent to ${user.email}` });

        } catch (error) {
            user.resetPasswordOtp = undefined;
            user.resetPasswordExpires = undefined;
            await user.save();
            return res.status(500).json({ message: 'Email could not be sent. OTP logged in server console.' });
        }

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Reset Password with OTP
// @route   POST /api/auth/reset-password
export const resetPassword = async (req, res) => {
    const { identifier, otp, newPassword } = req.body;

    try {
        const user = await User.findOne({
            $or: [{ email: identifier }, { registerNumber: identifier }],
            resetPasswordOtp: otp,
            resetPasswordExpires: { $gt: Date.now() } // Check expiry
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or Expired OTP' });
        }

        // 1. Hash New Password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);

        // 2. Clear OTP fields
        user.resetPasswordOtp = undefined;
        user.resetPasswordExpires = undefined;
        user.isFirstLogin = false; // Account verified

        await user.save();

        res.json({ message: 'Password Reset Successful! Please Login.' });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

