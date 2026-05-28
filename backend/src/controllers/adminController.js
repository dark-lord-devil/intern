const supabase = require('../config/supabase');
const { logAudit } = require('../utils/audit');

/**
 * Get aggregated multi-tenant statistics
 */
async function getAdminStats(req, res) {
  try {
    // 1. Fetch all wallets
    const { data: wallets, error: walletsError } = await supabase
      .from('wallets')
      .select('*');

    // 2. Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*');

    // 3. Fetch all loans
    const { data: loans, error: loansError } = await supabase
      .from('loans')
      .select('*');

    // 4. Fetch all insurance policies
    const { data: policies, error: policiesError } = await supabase
      .from('insurance_policies')
      .select('*');

    // 5. Fetch all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*');

    if (walletsError || profilesError || loansError || policiesError || usersError) {
      console.error('Error fetching admin data:', { walletsError, profilesError, loansError, policiesError, usersError });
      return res.status(500).json({ error: 'Failed to fetch admin stats data.' });
    }

    // Calculations
    const totalPlatformBalance = (wallets || []).reduce((sum, w) => sum + parseFloat(w.balance || 0), 0);
    
    const validScores = (profiles || []).map(p => parseInt(p.financial_health_score || 0)).filter(s => s > 0);
    const avgCreditHealthScore = validScores.length > 0 
      ? Math.round(validScores.reduce((sum, s) => sum + s, 0) / validScores.length)
      : 0;

    const outstandingLoans = (loans || [])
      .filter(l => l.status === 'ACTIVE')
      .reduce((sum, l) => sum + parseFloat(l.remaining_amount || 0), 0);

    const totalInsuranceCoverage = (policies || [])
      .filter(p => p.status === 'ACTIVE')
      .reduce((sum, p) => sum + parseFloat(p.coverage_amount || 0), 0);

    // Build active users list
    const activeUsersList = (users || []).map(u => {
      const profile = (profiles || []).find(p => p.user_id === u.id) || {};
      const wallet = (wallets || []).find(w => w.user_id === u.id) || {};
      return {
        id: u.id,
        email: u.email,
        phone: u.phone,
        full_name: profile.full_name || 'N/A',
        kyc_status: profile.kyc_status || 'Pending',
        is_frozen: !!profile.is_frozen,
        balance: wallet.balance || 0,
        financial_health_score: profile.financial_health_score || 0
      };
    });

    res.status(200).json({
      totalPlatformBalance,
      avgCreditHealthScore,
      outstandingLoans,
      totalInsuranceCoverage,
      activeUsersList
    });
  } catch (error) {
    console.error('Get admin stats error:', error.message);
    res.status(500).json({ error: 'Internal server error computing admin statistics.' });
  }
}

/**
 * Approve or reject user KYC verification
 */
async function verifyKyc(req, res) {
  const adminId = req.user.userId;
  const { targetUserId, kycStatus } = req.body;

  if (!targetUserId || !kycStatus) {
    return res.status(400).json({ error: 'targetUserId and kycStatus are required.' });
  }

  const validStatuses = ['Pending', 'In_Progress', 'Verified', 'Rejected'];
  if (!validStatuses.includes(kycStatus)) {
    return res.status(400).json({ error: `Invalid KYC status. Must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    // Check if target profile exists
    const { data: profiles, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', targetUserId);

    if (fetchError || !profiles || profiles.length === 0) {
      return res.status(404).json({ error: 'Target user profile not found.' });
    }

    // Update KYC status
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ kyc_status: kycStatus, updated_at: new Date().toISOString() })
      .eq('user_id', targetUserId);

    if (updateError) {
      console.error('Error updating KYC:', updateError.message);
      return res.status(500).json({ error: 'Failed to update KYC status.' });
    }

    // Log administrative audit action
    const actionType = `ADMIN_KYC_${kycStatus.toUpperCase()}_FOR_${targetUserId}`;
    await logAudit(req, adminId, actionType, 'ADMIN');

    // Also write a specific audit log for the target user so they see it in their security trail
    await logAudit(req, targetUserId, `KYC_STATUS_UPDATED_TO_${kycStatus.toUpperCase()}_BY_ADMIN`, 'SECURITY');

    // Generate notification for user
    await supabase.from('notifications').insert([
      {
        user_id: targetUserId,
        type: 'ALERT',
        priority: kycStatus === 'Verified' ? 'MEDIUM' : 'HIGH',
        title: `KYC Status: ${kycStatus}`,
        description: kycStatus === 'Verified' 
          ? 'Congratulations! Your profile KYC has been approved. All advanced features are unlocked.'
          : `Your KYC verification is currently ${kycStatus}. Please contact support for details.`,
        is_read: false
      }
    ]);

    res.status(200).json({ success: true, message: `KYC verification status set to ${kycStatus}.` });
  } catch (error) {
    console.error('Verify KYC error:', error.message);
    res.status(500).json({ error: 'Internal server error updating KYC.' });
  }
}

/**
 * Freeze or unfreeze user profile
 */
async function toggleUserFreeze(req, res) {
  const adminId = req.user.userId;
  const { targetUserId, freeze } = req.body;

  if (!targetUserId || freeze === undefined) {
    return res.status(400).json({ error: 'targetUserId and freeze boolean are required.' });
  }

  try {
    // Check if target profile exists
    const { data: profiles, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', targetUserId);

    if (fetchError || !profiles || profiles.length === 0) {
      return res.status(404).json({ error: 'Target user profile not found.' });
    }

    // Update is_frozen status
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ is_frozen: !!freeze, updated_at: new Date().toISOString() })
      .eq('user_id', targetUserId);

    if (updateError) {
      console.error('Error freezing profile:', updateError.message);
      return res.status(500).json({ error: 'Failed to update account freeze state.' });
    }

    // Log administrative audit action
    const actionType = freeze 
      ? `ADMIN_FREEZE_USER_${targetUserId}` 
      : `ADMIN_UNFREEZE_USER_${targetUserId}`;
    await logAudit(req, adminId, actionType, 'ADMIN');

    // Also write a specific audit log for the target user's trail
    await logAudit(req, targetUserId, freeze ? 'ACCOUNT_FROZEN_BY_ADMIN' : 'ACCOUNT_UNFROZEN_BY_ADMIN', 'SECURITY');

    // Generate notification for user
    await supabase.from('notifications').insert([
      {
        user_id: targetUserId,
        type: 'ALERT',
        priority: freeze ? 'CRITICAL' : 'HIGH',
        title: freeze ? 'Account Access Suspended' : 'Account Access Restored',
        description: freeze 
          ? 'Your account has been frozen due to administrative security reviews. Contact support.'
          : 'Your account access has been restored. Thank you for your patience.',
        is_read: false
      }
    ]);

    res.status(200).json({ success: true, message: `Account freeze state set to ${freeze}.` });
  } catch (error) {
    console.error('Toggle freeze error:', error.message);
    res.status(500).json({ error: 'Internal server error updating account freeze status.' });
  }
}

module.exports = {
  getAdminStats,
  verifyKyc,
  toggleUserFreeze
};
