const supabase = require('../config/supabase');
const { logAudit } = require('../utils/audit');

/**
 * Get active insurance policies for user
 */
async function getPolicies(req, res) {
  const userId = req.user.userId;

  try {
    const { data: policies, error } = await supabase
      .from('insurance_policies')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      return res.status(500).json({ error: 'Error fetching insurance policies.' });
    }

    res.status(200).json(policies || []);
  } catch (error) {
    console.error('Get policies error:', error.message);
    res.status(500).json({ error: 'Internal server error fetching insurance policies.' });
  }
}

/**
 * Buy insurance policy (Premium debited from Wallet)
 */
async function buyPolicy(req, res) {
  const userId = req.user.userId;
  const { policyType, provider, premiumAmount, coverageAmount } = req.body;

  const premium = parseFloat(premiumAmount);
  const coverage = parseFloat(coverageAmount);

  if (!policyType || !provider || isNaN(premium) || premium <= 0 || isNaN(coverage) || coverage <= 0) {
    return res.status(400).json({ error: 'policyType, provider, premiumAmount, and coverageAmount are required valid parameters.' });
  }

  try {
    // 1. Fetch wallet
    const { data: wallets, error: walletErr } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId);

    if (walletErr || !wallets || wallets.length === 0) {
      return res.status(404).json({ error: 'Wallet not found.' });
    }

    const wallet = wallets[0];
    if (wallet.balance < premium) {
      return res.status(400).json({ error: 'Insufficient wallet balance to pay first premium.' });
    }

    // 2. Create policy record
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1); // 1 year term

    const { data: newPolicy, error: insertErr } = await supabase
      .from('insurance_policies')
      .insert([
        {
          user_id: userId,
          policy_type: policyType,
          provider: provider,
          premium_amount: premium,
          coverage_amount: coverage,
          status: 'ACTIVE',
          expiry_date: expiryDate.toISOString()
        }
      ])
      .select();

    if (insertErr || !newPolicy || newPolicy.length === 0) {
      console.error('Insurance insert error:', insertErr);
      return res.status(500).json({ error: 'Failed to create insurance policy record.' });
    }

    // 3. Deduct premium from wallet
    const newBalance = wallet.balance - premium;
    await supabase
      .from('wallets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', wallet.id);

    // 4. Create transaction log
    await supabase
      .from('transactions')
      .insert([
        {
          user_id: userId,
          type: 'PREMIUM',
          amount: premium,
          status: 'COMPLETED',
          category: 'Insurance',
          description: `First Premium - ${provider} ${policyType} Insurance`
        }
      ]);

    // 5. Log audit trail
    await logAudit(req, userId, `INSURANCE_PURCHASED_${policyType}_PREMIUM_${premium}`, 'INSURANCE');

    res.status(201).json({
      message: 'Insurance policy successfully purchased.',
      policy: newPolicy[0],
      walletBalance: newBalance
    });

  } catch (error) {
    console.error('Buy policy error:', error.message);
    res.status(500).json({ error: 'Internal server error processing policy purchase.' });
  }
}

module.exports = {
  getPolicies,
  buyPolicy
};
