const supabase = require('../config/supabase');

/**
 * Log an audit trail to database.
 * @param {object} req - Express request object.
 * @param {string|null} userId - The user UUID.
 * @param {string} action - Description of the action (e.g. "USER_LOGIN_SUCCESS").
 * @param {string} module - The system module (e.g. "AUTH", "WALLET").
 */
async function logAudit(req, userId, action, module) {
  const ipAddress = req ? (req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || '') : '';
  const deviceInfo = req ? (req.headers['user-agent'] || '') : '';

  console.log(`[AUDIT LOG] Module: ${module} | Action: ${action} | User: ${userId || 'GUEST'} | IP: ${ipAddress}`);

  try {
    const { error } = await supabase.from('audit_logs').insert([
      {
        user_id: userId || null,
        action: action,
        module: module,
        ip_address: ipAddress,
        device_info: deviceInfo
      }
    ]);

    if (error) {
      // Just warn, don't crash the request
      console.warn('Audit Logging: Supabase insert failed. Check if table exists.', error.message);
    }
  } catch (err) {
    console.warn('Audit Logging: Network/Supabase client error:', err.message);
  }
}

module.exports = {
  logAudit
};
