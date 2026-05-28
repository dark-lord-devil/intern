const supabase = require('../config/supabase');
const { logAudit } = require('../utils/audit');

/**
 * Get active loans for user
 */
async function getLoans(req, res) {
  const userId = req.user.userId;

  try {
    const { data: loans, error } = await supabase
      .from('loans')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      return res.status(500).json({ error: 'Error fetching loans.' });
    }

    res.status(200).json(loans || []);
  } catch (error) {
    console.error('Get loans error:', error.message);
    res.status(500).json({ error: 'Internal server error fetching loans.' });
  }
}

/**
 * Apply for a loan (Disbursed to Wallet)
 */
async function applyLoan(req, res) {
  const userId = req.user.userId;
  const { amount, interestRate, tenureMonths, emiAmount } = req.body;

  const loanAmount = parseFloat(amount);
  const rate = parseFloat(interestRate);
  const tenure = parseInt(tenureMonths);
  const emi = parseFloat(emiAmount);

  if (isNaN(loanAmount) || loanAmount <= 0 || isNaN(rate) || rate <= 0 || isNaN(tenure) || tenure <= 0 || isNaN(emi) || emi <= 0) {
    return res.status(400).json({ error: 'All fields (amount, interestRate, tenureMonths, emiAmount) are required and must be valid positive values.' });
  }

  try {
    // 1. Fetch profile to validate pre-approval threshold
    const { data: profiles, error: profileErr } = await supabase
      .from('profiles')
      .select('financial_health_score')
      .eq('user_id', userId);

    let score = 85;
    if (!profileErr && profiles && profiles.length > 0) {
      score = profiles[0].financial_health_score || 85;
    }

    const maxApproved = score * 15000;
    if (loanAmount > maxApproved) {
      return res.status(400).json({ 
        error: `Requested loan amount (₹${loanAmount.toLocaleString('en-IN')}) exceeds your pre-approved limit of ₹${maxApproved.toLocaleString('en-IN')} based on your credit health score of ${score}.` 
      });
    }

    // 2. Fetch wallet
    const { data: wallets, error: fetchErr } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId);

    if (fetchErr || !wallets || wallets.length === 0) {
      return res.status(404).json({ error: 'User wallet not found.' });
    }

    const wallet = wallets[0];

    // 2. Insert new loan
    const nextEmiDate = new Date();
    nextEmiDate.setMonth(nextEmiDate.getMonth() + 1);

    const { data: newLoan, error: insertErr } = await supabase
      .from('loans')
      .insert([
        {
          user_id: userId,
          amount: loanAmount,
          interest_rate: rate,
          emi_amount: emi,
          tenure_months: tenure,
          remaining_amount: loanAmount,
          status: 'ACTIVE',
          next_emi_date: nextEmiDate.toISOString()
        }
      ])
      .select();

    if (insertErr || !newLoan || newLoan.length === 0) {
      console.error('Loan insert error:', insertErr);
      return res.status(500).json({ error: 'Failed to create loan record.' });
    }

    // 3. Add loan amount to user's wallet
    const newBalance = wallet.balance + loanAmount;
    await supabase
      .from('wallets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', wallet.id);

    // 4. Record transaction in wallet history
    await supabase
      .from('transactions')
      .insert([
        {
          user_id: userId,
          type: 'DEPOSIT',
          amount: loanAmount,
          status: 'COMPLETED',
          category: 'Lending',
          description: `Loan Disbursement - ${tenure} Months at ${rate}%`
        }
      ]);

    // 5. Log audit trail
    await logAudit(req, userId, `LOAN_APPLIED_${loanAmount}`, 'LENDING');

    res.status(201).json({
      message: 'Loan successfully approved and disbursed to wallet.',
      loan: newLoan[0],
      walletBalance: newBalance
    });

  } catch (error) {
    console.error('Apply loan error:', error.message);
    res.status(500).json({ error: 'Internal server error applying for loan.' });
  }
}

/**
 * Repay an EMI (Debited from Wallet)
 */
async function repayLoan(req, res) {
  const userId = req.user.userId;
  const loanId = req.params.id;

  try {
    // 1. Fetch loan
    const { data: loans, error: loanErr } = await supabase
      .from('loans')
      .select('*')
      .eq('id', loanId)
      .eq('user_id', userId);

    if (loanErr || !loans || loans.length === 0) {
      return res.status(404).json({ error: 'Active loan not found.' });
    }

    const loan = loans[0];
    if (loan.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'This loan is already fully repaid.' });
    }

    // 2. Fetch wallet
    const { data: wallets, error: fetchErr } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId);

    if (fetchErr || !wallets || wallets.length === 0) {
      return res.status(404).json({ error: 'Wallet not found.' });
    }

    const wallet = wallets[0];
    const repaymentAmount = Math.min(loan.emi_amount, loan.remaining_amount);

    if (wallet.balance < repaymentAmount) {
      return res.status(400).json({ error: 'Insufficient wallet balance to repay EMI. Please deposit funds first.' });
    }

    // 3. Update wallet balance
    const newBalance = wallet.balance - repaymentAmount;
    await supabase
      .from('wallets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', wallet.id);

    // 4. Update loan details
    const newRemaining = Math.max(0, loan.remaining_amount - repaymentAmount);
    const newStatus = newRemaining === 0 ? 'REPAID' : 'ACTIVE';
    
    const nextEmiDate = new Date(loan.next_emi_date);
    nextEmiDate.setMonth(nextEmiDate.getMonth() + 1);

    const { data: updatedLoan } = await supabase
      .from('loans')
      .update({
        remaining_amount: newRemaining,
        status: newStatus,
        next_emi_date: nextEmiDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', loan.id)
      .select();

    // 5. Add transaction
    await supabase
      .from('transactions')
      .insert([
        {
          user_id: userId,
          type: 'REPAYMENT',
          amount: repaymentAmount,
          status: 'COMPLETED',
          category: 'Lending',
          description: newStatus === 'REPAID' ? 'Final Loan Settlement Repayment' : 'EMI Repayment'
        }
      ]);

    // 6. Log audit
    await logAudit(req, userId, `LOAN_REPAY_${repaymentAmount}_LOAN_${loanId}`, 'LENDING');

    res.status(200).json({
      message: newStatus === 'REPAID' ? 'Loan fully settled!' : 'EMI repayment processed successfully.',
      loan: updatedLoan ? updatedLoan[0] : null,
      walletBalance: newBalance
    });

  } catch (error) {
    console.error('Repay loan error:', error.message);
    res.status(500).json({ error: 'Internal server error processing EMI repayment.' });
  }
}

module.exports = {
  getLoans,
  applyLoan,
  repayLoan
};
