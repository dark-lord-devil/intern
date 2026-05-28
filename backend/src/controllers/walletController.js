const supabase = require('../config/supabase');
const { logAudit } = require('../utils/audit');

/**
 * Get user wallet details
 */
async function getWallet(req, res) {
  const userId = req.user.userId;

  try {
    const { data: wallets, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId);

    if (error || !wallets || wallets.length === 0) {
      return res.status(404).json({ error: 'Wallet not found for this user.' });
    }

    res.status(200).json(wallets[0]);
  } catch (error) {
    console.error('Get wallet error:', error.message);
    res.status(500).json({ error: 'Internal server error fetching wallet details.' });
  }
}

/**
 * Get user transactions list
 */
async function getTransactions(req, res) {
  const userId = req.user.userId;
  const { search, category } = req.query;

  try {
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      return res.status(500).json({ error: 'Error fetching transaction history.' });
    }

    let filtered = transactions || [];

    if (category) {
      filtered = filtered.filter(t => t.category && t.category.toLowerCase() === category.toLowerCase());
    }

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(t => 
        (t.description && t.description.toLowerCase().includes(q)) || 
        (t.type && t.type.toLowerCase().includes(q)) ||
        (t.category && t.category.toLowerCase().includes(q))
      );
    }

    // Sort transactions by date descending
    const sorted = filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.status(200).json(sorted);
  } catch (error) {
    console.error('Get transactions error:', error.message);
    res.status(500).json({ error: 'Internal server error fetching transactions.' });
  }
}

/**
 * Mock Deposit funds
 */
async function deposit(req, res) {
  const userId = req.user.userId;
  const { amount, description } = req.body;

  const depositAmount = parseFloat(amount);
  if (isNaN(depositAmount) || depositAmount <= 0) {
    return res.status(400).json({ error: 'Invalid deposit amount.' });
  }

  try {
    // 1. Fetch wallet
    const { data: wallets, error: fetchErr } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId);

    if (fetchErr || !wallets || wallets.length === 0) {
      return res.status(404).json({ error: 'Wallet not found.' });
    }

    const wallet = wallets[0];
    const newBalance = wallet.balance + depositAmount;

    // 2. Update wallet balance
    const { error: updateErr } = await supabase
      .from('wallets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', wallet.id);

    if (updateErr) {
      return res.status(500).json({ error: 'Failed to update wallet balance.' });
    }

    // 3. Log transaction
    const { data: newTx } = await supabase
      .from('transactions')
      .insert([
        {
          user_id: userId,
          type: 'DEPOSIT',
          amount: depositAmount,
          status: 'COMPLETED',
          category: 'Deposit',
          description: description || 'Funds Deposited'
        }
      ])
      .select();

    // 4. Log audit trail
    await logAudit(req, userId, `WALLET_DEPOSIT_${depositAmount}`, 'WALLET');

    res.status(200).json({
      message: 'Deposit successful.',
      balance: newBalance,
      transaction: newTx ? newTx[0] : null
    });

  } catch (error) {
    console.error('Deposit error:', error.message);
    res.status(500).json({ error: 'Internal server error processing deposit.' });
  }
}

/**
 * Mock Withdraw funds
 */
async function withdraw(req, res) {
  const userId = req.user.userId;
  const { amount, description } = req.body;

  const withdrawAmount = parseFloat(amount);
  if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
    return res.status(400).json({ error: 'Invalid withdrawal amount.' });
  }

  try {
    // 1. Fetch wallet
    const { data: wallets, error: fetchErr } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId);

    if (fetchErr || !wallets || wallets.length === 0) {
      return res.status(404).json({ error: 'Wallet not found.' });
    }

    const wallet = wallets[0];

    if (wallet.balance < withdrawAmount) {
      return res.status(400).json({ error: 'Insufficient wallet balance.' });
    }

    const newBalance = wallet.balance - withdrawAmount;

    // 2. Update wallet balance
    const { error: updateErr } = await supabase
      .from('wallets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', wallet.id);

    if (updateErr) {
      return res.status(500).json({ error: 'Failed to update wallet balance.' });
    }

    // 3. Log transaction
    const { data: newTx } = await supabase
      .from('transactions')
      .insert([
        {
          user_id: userId,
          type: 'WITHDRAW',
          amount: withdrawAmount,
          status: 'COMPLETED',
          category: 'Withdrawal',
          description: description || 'Funds Withdrawn to Bank'
        }
      ])
      .select();

    // 4. Log audit trail
    await logAudit(req, userId, `WALLET_WITHDRAW_${withdrawAmount}`, 'WALLET');

    res.status(200).json({
      message: 'Withdrawal successful.',
      balance: newBalance,
      transaction: newTx ? newTx[0] : null
    });

  } catch (error) {
    console.error('Withdrawal error:', error.message);
    res.status(500).json({ error: 'Internal server error processing withdrawal.' });
  }
}

/**
 * Mock Transfer / Send money
 */
async function transfer(req, res) {
  const userId = req.user.userId;
  const { amount, method, recipient, notes } = req.body;

  const transferAmount = parseFloat(amount);
  if (isNaN(transferAmount) || transferAmount <= 0) {
    return res.status(400).json({ error: 'Invalid transfer amount.' });
  }

  if (!recipient) {
    return res.status(400).json({ error: 'Recipient identifier is required.' });
  }

  try {
    // 1. Fetch wallet
    const { data: wallets, error: fetchErr } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId);

    if (fetchErr || !wallets || wallets.length === 0) {
      return res.status(404).json({ error: 'Wallet not found.' });
    }

    const wallet = wallets[0];

    if (wallet.balance < transferAmount) {
      return res.status(400).json({ error: 'Insufficient wallet balance.' });
    }

    const newBalance = wallet.balance - transferAmount;

    // 2. Update wallet balance
    const { error: updateErr } = await supabase
      .from('wallets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', wallet.id);

    if (updateErr) {
      return res.status(500).json({ error: 'Failed to update wallet balance.' });
    }

    // 3. Log transaction
    const desc = notes ? `UPI Transfer to ${recipient}: ${notes}` : `UPI Transfer to ${recipient}`;
    const { data: newTx } = await supabase
      .from('transactions')
      .insert([
        {
          user_id: userId,
          type: 'WITHDRAW',
          amount: transferAmount,
          status: 'COMPLETED',
          category: 'Transfer',
          description: desc
        }
      ])
      .select();

    // 4. Log audit trail
    await logAudit(req, userId, `WALLET_TRANSFER_${transferAmount}_TO_${recipient}`, 'WALLET');

    res.status(200).json({
      message: 'Transfer successful.',
      balance: newBalance,
      transaction: newTx ? newTx[0] : null
    });

  } catch (error) {
    console.error('Transfer error:', error.message);
    res.status(500).json({ error: 'Internal server error processing transfer.' });
  }
}

module.exports = {
  getWallet,
  getTransactions,
  deposit,
  withdraw,
  transfer
};
