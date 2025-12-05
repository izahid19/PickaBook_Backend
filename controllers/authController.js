const jwt = require('jsonwebtoken');
const Brevo = require('@getbrevo/brevo');
const User = require('../models/User');
const Otp = require('../models/Otp');

// Setup Brevo
const apiInstance = new Brevo.TransactionalEmailsApi();
apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

// In-memory store for email cooldowns (in production, use Redis)
const emailCooldowns = new Map();

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Check if email is on cooldown
const checkEmailCooldown = (email) => {
  const lastRequest = emailCooldowns.get(email.toLowerCase());
  if (lastRequest) {
    const timeSince = Date.now() - lastRequest;
    const cooldownMs = 2 * 60 * 1000; // 2 minutes
    if (timeSince < cooldownMs) {
      return Math.ceil((cooldownMs - timeSince) / 1000); // seconds remaining
    }
  }
  return 0;
};

// Set email cooldown
const setEmailCooldown = (email) => {
  emailCooldowns.set(email.toLowerCase(), Date.now());
};

// Send OTP email
const sendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check email cooldown
    const cooldownRemaining = checkEmailCooldown(email);
    if (cooldownRemaining > 0) {
      return res.status(429).json({ 
        error: 'Please wait before requesting another OTP',
        cooldownSeconds: cooldownRemaining 
      });
    }

    // Generate OTP
    const otp = generateOTP();

    // Delete any existing OTPs for this email
    await Otp.deleteMany({ email: email.toLowerCase() });

    // Save new OTP
    await Otp.create({ email: email.toLowerCase(), otp });

    // Set cooldown for this email
    setEmailCooldown(email);

    // Send email via Brevo
    const sendSmtpEmail = new Brevo.SendSmtpEmail();
    sendSmtpEmail.subject = 'Your Pickabook Login OTP';
    sendSmtpEmail.sender = { 
      name: process.env.FROM_NAME, 
      email: process.env.FROM_EMAIL 
    };
    sendSmtpEmail.to = [{ email: email }];
    sendSmtpEmail.htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #F97316;">🎨 Pickabook Magic</h2>
        <p>Your one-time password (OTP) for login is:</p>
        <div style="background: linear-gradient(135deg, #F97316, #EA580C); color: white; font-size: 32px; font-weight: bold; padding: 20px 40px; border-radius: 12px; text-align: center; letter-spacing: 8px; margin: 20px 0;">
          ${otp}
        </div>
        <p style="color: #666; font-size: 14px;">This OTP is valid for 10 minutes. Do not share it with anyone.</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">If you didn't request this, please ignore this email.</p>
      </div>
    `;

    await apiInstance.sendTransacEmail(sendSmtpEmail);

    res.json({ 
      message: 'OTP sent successfully', 
      email: email.toLowerCase(),
      cooldownSeconds: 120 // 2 minutes
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: 'Failed to send OTP', details: error.message });
  }
};

// Verify OTP and login/register
const verifyOtp = async (req, res) => {
  try {
    const { email, otp, username } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    // Find OTP
    const otpRecord = await Otp.findOne({ 
      email: email.toLowerCase(), 
      otp 
    });

    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Delete the used OTP
    await Otp.deleteOne({ _id: otpRecord._id });

    // Find or create user
    let user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Create new user
      user = await User.create({
        email: email.toLowerCase(),
        username: username || email.split('@')[0],
        userType: 1,
        credits: 10
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        userType: user.userType,
        credits: user.credits
      }
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Failed to verify OTP', details: error.message });
  }
};

// Get current user
const getCurrentUser = async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        userType: req.user.userType,
        credits: req.user.credits
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
};

// Admin: Get all users
const getAllUsers = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.userType !== 2) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const users = await User.find({}).select('-__v').sort({ createdAt: -1 });
    
    res.json({
      users: users.map(user => ({
        id: user._id,
        username: user.username,
        email: user.email,
        userType: user.userType,
        credits: user.credits,
        createdAt: user.createdAt
      }))
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
};

// Admin: Update user credits
const updateUserCredits = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.userType !== 2) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { credits } = req.body;
    const { userId } = req.params;

    if (credits === undefined || credits < 0) {
      return res.status(400).json({ error: 'Valid credits value required' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { credits: parseInt(credits) },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Credits updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        credits: user.credits
      }
    });
  } catch (error) {
    console.error('Update credits error:', error);
    res.status(500).json({ error: 'Failed to update credits' });
  }
};

module.exports = {
  sendOtp,
  verifyOtp,
  getCurrentUser,
  getAllUsers,
  updateUserCredits
};
