const supabase = require('../config/supabase');
const { logAudit } = require('../utils/audit');

// Local fallback health score calculator matching FastAPI logic
function calculateLocalHealthScore(metrics) {
  const surplus = metrics.monthly_income - metrics.monthly_expenses - metrics.existing_loan_emis;
  let score;
  if (surplus < 0) {
    score = Math.round(metrics.credit_score * 0.6);
  } else {
    const ratio = surplus / metrics.monthly_income;
    score = Math.round((metrics.credit_score * 0.7) + (ratio * 100 * 3));
  }
  score = Math.min(Math.max(score, 30), 100);
  return {
    financial_health_score: score,
    classification: score > 80 ? 'Excellent' : (score > 60 ? 'Good' : 'Requires Review'),
    calculated_at: new Date().toISOString(),
    source: 'Local Fallback Engine'
  };
}

// Local fallback recommendations matching FastAPI format
const defaultRecommendations = [
  {
    id: "rec_01",
    title: "Portfolio Rebalance Alert",
    description: "Your cash exposure is 15% above target. Moving 5% to stable investment options will optimize returns.",
    category: "INVESTMENT",
    action_text: "Rebalance Portfolio",
    confidence: 0.88
  },
  {
    id: "rec_02",
    title: "Subscription Optimizer",
    description: "You have 3 inactive streaming subscriptions charging $45/mo. Cancel to increase monthly savings.",
    category: "SPENDING",
    action_text: "Manage Subscriptions",
    confidence: 0.92
  },
  {
    id: "rec_03",
    title: "Lending Rate Upgrade",
    description: "Your financial health score has reached 82, unlocking a 1.5% interest rate reduction on personal loans.",
    category: "LENDING",
    action_text: "View Pre-Approved Offers",
    confidence: 0.95
  }
];

/**
 * Get and update User Financial Health Score
 */
async function getHealthScore(req, res) {
  const userId = req.user.userId;

  try {
    // 1. Gather user data from database
    const { data: profiles } = await supabase.from('profiles').select('*').eq('user_id', userId);
    const { data: wallets } = await supabase.from('wallets').select('*').eq('user_id', userId);
    const { data: loans } = await supabase.from('loans').select('*').eq('user_id', userId);
    const { data: investments } = await supabase.from('investments').select('*').eq('user_id', userId);

    const profile = profiles && profiles.length > 0 ? profiles[0] : {};
    const walletBalance = wallets && wallets.length > 0 ? wallets[0].balance : 0;
    
    // Sum active loan EMIs
    const activeLoans = (loans || []).filter(l => l.status === 'ACTIVE');
    const totalEmis = activeLoans.reduce((sum, l) => sum + l.emi_amount, 0);

    // Sum investments current value
    const totalInvestments = (investments || []).reduce((sum, inv) => sum + inv.current_value, 0);

    // Calculate investments breakdown
    const stocksVal = (investments || [])
      .filter(i => i.portfolio_type.toLowerCase() === 'stocks')
      .reduce((sum, i) => sum + parseFloat(i.current_value || 0), 0);
    const goldVal = (investments || [])
      .filter(i => i.portfolio_type.toLowerCase() === 'gold')
      .reduce((sum, i) => sum + parseFloat(i.current_value || 0), 0);
    const fundsVal = (investments || [])
      .filter(i => i.portfolio_type.toLowerCase() === 'mutual funds' || i.portfolio_type.toLowerCase() === 'fixed deposits')
      .reduce((sum, i) => sum + parseFloat(i.current_value || 0), 0);

    // Build payload parameters
    const scoringPayload = {
      user_id: userId,
      monthly_income: 250000.00, // Seed income or standard baseline
      monthly_expenses: 60000.00, // Standard baseline expenses
      existing_loan_emis: totalEmis,
      credit_score: 750, // Default baseline credit score
      asset_valuation: totalInvestments + walletBalance,
      stocks_value: stocksVal,
      gold_value: goldVal,
      cash_value: walletBalance,
      funds_value: fundsVal
    };

    let result;

    try {
      // Contact FastAPI Service on port 8000
      const response = await fetch('http://localhost:8000/api/v1/scoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scoringPayload)
      });

      if (response.ok) {
        result = await response.json();
        result.source = 'FastAPI Microservice';
      } else {
        throw new Error(`FastAPI returned status: ${response.status}`);
      }
    } catch (apiError) {
      console.warn('FastAPI scoring offline. Using local health score calculator. Reason:', apiError.message);
      result = calculateLocalHealthScore(scoringPayload);
    }

    // 2. Update financial_health_score in profiles table
    await supabase
      .from('profiles')
      .update({
        financial_health_score: result.financial_health_score,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    // 3. Log audit trail
    await logAudit(req, userId, `HEALTH_SCORE_CALCULATED_${result.financial_health_score}`, 'ANALYTICS');

    res.status(200).json({
      metrics: scoringPayload,
      score: result.financial_health_score,
      classification: result.classification,
      calculatedAt: result.calculated_at,
      source: result.source,
      suggestions: result.suggestions || []
    });

  } catch (error) {
    console.error('Scoring error:', error.message);
    res.status(500).json({ error: 'Internal server error computing financial health score.' });
  }
}

/**
 * Get AI Financial Recommendations
 */
async function getRecommendations(req, res) {
  const userId = req.user.userId;

  try {
    let recommendations = [];

    try {
      // Contact FastAPI Service
      const response = await fetch(`http://localhost:8000/api/v1/recommendations/${userId}`);
      if (response.ok) {
        recommendations = await response.json();
      } else {
        throw new Error(`FastAPI returned status: ${response.status}`);
      }
    } catch (apiError) {
      console.warn('FastAPI recommendations offline. Checking DB for seeded recommendations. Reason:', apiError.message);
      
      const { data: dbRecs } = await supabase
        .from('ai_recommendations')
        .select('*')
        .eq('user_id', userId);

      if (dbRecs && dbRecs.length > 0) {
        recommendations = dbRecs;
      } else {
        recommendations = defaultRecommendations.map(r => ({ ...r, user_id: userId }));
      }
    }

    res.status(200).json(recommendations);
  } catch (error) {
    console.error('Recommendations error:', error.message);
    res.status(500).json({ error: 'Internal server error fetching AI recommendations.' });
  }
}

/**
 * Get user goals
 */
async function getGoals(req, res) {
  const userId = req.user.userId;
  try {
    const { data: goals, error } = await supabase
      .from('user_goals')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching goals:', error.message);
      return res.status(500).json({ error: 'Failed to retrieve goals.' });
    }

    res.status(200).json(goals || []);
  } catch (error) {
    console.error('Get goals error:', error.message);
    res.status(500).json({ error: 'Internal server error fetching goals.' });
  }
}

/**
 * Create a user goal
 */
async function createGoal(req, res) {
  const userId = req.user.userId;
  const { name, targetAmount, category, deadline } = req.body;

  if (!name || !targetAmount || !category) {
    return res.status(400).json({ error: 'Name, targetAmount, and category are required.' });
  }

  try {
    const { data, error } = await supabase
      .from('user_goals')
      .insert([
        {
          user_id: userId,
          name: name,
          target_amount: parseFloat(targetAmount),
          current_amount: 0.00,
          category: category,
          deadline: deadline || null
        }
      ]);

    if (error) {
      console.error('Error creating goal:', error.message);
      return res.status(500).json({ error: 'Failed to create goal.' });
    }

    res.status(201).json({ success: true, message: 'Goal created successfully.' });
  } catch (error) {
    console.error('Create goal error:', error.message);
    res.status(500).json({ error: 'Internal server error creating goal.' });
  }
}

/**
 * Contribute/allocate money to a goal
 */
async function contributeToGoal(req, res) {
  const userId = req.user.userId;
  const goalId = req.params.id;
  const { amount } = req.body;

  if (!amount || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Valid contribution amount is required.' });
  }

  try {
    // 1. Fetch current goal status
    const { data: goals, error: fetchError } = await supabase
      .from('user_goals')
      .select('*')
      .eq('id', goalId)
      .eq('user_id', userId);

    if (fetchError || !goals || goals.length === 0) {
      return res.status(404).json({ error: 'Goal not found.' });
    }

    const goal = goals[0];

    // 2. Fetch wallet to verify and debit balance
    const { data: wallets, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId);

    if (walletError || !wallets || wallets.length === 0) {
      return res.status(404).json({ error: 'Wallet not found.' });
    }

    const wallet = wallets[0];
    const contrib = parseFloat(amount);
    const balance = parseFloat(wallet.balance || 0);

    if (balance < contrib) {
      return res.status(400).json({ error: 'Insufficient wallet balance to contribute to goal.' });
    }

    // 3. Update wallet balance
    const newBalance = balance - contrib;
    const { error: walletUpdateErr } = await supabase
      .from('wallets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (walletUpdateErr) {
      console.error('Error debiting wallet for goal:', walletUpdateErr.message);
      return res.status(500).json({ error: 'Failed to debit wallet balance.' });
    }

    // 4. Create transaction log
    await supabase.from('transactions').insert([
      {
        user_id: userId,
        type: 'INVESTMENT',
        amount: contrib,
        status: 'COMPLETED',
        category: 'Goals Allocation',
        description: `Allocated funds to goal: ${goal.name}`
      }
    ]);

    // 5. Update goal
    const newAmount = parseFloat(goal.current_amount || 0) + contrib;
    const { error: updateError } = await supabase
      .from('user_goals')
      .update({ current_amount: newAmount, updated_at: new Date().toISOString() })
      .eq('id', goalId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating goal:', updateError.message);
      // Rollback wallet balance (best effort)
      await supabase.from('wallets').update({ balance: balance }).eq('user_id', userId);
      return res.status(500).json({ error: 'Failed to update goal.' });
    }

    // Log contribution
    await logAudit(req, userId, `CONTRIBUTE_${amount}_TO_GOAL_${goalId}`, 'ANALYTICS');

    res.status(200).json({ success: true, message: 'Contribution added successfully.', current_amount: newAmount, wallet_balance: newBalance });
  } catch (error) {
    console.error('Contribute to goal error:', error.message);
    res.status(500).json({ error: 'Internal server error contributing to goal.' });
  }
}

module.exports = {
  getHealthScore,
  getRecommendations,
  getGoals,
  createGoal,
  contributeToGoal
};
