const twilioConfig = require('../config/twilio');
let twilioClient = null;

if (twilioConfig.accountSid && twilioConfig.authToken) {
  try {
    const twilio = require('twilio');
    twilioClient = twilio(twilioConfig.accountSid, twilioConfig.authToken);
    console.log('SMS Service: Twilio client initialized successfully.');
  } catch (error) {
    console.error('SMS Service: Failed to initialize Twilio client:', error.message);
  }
} else {
  console.log('SMS Service: No Twilio credentials provided. Falling back to MOCK mode.');
}

/**
 * Send an OTP SMS to a phone number.
 * @param {string} phone - Target phone number.
 * @param {string} otp - The numeric OTP code.
 * @returns {Promise<boolean>}
 */
async function sendOtp(phone, otp) {
  const messageBody = `Your E-Faws verification code is: ${otp}. Valid for 5 minutes.`;

  if (twilioClient && twilioConfig.phoneNumber) {
    try {
      await twilioClient.messages.create({
        body: messageBody,
        from: twilioConfig.phoneNumber,
        to: phone
      });
      console.log(`SMS Service: Sent live OTP SMS to ${phone}`);
      return true;
    } catch (error) {
      console.error(`SMS Service: Error sending SMS to ${phone}:`, error.message);
      // Fallback: log to console so developers can see the code if Twilio fails
      console.log(`[MOCK FALLBACK] OTP for ${phone}: ${otp}`);
      return true;
    }
  } else {
    console.log(`[MOCK SMS] OTP sent to ${phone} -> Message: "${messageBody}"`);
    return true;
  }
}

module.exports = {
  sendOtp
};
