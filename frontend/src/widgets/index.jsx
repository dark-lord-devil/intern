import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';

const API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:5000' : '';

// Helper to get authorization header
function getAuthHeader() {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// ----------------------------------------------------
// WIDGET 1: Net Worth Growth (Area Chart)
// ----------------------------------------------------
function NetWorthGrowthWidget() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalNetWorth, setTotalNetWorth] = useState(0);
  const [quarterGrowth, setQuarterGrowth] = useState(0);

  useEffect(() => {
    async function fetchData() {
      try {
        const [walletRes, invRes] = await Promise.all([
          fetch(`${API_BASE}/api/v1/wallet`, { headers: getAuthHeader() }),
          fetch(`${API_BASE}/api/v1/investments`, { headers: getAuthHeader() })
        ]);

        if (walletRes.ok && invRes.ok) {
          const wallet = await walletRes.json();
          const investments = await invRes.json();

          const cash = wallet.balance || 0;
          const portfolioVal = investments.reduce((sum, inv) => sum + inv.current_value, 0);
          const currentTotal = cash + portfolioVal;

          setTotalNetWorth(currentTotal);

          // Construct mock history scaled to their current net worth
          const base = currentTotal * 0.85;
          const step = (currentTotal - base) / 5;
          
          const history = [
            { name: 'JAN', value: Math.round(base) },
            { name: 'MAR', value: Math.round(base + step * 1) },
            { name: 'MAY', value: Math.round(base + step * 2) },
            { name: 'JUL', value: Math.round(base + step * 3) },
            { name: 'SEP', value: Math.round(base + step * 4) },
            { name: 'NOV', value: Math.round(currentTotal) }
          ];

          setData(history);
          setQuarterGrowth(Math.round(currentTotal - base));
        }
      } catch (err) {
        console.error('Error fetching net worth growth details:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-40 w-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  const formatLakhs = (val) => {
    if (val >= 100000) {
      return `₹${(val / 100000).toFixed(2)}L`;
    }
    return `₹${val.toLocaleString('en-IN')}`;
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="font-card-title text-on-surface text-lg font-bold">Net Worth Growth</h3>
          <p className="text-outline text-sm">Cumulative portfolio performance</p>
        </div>
        <div className="text-right">
          <span className="font-financial-display text-primary text-2xl font-bold block">
            {formatLakhs(totalNetWorth)}
          </span>
          <span className="text-success text-xs font-bold flex items-center justify-end">
            <span className="material-symbols-outlined text-sm mr-1">trending_up</span>
            +{formatLakhs(quarterGrowth)} this quarter
          </span>
        </div>
      </div>
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#004ac6" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#004ac6" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#737686', fontSize: 11 }} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={formatLakhs} tick={{ fill: '#737686', fontSize: 9 }} />
            <Tooltip 
              formatter={(value) => [`₹${value.toLocaleString('en-IN')}`, 'Net Worth']}
              contentStyle={{ background: '#131A2E', border: 'none', borderRadius: '8px', color: '#fff' }}
            />
            <Area type="monotone" dataKey="value" stroke="#004ac6" strokeWidth={3} fillOpacity={1} fill="url(#colorNetWorth)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// WIDGET 2: Financial Health Score (Circular Ring)
// ----------------------------------------------------
function HealthScoreWidget() {
  const [score, setScore] = useState(85);
  const [classification, setClassification] = useState('Excellent');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchScore() {
      try {
        const res = await fetch(`${API_BASE}/api/v1/analytics/score`, { headers: getAuthHeader() });
        if (res.ok) {
          const data = await res.json();
          setScore(data.score || 85);
          setClassification(data.classification || 'Excellent');
        }
      } catch (err) {
        console.error('Error fetching health score:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchScore();
  }, []);

  if (loading) {
    return (
      <div className="flex h-32 w-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  // Circular progress calculation
  const radius = 56;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-32 h-32 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            className="text-surface-container-high dark:text-dark-bg"
            cx="64"
            cy="64"
            fill="transparent"
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth - 2}
          />
          <circle
            className="text-primary"
            cx="64"
            cy="64"
            fill="transparent"
            r={radius}
            stroke="currentColor"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
          />
        </svg>
        <div className="absolute text-center">
          <span className="font-financial-display text-primary text-3xl font-extrabold block">{score}</span>
          <span className="text-[10px] uppercase font-bold text-outline">{classification}</span>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// WIDGET 3: Monthly Flow (Income vs Expenses Bar Chart)
// ----------------------------------------------------
function MonthlyFlowWidget() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`${API_BASE}/api/v1/wallet/transactions`, { headers: getAuthHeader() });
        if (res.ok) {
          const txs = await res.json();
          // Filter transactions for current month deposits vs others
          let income = 250000.00; // default seed base salary
          let expenses = 60000.00; // default seed base expenses

          // Add up actual transaction values
          txs.forEach(t => {
            const amt = parseFloat(t.amount);
            if (t.type === 'DEPOSIT') {
              if (t.category !== 'Lending') {
                income += amt;
              }
            } else {
              expenses += amt;
            }
          });

          setData([
            { name: 'INCOME', value: income, color: '#004ac6' },
            { name: 'EXPENSE', value: expenses, color: '#EF4444' }
          ]);
        }
      } catch (err) {
        console.error('Error fetching monthly flow data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-32 w-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  const formatCurrency = (val) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    return `₹${(val / 1000).toFixed(0)}K`;
  };

  return (
    <div className="h-32 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barSize={40} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#737686', fontSize: 10, fontWeight: 'bold' }} />
          <YAxis tickLine={false} axisLine={false} tickFormatter={formatCurrency} tick={{ fill: '#737686', fontSize: 10 }} />
          <Tooltip 
            formatter={(value) => `₹${value.toLocaleString('en-IN')}`}
            contentStyle={{ background: '#131A2E', border: 'none', borderRadius: '8px', color: '#fff' }}
          />
          <Bar dataKey="value" radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ----------------------------------------------------
// WIDGET 4: Asset Allocation (Pie Chart)
// ----------------------------------------------------
function AssetAllocationWidget() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`${API_BASE}/api/v1/investments`, { headers: getAuthHeader() });
        if (res.ok) {
          const investments = await res.json();
          const items = investments.map(inv => ({
            name: inv.portfolio_type,
            value: inv.current_value
          }));
          setData(items.length > 0 ? items : [
            { name: 'Mutual Funds', value: 1714240 },
            { name: 'Stocks', value: 1285680 },
            { name: 'Gold', value: 642840 },
            { name: 'Fixed Deposits', value: 642840 }
          ]);
        }
      } catch (err) {
        console.error('Error fetching asset allocations:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const COLORS = ['#004ac6', '#00687a', '#943700', '#F59E0B'];

  if (loading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="flex flex-col md:flex-row items-center justify-around gap-4">
      <div className="w-48 h-48 relative flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={75}
              paddingAngle={4}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `₹${value.toLocaleString('en-IN')}`} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute text-center">
          <span className="text-[11px] uppercase tracking-wider text-outline block">Total Portfolio</span>
          <span className="font-financial-display text-primary text-xl font-extrabold block">
            ₹{(total / 100000).toFixed(1)}L
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2.5 max-w-xs w-full">
        {data.map((item, index) => (
          <div key={item.name} className="flex justify-between items-center text-sm">
            <span className="flex items-center gap-2 font-medium">
              <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
              {item.name}
            </span>
            <span className="text-outline font-bold">
              ₹{(item.value / 100000).toFixed(2)}L ({((item.value / total) * 100).toFixed(0)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------
// WIDGET 5: Lending Breakdown Chart (Principal vs Interest)
// ----------------------------------------------------
function LendingAnalyticsWidget() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`${API_BASE}/api/v1/lending/loans`, { headers: getAuthHeader() });
        if (res.ok) {
          const loans = await res.json();
          const active = loans.filter(l => l.status === 'ACTIVE');
          
          if (active.length > 0) {
            const currentLoan = active[0];
            const remainingPrincipal = currentLoan.remaining_amount;
            
            // Interest calculations (approximation for representation)
            const totalEmiTerm = currentLoan.tenure_months;
            const emiAmount = currentLoan.emi_amount;
            const totalRepayable = emiAmount * totalEmiTerm;
            const totalInterest = totalRepayable - currentLoan.amount;
            
            // Proportional remaining interest
            const remainingTermRatio = currentLoan.remaining_amount / currentLoan.amount;
            const remainingInterest = totalInterest * remainingTermRatio;

            setData([
              { name: 'Remaining Principal', value: Math.round(remainingPrincipal), color: '#004ac6' },
              { name: 'Estimated Interest', value: Math.round(remainingInterest), color: '#bc4800' }
            ]);
          } else {
            setData([]);
          }
        }
      } catch (err) {
        console.error('Error fetching loan analytics:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-48 w-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex h-48 w-full items-center justify-center text-outline text-sm">
        No active loans to show analytics.
      </div>
    );
  }

  const COLORS = ['#004ac6', '#bc4800'];

  return (
    <div className="flex flex-col md:flex-row items-center justify-around gap-4">
      <div className="w-40 h-40 relative flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={65}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `₹${value.toLocaleString('en-IN')}`} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute text-center">
          <span className="text-[10px] uppercase font-bold text-outline">Total Due</span>
          <span className="font-bold text-primary text-md block">
            ₹{((data[0].value + data[1].value) / 100000).toFixed(1)}L
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2 text-sm w-full max-w-xs">
        {data.map((item, index) => (
          <div key={item.name} className="flex justify-between items-center">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
              {item.name}
            </span>
            <span className="font-bold text-on-surface">
              ₹{(item.value / 100000).toFixed(2)}L
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------
// INITIALIZATION AND WIDGET MOUNTING
// ----------------------------------------------------
// ----------------------------------------------------
// WIDGET 6: Risk Metrics (Low, Medium, High Risk Pie Chart)
// ----------------------------------------------------
function RiskMetricsWidget() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [walletRes, invRes] = await Promise.all([
          fetch(`${API_BASE}/api/v1/wallet`, { headers: getAuthHeader() }),
          fetch(`${API_BASE}/api/v1/investments`, { headers: getAuthHeader() })
        ]);

        if (walletRes.ok && invRes.ok) {
          const wallet = await walletRes.json();
          const investments = await invRes.json();

          const cash = wallet.balance || 0;
          
          let highRisk = 0;   // Stocks
          let medRisk = 0;    // Mutual Funds, Gold
          let lowRisk = cash; // Cash, Fixed Deposits

          investments.forEach(inv => {
            const type = inv.portfolio_type.toLowerCase();
            const val = parseFloat(inv.current_value || 0);
            if (type === 'stocks') {
              highRisk += val;
            } else if (type === 'mutual funds' || type === 'gold') {
              medRisk += val;
            } else if (type === 'fixed deposits') {
              lowRisk += val;
            }
          });

          // Fallback if no investments exist
          if (investments.length === 0 && cash === 0) {
            highRisk = 1285680;
            medRisk = 1714240 + 642840;
            lowRisk = 642840 + 100000;
          }

          setData([
            { name: 'Low Risk (Cash/FD)', value: Math.round(lowRisk), color: '#10B981' },
            { name: 'Medium Risk (MF/Gold)', value: Math.round(medRisk), color: '#F59E0B' },
            { name: 'High Risk (Stocks)', value: Math.round(highRisk), color: '#EF4444' }
          ]);
        }
      } catch (err) {
        console.error('Error fetching risk metrics:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-48 w-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="flex flex-col md:flex-row items-center justify-around gap-4">
      <div className="w-40 h-40 relative flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={60}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `₹${value.toLocaleString('en-IN')}`} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute text-center">
          <span className="text-[9px] uppercase tracking-wider text-outline block">Risk Score</span>
          <span className="font-financial-display text-primary text-lg font-extrabold block">
            {total > 0 ? Math.round(((data[2].value * 100 + data[1].value * 50) / total)) : 50}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        {data.map((item) => (
          <div key={item.name} className="flex justify-between items-center text-xs">
            <span className="flex items-center gap-2 font-medium">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
              {item.name}
            </span>
            <span className="text-outline font-bold">
              ₹{(item.value / 100000).toFixed(2)}L ({total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------
// WIDGET 7: Wealth Goals Progress Tracker
// ----------------------------------------------------
function GoalsProgressWidget() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);
  const [contribAmount, setContribAmount] = useState({});
  const [newGoal, setNewGoal] = useState({ name: '', targetAmount: '', category: 'Retirement', deadline: '' });
  const [showAddForm, setShowAddForm] = useState(false);

  async function fetchGoalsAndWallet() {
    try {
      const [goalsRes, walletRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/analytics/goals`, { headers: getAuthHeader() }),
        fetch(`${API_BASE}/api/v1/wallet`, { headers: getAuthHeader() })
      ]);
      if (goalsRes.ok) {
        const data = await goalsRes.json();
        setGoals(data);
      }
      if (walletRes.ok) {
        const data = await walletRes.json();
        setWalletBalance(data.balance || 0);
      }
    } catch (err) {
      console.error('Error loading goals/wallet in widget:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchGoalsAndWallet();
  }, []);

  const handleContribute = async (goalId) => {
    const amt = parseFloat(contribAmount[goalId]);
    if (!amt || isNaN(amt) || amt <= 0) {
      alert('Please enter a valid amount to contribute.');
      return;
    }
    if (amt > walletBalance) {
      alert('Insufficient wallet balance to contribute to this goal.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/v1/analytics/goals/${goalId}/contribute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount: amt })
      });
      if (res.ok) {
        alert('Contribution added successfully!');
        setContribAmount(prev => ({ ...prev, [goalId]: '' }));
        fetchGoalsAndWallet();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to add contribution.');
      }
    } catch (err) {
      console.error('Error contributing to goal:', err);
    }
  };

  const handleAddGoal = async (e) => {
    e.preventDefault();
    if (!newGoal.name || !newGoal.targetAmount) {
      alert('Please fill out the goal details.');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/v1/analytics/goals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newGoal.name,
          targetAmount: newGoal.targetAmount,
          category: newGoal.category,
          deadline: newGoal.deadline || undefined
        })
      });
      if (res.ok) {
        alert('Goal added successfully!');
        setNewGoal({ name: '', targetAmount: '', category: 'Retirement', deadline: '' });
        setShowAddForm(false);
        fetchGoalsAndWallet();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to create goal.');
      }
    } catch (err) {
      console.error('Error creating goal:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex h-40 w-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  const formatLakhs = (val) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const COLORS = ['#004ac6', '#00687a', '#10B981', '#F59E0B'];

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="font-card-title text-on-surface dark:text-white text-lg font-bold">Smart Wealth Goals</h3>
          <p className="text-[12px] text-outline">Track and allocate funds from E-Wallet (Balance: ₹{walletBalance.toLocaleString('en-IN')})</p>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)} 
          className="bg-primary/10 text-primary hover:bg-primary/20 dark:bg-white/10 dark:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
        >
          {showAddForm ? 'Cancel' : 'Add Goal'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddGoal} className="mb-6 p-4 rounded-xl border border-outline-variant/30 bg-surface-container-low dark:bg-dark-bg space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1">Goal Name</label>
              <input 
                type="text" 
                placeholder="e.g. Buy Car"
                value={newGoal.name}
                onChange={e => setNewGoal({ ...newGoal, name: e.target.value })}
                className="w-full bg-white dark:bg-dark-surface border border-outline-variant/30 rounded-lg py-1.5 px-3 text-xs dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1">Target (₹)</label>
              <input 
                type="number" 
                placeholder="e.g. 500000"
                value={newGoal.targetAmount}
                onChange={e => setNewGoal({ ...newGoal, targetAmount: e.target.value })}
                className="w-full bg-white dark:bg-dark-surface border border-outline-variant/30 rounded-lg py-1.5 px-3 text-xs dark:text-white"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1">Category</label>
              <select 
                value={newGoal.category}
                onChange={e => setNewGoal({ ...newGoal, category: e.target.value })}
                className="w-full bg-white dark:bg-dark-surface border border-outline-variant/30 rounded-lg py-1.5 px-3 text-xs dark:text-white font-bold"
              >
                <option value="Retirement">Retirement</option>
                <option value="Home">Home Purchase</option>
                <option value="Education">Education</option>
                <option value="Emergency">Emergency Fund</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1">Deadline</label>
              <input 
                type="date" 
                value={newGoal.deadline}
                onChange={e => setNewGoal({ ...newGoal, deadline: e.target.value })}
                className="w-full bg-white dark:bg-dark-surface border border-outline-variant/30 rounded-lg py-1.5 px-3 text-xs dark:text-white"
              />
            </div>
          </div>
          <button type="submit" className="w-full bg-primary text-white py-2 rounded-xl text-xs font-bold hover:opacity-90">Create Goal</button>
        </form>
      )}

      {goals.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-outline-variant/30 rounded-2xl text-outline text-xs">
          No goals configured yet. Click "Add Goal" to start your planning.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {goals.map((g, idx) => {
            const percent = Math.min(100, Math.round(((g.current_amount || 0) / g.target_amount) * 100));
            const color = COLORS[idx % COLORS.length];
            return (
              <div key={g.id || idx} className="bg-background dark:bg-dark-bg p-5 rounded-2xl border border-outline-variant/10 flex flex-col justify-between hover:border-primary/30 transition-all">
                <div className="text-center">
                  <p className="font-label-sm font-bold text-sm mb-4 text-on-surface dark:text-white">{g.name}</p>
                  <div className="relative w-20 h-20 mx-auto mb-4">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" fill="transparent" r="16" stroke="#E2E8F0" strokeWidth="3" class="text-outline-variant/20"></circle>
                      <circle cx="18" cy="18" fill="transparent" r="16" stroke={color} strokeDasharray={`${percent} 100`} strokeWidth="3" strokeLinecap="round"></circle>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-on-surface dark:text-white">{percent}%</div>
                  </div>
                  <p className="text-[10px] text-outline font-semibold mb-3">{formatLakhs(g.current_amount || 0)} / {formatLakhs(g.target_amount)}</p>
                </div>
                
                <div className="space-y-2 mt-2 pt-2 border-t border-outline-variant/10">
                  <input 
                    type="number" 
                    placeholder="Contribute amount..."
                    value={contribAmount[g.id] || ''}
                    onChange={e => setContribAmount({ ...contribAmount, [g.id]: e.target.value })}
                    className="w-full bg-white dark:bg-dark-surface border border-outline-variant/20 rounded-lg py-1 px-2 text-[11px] text-center dark:text-white focus:ring-1 focus:ring-primary/30"
                  />
                  <button 
                    onClick={() => handleContribute(g.id)}
                    className="w-full bg-primary text-white py-1.5 rounded-lg text-[10px] font-bold tracking-wider hover:opacity-90 transition-all"
                  >
                    Allocate Funds
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------
// WIDGET 8: SIP Interactive Projection Calculator
// ----------------------------------------------------
function SIPProjectionWidget() {
  const [monthlyContribution, setMonthlyContribution] = useState(5000);
  const [expectedReturn, setExpectedReturn] = useState(12);
  const [tenureYears, setTenureYears] = useState(10);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    // Generate projection data year-by-year
    const P = monthlyContribution;
    const i = expectedReturn;
    const r = i / 12 / 100;
    
    const data = [];
    for (let yr = 1; yr <= tenureYears; yr++) {
      const n = yr * 12;
      const fv = P * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
      const invested = P * n;
      const returns = fv - invested;

      data.push({
        year: `Yr ${yr}`,
        Invested: Math.round(invested),
        Returns: Math.round(returns),
        TotalValue: Math.round(fv)
      });
    }
    setChartData(data);
  }, [monthlyContribution, expectedReturn, tenureYears]);

  const formatLakhs = (val) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const finalTotal = chartData.length > 0 ? chartData[chartData.length - 1].TotalValue : 0;
  const finalInvested = chartData.length > 0 ? chartData[chartData.length - 1].Invested : 0;
  const finalReturns = finalTotal - finalInvested;

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Control sliders */}
      <div className="lg:col-span-2 space-y-5 bg-background dark:bg-dark-bg p-6 rounded-2xl border border-outline-variant/25">
        <h4 className="font-bold text-sm uppercase tracking-wider text-outline">Adjust Parameters</h4>
        
        <div>
          <div className="flex justify-between text-xs font-bold text-on-surface dark:text-white mb-2">
            <span>Monthly Contribution</span>
            <span className="text-primary">₹{monthlyContribution.toLocaleString('en-IN')}</span>
          </div>
          <input 
            type="range" 
            min="500" 
            max="100000" 
            step="500"
            value={monthlyContribution}
            onChange={e => setMonthlyContribution(parseInt(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[9px] text-outline mt-1 font-semibold">
            <span>₹500</span>
            <span>₹1,00,000</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs font-bold text-on-surface dark:text-white mb-2">
            <span>Expected Return Rate</span>
            <span className="text-primary">{expectedReturn}% p.a.</span>
          </div>
          <input 
            type="range" 
            min="5" 
            max="25" 
            step="0.5"
            value={expectedReturn}
            onChange={e => setExpectedReturn(parseFloat(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[9px] text-outline mt-1 font-semibold">
            <span>5%</span>
            <span>25%</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs font-bold text-on-surface dark:text-white mb-2">
            <span>Investment Period</span>
            <span className="text-primary">{tenureYears} Years</span>
          </div>
          <input 
            type="range" 
            min="1" 
            max="30" 
            step="1"
            value={tenureYears}
            onChange={e => setTenureYears(parseInt(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[9px] text-outline mt-1 font-semibold">
            <span>1 Yr</span>
            <span>30 Yrs</span>
          </div>
        </div>

        <div className="pt-4 border-t border-outline-variant/10 grid grid-cols-3 gap-2 text-center text-xs font-medium">
          <div>
            <span className="text-[10px] text-outline block">Invested</span>
            <span className="font-bold text-on-surface dark:text-white">{formatLakhs(finalInvested)}</span>
          </div>
          <div>
            <span className="text-[10px] text-outline block">Returns</span>
            <span className="font-bold text-success">{formatLakhs(finalReturns)}</span>
          </div>
          <div>
            <span className="text-[10px] text-outline block">Total Wealth</span>
            <span className="font-bold text-primary">{formatLakhs(finalTotal)}</span>
          </div>
        </div>
      </div>

      {/* Projection Chart */}
      <div className="lg:col-span-3 h-64 bg-background dark:bg-dark-bg p-6 rounded-2xl border border-outline-variant/25 flex flex-col justify-between">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h4 className="font-bold text-sm text-on-surface dark:text-white">Growth Trend Chart</h4>
            <p className="text-[10px] text-outline">Compounding Wealth Projection over {tenureYears} years</p>
          </div>
        </div>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#004ac6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#004ac6" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fill: '#737686', fontSize: 10 }} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={formatLakhs} tick={{ fill: '#737686', fontSize: 9 }} />
              <Tooltip 
                formatter={(value) => [`₹${value.toLocaleString('en-IN')}`]}
                contentStyle={{ background: '#131A2E', border: 'none', borderRadius: '8px', color: '#fff' }}
              />
              <Area type="monotone" dataKey="Invested" stroke="#004ac6" strokeWidth={2} fillOpacity={1} fill="url(#colorInvested)" name="Invested Capital" />
              <Area type="monotone" dataKey="TotalValue" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" name="Wealth Value" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// INITIALIZATION AND WIDGET MOUNTING
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const mounts = [
    { id: 'widget-networth-growth', component: <NetWorthGrowthWidget /> },
    { id: 'widget-health-score', component: <HealthScoreWidget /> },
    { id: 'widget-monthly-flow', component: <MonthlyFlowWidget /> },
    { id: 'widget-asset-allocation', component: <AssetAllocationWidget /> },
    { id: 'widget-risk-metrics', component: <RiskMetricsWidget /> },
    { id: 'widget-goals-tracker', component: <GoalsProgressWidget /> },
    { id: 'widget-sip-projection', component: <SIPProjectionWidget /> },
    { id: 'widget-lending-analytics', component: <LendingAnalyticsWidget /> }
  ];

  mounts.forEach(mount => {
    const el = document.getElementById(mount.id);
    if (el) {
      const root = createRoot(el);
      root.render(<React.StrictMode>{mount.component}</React.StrictMode>);
      console.log(`[REACT WIDGET] Mounted widget to #${mount.id}`);
    }
  });
});
