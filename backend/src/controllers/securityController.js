const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { logAudit } = require('../utils/audit');

/**
 * Get active sessions for the authenticated user
 */
async function getSessions(req, res) {
  const userId = req.user.userId;

  try {
    const { data: sessions, error } = await supabase
      .from('active_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching sessions:', error.message);
      return res.status(500).json({ error: 'Failed to retrieve active sessions.' });
    }

    res.status(200).json(sessions || []);
  } catch (error) {
    console.error('Get sessions error:', error.message);
    res.status(500).json({ error: 'Internal server error fetching sessions.' });
  }
}

/**
 * Revoke an active session
 */
async function revokeSession(req, res) {
  const userId = req.user.userId;
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required.' });
  }

  try {
    const { data, error } = await supabase
      .from('active_sessions')
      .update({ is_active: false })
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error revoking session:', error.message);
      return res.status(500).json({ error: 'Failed to revoke session.' });
    }

    // Log the revocation event
    await logAudit(req, userId, `REVOKE_SESSION_${sessionId}`, 'SECURITY');

    res.status(200).json({ success: true, message: 'Session successfully revoked.' });
  } catch (error) {
    console.error('Revoke session error:', error.message);
    res.status(500).json({ error: 'Internal server error revoking session.' });
  }
}

/**
 * Get audit logs for the authenticated user
 */
async function getAuditLogs(req, res) {
  const userId = req.user.userId;

  try {
    const { data: logs, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching audit logs:', error.message);
      return res.status(500).json({ error: 'Failed to retrieve audit logs.' });
    }

    // Sort by created_at desc (newest first)
    const sorted = (logs || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.status(200).json(sorted);
  } catch (error) {
    console.error('Get audit logs error:', error.message);
    res.status(500).json({ error: 'Internal server error fetching audit logs.' });
  }
}

/**
 * Change account password
 */
async function changePassword(req, res) {
  const userId = req.user.userId;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Both current password and new password are required.' });
  }

  try {
    // 1. Fetch user record to check password
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId);

    if (userError || !users || users.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = users[0];

    // 2. Validate current password
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect current password.' });
    }

    // 3. Hash the new password
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    // 4. Update password in the database
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: newHash })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating password:', updateError.message);
      return res.status(500).json({ error: 'Failed to update password.' });
    }

    // 5. Log password change audit
    await logAudit(req, userId, 'PASSWORD_CHANGE_SUCCESS', 'SECURITY');

    res.status(200).json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error.message);
    res.status(500).json({ error: 'Internal server error changing password.' });
  }
}

module.exports = {
  getSessions,
  revokeSession,
  getAuditLogs,
  changePassword
};
