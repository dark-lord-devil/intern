const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { generateToken } = require('../utils/jwt');
const { sendOtp } = require('../services/sms');
const { logAudit } = require('../utils/audit');

/**
 * Generate a random 6-digit verification code.
 */
function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * User Registration.
 */
async function register(req, res) {
  const { email, phone, password, fullName } = req.body;

  if (!email || !phone || !password || !fullName) {
    return res.status(400).json({ error: 'All fields (email, phone, password, fullName) are required.' });
  }

  try {
    // 1. Check if user already exists
    const { data: users, error: checkError } = await supabase
      .from('users')
      .select('id, email, phone')
      .or(`email.eq.${email},phone.eq.${phone}`);

    if (checkError) {
      console.error('Supabase query error during check:', checkError.message);
    }

    if (users && users.length > 0) {
      const matched = users[0];
      const conflictType = matched.email === email ? 'Email' : 'Phone number';
      return res.status(400).json({ error: `${conflictType} is already registered.` });
    }

    // 2. Hash Password
    const passwordHash = await bcrypt.hash(password, 10);

    // 3. Generate OTP
    const otp = generateOtpCode();
    const otpExpires = new Date();
    otpExpires.setMinutes(otpExpires.getMinutes() + 5); // 5 minutes validity

    // 4. Create unverified User in DB
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([
        {
          email,
          phone,
          password_hash: passwordHash,
          is_verified: false,
          otp_code: otp,
          otp_expires_at: otpExpires.toISOString()
        }
      ])
      .select();

    if (insertError || !newUser || newUser.length === 0) {
      console.error('Registration insertion error:', insertError);
      return res.status(500).json({ error: 'Failed to create user record. Please verify database table config.' });
    }

    const createdUser = newUser[0];

    // 5. Create basic profile placeholder (marked Pending Verification)
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          user_id: createdUser.id,
          full_name: fullName,
          kyc_status: 'Pending',
          risk_profile: 'Balanced Strategy',
          financial_health_score: 0
        }
      ]);

    if (profileError) {
      console.warn('Registration: Profile row insertion warning:', profileError.message);
    }

    // 6. Send OTP via Twilio / Mock SMS
    await sendOtp(phone, otp);

    // 7. Write Audit Log
    await logAudit(req, createdUser.id, 'USER_REGISTER_INITIATED', 'AUTH');

    res.status(201).json({
      message: 'Registration successful. OTP sent to phone number.',
      phone: phone
    });

  } catch (error) {
    console.error('Registration error:', error.message);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
}

/**
 * OTP Code Verification.
 */
async function verifyOtp(req, res) {
  const { phone, otpCode } = req.body;

  if (!phone || !otpCode) {
    return res.status(400).json({ error: 'Phone number and OTP code are required.' });
  }

  try {
    // 1. Fetch user by phone
    const { data: userRecords, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone);

    if (fetchError || !userRecords || userRecords.length === 0) {
      return res.status(404).json({ error: 'User record not found for this phone number.' });
    }

    const user = userRecords[0];
    console.log(`[DEBUG OTP] Incoming Phone: "${phone}", Incoming OTP: "${otpCode}"`);
    console.log(`[DEBUG OTP] DB User Phone: "${user.phone}", DB User OTP: "${user.otp_code}"`);

    // 2. Validate OTP
    if (user.otp_code !== otpCode) {
      await logAudit(req, user.id, 'OTP_VERIFICATION_FAILED_INVALID_CODE', 'AUTH');
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    // 3. Check Expiry
    if (new Date(user.otp_expires_at) < new Date()) {
      await logAudit(req, user.id, 'OTP_VERIFICATION_FAILED_EXPIRED', 'AUTH');
      return res.status(400).json({ error: 'Verification code has expired.' });
    }

    // 4. Mark user as verified, clear OTP code
    const { error: updateError } = await supabase
      .from('users')
      .update({
        is_verified: true,
        otp_code: null,
        otp_expires_at: null
      })
      .eq('id', user.id);

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update verification status.' });
    }

    // 5. Create user wallet if it doesn't already exist
    const { data: existingWallet } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', user.id);

    if (!existingWallet || existingWallet.length === 0) {
      const { error: walletError } = await supabase
        .from('wallets')
        .insert([
          {
            user_id: user.id,
            balance: 0.00,
            currency: 'INR'
          }
        ]);

      if (walletError) {
        console.warn('Wallet creation failed or row already exists:', walletError.message);
      }
    }

    // 6. Log success audit trail
    await logAudit(req, user.id, 'USER_OTP_VERIFIED_SUCCESS', 'AUTH');

    // 7. Generate JWT
    const token = generateToken({
      userId: user.id,
      email: user.email,
      phone: user.phone
    });

    res.status(200).json({
      message: 'Account successfully verified.',
      token: token
    });

  } catch (error) {
    console.error('OTP Verification error:', error.message);
    res.status(500).json({ error: 'Internal server error during verification.' });
  }
}

/**
 * User Login.
 */
async function login(req, res) {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Email/Phone and Password are required.' });
  }

  try {
    // 1. Fetch user by email OR phone
    const { data: userRecords, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .or(`email.eq.${identifier},phone.eq.${identifier}`);

    if (fetchError || !userRecords || userRecords.length === 0) {
      return res.status(401).json({ error: 'Invalid email/phone or password.' });
    }

    const user = userRecords[0];

    // 2. Validate Password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      await logAudit(req, user.id, 'USER_LOGIN_FAILED_WRONG_PASSWORD', 'AUTH');
      return res.status(401).json({ error: 'Invalid email/phone or password.' });
    }

    // 3. Handle non-verified status (trigger new OTP flow)
    if (!user.is_verified) {
      const otp = generateOtpCode();
      const otpExpires = new Date();
      otpExpires.setMinutes(otpExpires.getMinutes() + 5);

      await supabase
        .from('users')
        .update({
          otp_code: otp,
          otp_expires_at: otpExpires.toISOString()
        })
        .eq('id', user.id);

      await sendOtp(user.phone, otp);
      await logAudit(req, user.id, 'LOGIN_UNVERIFIED_OTP_SENT', 'AUTH');

      return res.status(202).json({
        message: 'Account phone number is not verified yet. Verification code sent.',
        phone: user.phone,
        requiresVerification: true
      });
    }

    // 4. Write audit log
    await logAudit(req, user.id, 'USER_LOGIN_SUCCESS', 'AUTH');

    // 5. Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      phone: user.phone
    });

    res.status(200).json({
      message: 'Login successful.',
      token: token
    });

  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
}

/**
 * Account Recovery / Forgot Password (Initiate).
 */
async function forgotPassword(req, res) {
  const { identifier } = req.body;

  if (!identifier) {
    return res.status(400).json({ error: 'Email or phone number is required.' });
  }

  try {
    const { data: userRecords } = await supabase
      .from('users')
      .select('*')
      .or(`email.eq.${identifier},phone.eq.${identifier}`);

    if (!userRecords || userRecords.length === 0) {
      // Return success response to avoid email harvesting
      return res.status(200).json({ message: 'If account exists, recovery code has been sent.' });
    }

    const user = userRecords[0];

    const otp = generateOtpCode();
    const otpExpires = new Date();
    otpExpires.setMinutes(otpExpires.getMinutes() + 10); // 10 minutes for reset

    await supabase
      .from('users')
      .update({
        otp_code: otp,
        otp_expires_at: otpExpires.toISOString()
      })
      .eq('id', user.id);

    await sendOtp(user.phone, otp);
    await logAudit(req, user.id, 'PASSWORD_RECOVERY_INITIATED', 'AUTH');

    res.status(200).json({
      message: 'Recovery code sent to your registered phone number.',
      phone: user.phone
    });

  } catch (error) {
    console.error('Forgot password error:', error.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * Complete Password Reset.
 */
async function resetPassword(req, res) {
  const { phone, otpCode, newPassword } = req.body;

  if (!phone || !otpCode || !newPassword) {
    return res.status(400).json({ error: 'Phone, OTP code, and new password are required.' });
  }

  try {
    const { data: userRecords } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone);

    if (!userRecords || userRecords.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = userRecords[0];

    if (user.otp_code !== otpCode || new Date(user.otp_expires_at) < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired recovery code.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await supabase
      .from('users')
      .update({
        password_hash: passwordHash,
        otp_code: null,
        otp_expires_at: null
      })
      .eq('id', user.id);

    await logAudit(req, user.id, 'PASSWORD_RESET_SUCCESS', 'AUTH');

    res.status(200).json({ message: 'Password reset successful. You can now login.' });

  } catch (error) {
    console.error('Password reset error:', error.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * Get User Profile
 */
async function getProfile(req, res) {
  const userId = req.user.userId;
  try {
    const { data: userRecords } = await supabase.from('users').select('id, email, phone').eq('id', userId);
    const { data: profiles } = await supabase.from('profiles').select('*').eq('user_id', userId);
    if (!userRecords || userRecords.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const profile = profiles && profiles.length > 0 ? profiles[0] : {};
    res.status(200).json({
      id: userRecords[0].id,
      email: userRecords[0].email,
      phone: userRecords[0].phone,
      full_name: profile.full_name || '',
      kyc_status: profile.kyc_status || 'Pending',
      is_frozen: !!profile.is_frozen,
      financial_health_score: profile.financial_health_score || 0
    });
  } catch (error) {
    console.error('Get profile error:', error.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = {
  register,
  verifyOtp,
  login,
  forgotPassword,
  resetPassword,
  getProfile
};
