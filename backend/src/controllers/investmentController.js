const supabase = require('../config/supabase');
const { logAudit } = require('../utils/audit');

/**
 * Get investments portfolio for user
 */
async function getInvestments(req, res) {
  const userId = req.user.userId;

  try {
    const { data: investments, error } = await supabase
      .from('investments')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      return res.status(500).json({ error: 'Error fetching investments.' });
    }

    res.status(200).json(investments || []);
  } catch (error) {
    console.error('Get investments error:', error.message);
    res.status(500).json({ error: 'Internal server error fetching investments.' });
  }
}

/**
 * Buy investment asset (Debited from Wallet)
 */
async function buyInvestment(req, res) {
  const userId = req.user.userId;
  const { portfolioType, amount } = req.body;

  const investAmount = parseFloat(amount);
  if (!portfolioType || isNaN(investAmount) || investAmount <= 0) {
    return res.status(400).json({ error: 'portfolioType and a valid positive amount are required.' });
  }

  // Validate allowed categories
  const allowedTypes = ['Mutual Funds', 'Stocks', 'Gold', 'Fixed Deposits'];
  if (!allowedTypes.includes(portfolioType)) {
    return res.status(400).json({ error: `Invalid portfolioType. Allowed: ${allowedTypes.join(', ')}` });
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
    if (wallet.balance < investAmount) {
      return res.status(400).json({ error: 'Insufficient wallet balance to make this investment.' });
    }

    // 2. Fetch existing investment of this type
    const { data: existingInv } = await supabase
      .from('investments')
      .select('*')
      .eq('user_id', userId)
      .eq('portfolio_type', portfolioType);

    let updatedInv;

    if (existingInv && existingInv.length > 0) {
      const inv = existingInv[0];
      const newInvested = inv.invested_amount + investAmount;
      const newCurrent = inv.current_value + investAmount;
      const newReturn = parseFloat((((newCurrent - newInvested) / newInvested) * 100).toFixed(2));

      const { data } = await supabase
        .from('investments')
        .update({
          invested_amount: newInvested,
          current_value: newCurrent,
          return_percentage: isNaN(newReturn) ? 0 : newReturn,
          updated_at: new Date().toISOString()
        })
        .eq('id', inv.id)
        .select();
      
      updatedInv = data ? data[0] : null;
    } else {
      const { data } = await supabase
        .from('investments')
        .insert([
          {
            user_id: userId,
            portfolio_type: portfolioType,
            invested_amount: investAmount,
            current_value: investAmount,
            return_percentage: 0.00,
            updated_at: new Date().toISOString()
          }
        ])
        .select();

      updatedInv = data ? data[0] : null;
    }

    // 3. Deduct amount from wallet balance
    const newBalance = wallet.balance - investAmount;
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
          type: 'INVESTMENT',
          amount: investAmount,
          status: 'COMPLETED',
          category: 'Investment',
          description: `Investment purchase - ${portfolioType}`
        }
      ]);

    // 5. Log audit trail
    await logAudit(req, userId, `INVESTMENT_PURCHASED_${investAmount}_TYPE_${portfolioType}`, 'INVESTMENT');

    res.status(200).json({
      message: 'Investment purchased successfully.',
      investment: updatedInv,
      walletBalance: newBalance
    });

  } catch (error) {
    console.error('Buy investment error:', error.message);
    res.status(500).json({ error: 'Internal server error processing investment purchase.' });
  }
}

module.exports = {
  getInvestments,
  buyInvestment
};
