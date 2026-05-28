const bcrypt = require('bcryptjs');
const supabase = require('./supabase');
const fs = require('fs');
const path = require('path');

async function seedDatabase() {
  // Check if live Supabase tables exist. If not, trigger fallback to mock DB.
  if (!supabase.isMock()) {
    try {
      const { error } = await supabase.from('users').select('id').limit(1);
      if (error && (error.code === 'PGRST205' || error.message.includes('schema cache') || error.message.includes('not found'))) {
        console.warn('\x1b[33m%s\x1b[0m', '--------------------------------------------------------------------------------');
        console.warn('\x1b[33m%s\x1b[0m', 'WARNING: Supabase database tables do not exist in the live project.');
        console.warn('\x1b[33m%s\x1b[0m', 'FALLING BACK to local persisted mock database (mock_db.json).');
        console.warn('\x1b[33m%s\x1b[0m', 'To use your live Supabase database, please copy the contents of:');
        console.warn('\x1b[33m%s\x1b[0m', '  backend/src/config/init.sql');
        console.warn('\x1b[33m%s\x1b[0m', 'and run it in the SQL Editor of your Supabase dashboard.');
        console.warn('\x1b[33m%s\x1b[0m', '--------------------------------------------------------------------------------');
        
        supabase.setUseMock(true);
      }
    } catch (err) {
      console.warn('Seeder: Supabase check failed, falling back to mock DB:', err.message);
      supabase.setUseMock(true);
    }
  }

  console.log('Seeder: Checking if demo user exists in active database...');
  
  // 1. Seed local mock_db.json file directly for local testing
  const mockDbPath = path.resolve(__dirname, '../../../mock_db.json');
  if (fs.existsSync(mockDbPath)) {
    try {
      const db = JSON.parse(fs.readFileSync(mockDbPath, 'utf8'));
      db.users = db.users || [];
      db.profiles = db.profiles || [];
      db.wallets = db.wallets || [];
      db.transactions = db.transactions || [];
      db.loans = db.loans || [];
      db.investments = db.investments || [];
      db.insurance_policies = db.insurance_policies || [];
      db.rewards_xp = db.rewards_xp || [];
      db.ai_recommendations = db.ai_recommendations || [];
      db.notifications = db.notifications || [];
      db.active_sessions = db.active_sessions || [];
      db.user_goals = db.user_goals || [];

      let dbModified = false;

      // Seed notifications if empty
      if (db.notifications.length === 0) {
        const demoUserId = 'd3b07384-d113-469e-bb4d-616a19f07a2a';
        const selvaUserId = '132007ef-faws-4e88-a4b7-51fc94c1473f';
        db.notifications.push(
          {
            id: 'notif-1',
            user_id: demoUserId,
            type: 'ALERT',
            priority: 'HIGH',
            title: 'Security Login Attempt',
            description: 'A new login attempt was detected from Mumbai, India.',
            is_read: false,
            created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString()
          },
          {
            id: 'notif-2',
            user_id: demoUserId,
            type: 'INVESTMENT',
            priority: 'MEDIUM',
            title: 'SIP Installment Successful',
            description: 'Your monthly SIP of ₹10,000 has been successfully debited.',
            is_read: false,
            created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: 'notif-3',
            user_id: demoUserId,
            type: 'REWARDS',
            priority: 'LOW',
            title: 'XP Awarded!',
            description: 'You completed a compound interest quiz and earned 100 XP.',
            is_read: true,
            created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: 'notif-4',
            user_id: selvaUserId,
            type: 'SECURITY',
            priority: 'CRITICAL',
            title: 'Unrecognized Session Detected',
            description: 'A session from an unknown IP was revoked for safety.',
            is_read: false,
            created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString()
          },
          {
            id: 'notif-5',
            user_id: selvaUserId,
            type: 'REWARDS',
            priority: 'LOW',
            title: 'Welcome to E-Faws!',
            description: 'Complete your profile information and get 500 XP.',
            is_read: false,
            created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
          }
        );
        dbModified = true;
      }

      // Seed active_sessions if empty
      if (db.active_sessions.length === 0) {
        const demoUserId = 'd3b07384-d113-469e-bb4d-616a19f07a2a';
        const selvaUserId = '132007ef-faws-4e88-a4b7-51fc94c1473f';
        db.active_sessions.push(
          {
            id: 'sess-1',
            user_id: demoUserId,
            ip_address: '192.168.1.15',
            device_info: 'Chrome on macOS',
            location: 'Mumbai, India',
            last_location_city: 'Mumbai',
            is_active: true,
            last_active: new Date().toISOString(),
            created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: 'sess-2',
            user_id: demoUserId,
            ip_address: '103.45.2.19',
            device_info: 'Safari on iPhone 15',
            location: 'Bengaluru, India',
            last_location_city: 'Bengaluru',
            is_active: true,
            last_active: new Date().toISOString(),
            created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
          },
          {
            id: 'sess-3',
            user_id: selvaUserId,
            ip_address: '103.88.24.5',
            device_info: 'Edge on Windows 11',
            location: 'Chennai, India',
            last_location_city: 'Chennai',
            is_active: true,
            last_active: new Date().toISOString(),
            created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          }
        );
        dbModified = true;
      }

      // Seed user_goals if empty
      if (db.user_goals.length === 0) {
        const demoUserId = 'd3b07384-d113-469e-bb4d-616a19f07a2a';
        const selvaUserId = '132007ef-faws-4e88-a4b7-51fc94c1473f';
        db.user_goals.push(
          {
            id: 'goal-1',
            user_id: demoUserId,
            name: 'Retirement Fund',
            target_amount: 5000000.00,
            current_amount: 1500000.00,
            category: 'RETIREMENT',
            deadline: '2035-12-31T00:00:00Z',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 'goal-2',
            user_id: demoUserId,
            name: 'Emergency Fund',
            target_amount: 500000.00,
            current_amount: 300000.00,
            category: 'EMERGENCY',
            deadline: '2027-06-30T00:00:00Z',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 'goal-3',
            user_id: selvaUserId,
            name: 'Emergency Fund',
            target_amount: 200000.00,
            current_amount: 50000.00,
            category: 'EMERGENCY',
            deadline: '2026-12-31T00:00:00Z',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 'goal-4',
            user_id: selvaUserId,
            name: 'Wealth Building',
            target_amount: 1000000.00,
            current_amount: 150000.00,
            category: 'SAVINGS',
            deadline: '2028-05-20T00:00:00Z',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        );
        dbModified = true;
      }

      if (dbModified) {
        fs.writeFileSync(mockDbPath, JSON.stringify(db, null, 2), 'utf8');
        console.log('Seeder: mock_db.json updated with Phase 3 notifications, goals, and sessions.');
      }

      const demoExists = db.users.some(u => u.email === 'demo@efaws.com');
      if (!demoExists) {
        console.log('Seeder: Demo user not found in mock_db.json. Seeding mock_db.json...');
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('password123', salt);
        const demoUserId = 'd3b07384-d113-469e-bb4d-616a19f07a2a';
        
        db.users.push({
          id: demoUserId,
          email: 'demo@efaws.com',
          phone: '+919876543210',
          password_hash: passwordHash,
          is_verified: true,
          otp_code: null,
          otp_expires_at: null,
          created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        });

        db.profiles.push({
          user_id: demoUserId,
          full_name: 'Arjun Sharma',
          risk_profile: 'Moderate Risk',
          kyc_status: 'Verified',
          financial_health_score: 85,
          created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        });

        db.wallets.push({
          id: 'w-demo-wallet-id',
          user_id: demoUserId,
          balance: 2054850.00,
          currency: 'INR',
          updated_at: new Date().toISOString()
        });

        db.transactions.push(
          {
            id: 'tx-1',
            user_id: demoUserId,
            type: 'DEPOSIT',
            amount: 250000.00,
            status: 'COMPLETED',
            category: 'Salary',
            description: 'Monthly Salary Credit',
            created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: 'tx-2',
            user_id: demoUserId,
            type: 'INVESTMENT',
            amount: 10000.00,
            status: 'COMPLETED',
            category: 'Mutual Funds',
            description: 'SIP - Nifty 50 Index Fund',
            created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: 'tx-3',
            user_id: demoUserId,
            type: 'REPAYMENT',
            amount: 45000.00,
            status: 'COMPLETED',
            category: 'Lending',
            description: 'EMI Repayment - HDFC Personal Loan',
            created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: 'tx-4',
            user_id: demoUserId,
            type: 'WITHDRAW',
            amount: 15000.00,
            status: 'COMPLETED',
            category: 'Lifestyle',
            description: 'Transfer to HDFC Savings',
            created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: 'tx-5',
            user_id: demoUserId,
            type: 'PREMIUM',
            amount: 3500.00,
            status: 'COMPLETED',
            category: 'Insurance',
            description: 'Monthly Premium - HDFC Health Shield',
            created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
          }
        );

        db.loans.push({
          id: 'loan-demo-id',
          user_id: demoUserId,
          amount: 1500000.00,
          interest_rate: 10.5,
          emi_amount: 45000.00,
          tenure_months: 36,
          remaining_amount: 655000.00,
          status: 'ACTIVE',
          next_emi_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date(Date.now() - 22 * 30 * 24 * 60 * 60 * 1000).toISOString()
        });

        db.investments.push(
          {
            id: 'inv-1',
            user_id: demoUserId,
            portfolio_type: 'Mutual Funds',
            invested_amount: 1400000.00,
            current_value: 1714240.00,
            return_percentage: 22.44,
            updated_at: new Date().toISOString()
          },
          {
            id: 'inv-2',
            user_id: demoUserId,
            portfolio_type: 'Stocks',
            invested_amount: 1100000.00,
            current_value: 1285680.00,
            return_percentage: 16.88,
            updated_at: new Date().toISOString()
          },
          {
            id: 'inv-3',
            user_id: demoUserId,
            portfolio_type: 'Gold',
            invested_amount: 550000.00,
            current_value: 642840.00,
            return_percentage: 16.88,
            updated_at: new Date().toISOString()
          },
          {
            id: 'inv-4',
            user_id: demoUserId,
            portfolio_type: 'Fixed Deposits',
            invested_amount: 600000.00,
            current_value: 642840.00,
            return_percentage: 7.14,
            updated_at: new Date().toISOString()
          }
        );

        db.insurance_policies.push(
          {
            id: 'ins-1',
            user_id: demoUserId,
            policy_type: 'Health',
            provider: 'HDFC Ergo',
            premium_amount: 3500.00,
            coverage_amount: 1000000.00,
            status: 'ACTIVE',
            expiry_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: 'ins-2',
            user_id: demoUserId,
            policy_type: 'Life',
            provider: 'SBI Life',
            premium_amount: 8000.00,
            coverage_amount: 10000000.00,
            status: 'ACTIVE',
            expiry_date: new Date(Date.now() + 320 * 24 * 60 * 60 * 1000).toISOString()
          }
        );

        db.rewards_xp.push({
          user_id: demoUserId,
          level: 4,
          current_xp: 1200,
          next_level_xp: 1600
        });

        db.ai_recommendations.push(
          {
            id: 'rec-1',
            user_id: demoUserId,
            title: 'Rebalance SIP Portfolio',
            description: 'Based on your recent spending drop, increasing your index fund SIP by ₹5,000 could reach your retirement goal 2 years earlier.',
            category: 'INVESTMENT',
            action_text: 'Apply Recommendation',
            confidence: 0.94,
            created_at: new Date().toISOString()
          },
          {
            id: 'rec-2',
            user_id: demoUserId,
            title: 'Increase emergency fund',
            description: 'With your monthly EMIs at ₹45,000, having 6 months of expenses in a liquid fund is highly recommended.',
            category: 'INVESTMENT',
            action_text: 'Create Liquid SIP',
            confidence: 0.89,
            created_at: new Date().toISOString()
          },
          {
            id: 'rec-3',
            user_id: demoUserId,
            title: 'Improve savings consistency',
            description: 'You saved 42% this month! Keep this up for 3 more months to earn the \'Savings Guru\' level 5 badge.',
            category: 'SPENDING',
            action_text: 'View Badges',
            confidence: 0.92,
            created_at: new Date().toISOString()
          }
        );

        fs.writeFileSync(mockDbPath, JSON.stringify(db, null, 2), 'utf8');
        console.log('Seeder: mock_db.json seeded successfully with demo account data.');
      } else {
        console.log('Seeder: Demo user already exists in mock_db.json.');
      }
    } catch (e) {
      console.error('Seeder: Failed to seed mock_db.json:', e.message);
    }
  }

  // 2. Seed active database (e.g. Supabase)
  if (supabase.isMock()) {
    return;
  }

  try {
    const { data: existingUsers } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'demo@efaws.com');

    if (existingUsers && existingUsers.length > 0) {
      console.log('Seeder: Demo user demo@efaws.com already exists in active database. Database seeding skipped.');
      return;
    }

    console.log('Seeder: Seeding active database with demo data...');

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);
    
    // 1. Insert User
    const demoUserId = 'd3b07384-d113-469e-bb4d-616a19f07a2a';
    const { data: users } = await supabase.from('users').insert([{
      id: demoUserId,
      email: 'demo@efaws.com',
      phone: '+919876543210',
      password_hash: passwordHash,
      is_verified: true,
      otp_code: null,
      otp_expires_at: null,
      created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days ago
    }]);

    // 2. Insert Profile
    await supabase.from('profiles').insert([{
      user_id: demoUserId,
      full_name: 'Arjun Sharma',
      risk_profile: 'Moderate Risk',
      kyc_status: 'Verified',
      financial_health_score: 85,
      created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    }]);

    // 3. Insert Wallet (HDFC + SBI Balance: 12,42,800 + 8,12,050 = 20,54,850)
    await supabase.from('wallets').insert([{
      user_id: demoUserId,
      balance: 2054850.00,
      currency: 'INR',
      updated_at: new Date().toISOString()
    }]);

    // 4. Insert Transactions
    await supabase.from('transactions').insert([
      {
        user_id: demoUserId,
        type: 'DEPOSIT',
        amount: 250000.00,
        status: 'COMPLETED',
        category: 'Salary',
        description: 'Monthly Salary Credit',
        created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        user_id: demoUserId,
        type: 'INVESTMENT',
        amount: 10000.00,
        status: 'COMPLETED',
        category: 'Mutual Funds',
        description: 'SIP - Nifty 50 Index Fund',
        created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        user_id: demoUserId,
        type: 'REPAYMENT',
        amount: 45000.00,
        status: 'COMPLETED',
        category: 'Lending',
        description: 'EMI Repayment - HDFC Personal Loan',
        created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        user_id: demoUserId,
        type: 'WITHDRAW',
        amount: 15000.00,
        status: 'COMPLETED',
        category: 'Lifestyle',
        description: 'Transfer to HDFC Savings',
        created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        user_id: demoUserId,
        type: 'PREMIUM',
        amount: 3500.00,
        status: 'COMPLETED',
        category: 'Insurance',
        description: 'Monthly Premium - HDFC Health Shield',
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      }
    ]);

    // 5. Insert Active Loan
    await supabase.from('loans').insert([{
      user_id: demoUserId,
      amount: 1500000.00,
      interest_rate: 10.5,
      emi_amount: 45000.00,
      tenure_months: 36,
      remaining_amount: 655000.00, // 15,00,000 - 8,45,000 paid
      status: 'ACTIVE',
      next_emi_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // In 3 days
      created_at: new Date(Date.now() - 22 * 30 * 24 * 60 * 60 * 1000).toISOString() // 22 months ago
    }]);

    // 6. Insert Investments
    await supabase.from('investments').insert([
      {
        user_id: demoUserId,
        portfolio_type: 'Mutual Funds',
        invested_amount: 1400000.00,
        current_value: 1714240.00,
        return_percentage: 22.44,
        updated_at: new Date().toISOString()
      },
      {
        user_id: demoUserId,
        portfolio_type: 'Stocks',
        invested_amount: 1100000.00,
        current_value: 1285680.00,
        return_percentage: 16.88,
        updated_at: new Date().toISOString()
      },
      {
        user_id: demoUserId,
        portfolio_type: 'Gold',
        invested_amount: 550000.00,
        current_value: 642840.00,
        return_percentage: 16.88,
        updated_at: new Date().toISOString()
      },
      {
        user_id: demoUserId,
        portfolio_type: 'Fixed Deposits',
        invested_amount: 600000.00,
        current_value: 642840.00,
        return_percentage: 7.14,
        updated_at: new Date().toISOString()
      }
    ]);

    // 7. Insert Insurance Policies
    await supabase.from('insurance_policies').insert([
      {
        user_id: demoUserId,
        policy_type: 'Health',
        provider: 'HDFC Ergo',
        premium_amount: 3500.00,
        coverage_amount: 1000000.00,
        status: 'ACTIVE',
        expiry_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        user_id: demoUserId,
        policy_type: 'Life',
        provider: 'SBI Life',
        premium_amount: 8000.00,
        coverage_amount: 10000000.00,
        status: 'ACTIVE',
        expiry_date: new Date(Date.now() + 320 * 24 * 60 * 60 * 1000).toISOString()
      }
    ]);

    // 8. Insert Rewards XP
    await supabase.from('rewards_xp').insert([{
      user_id: demoUserId,
      level: 4,
      current_xp: 1200,
      next_level_xp: 1600
    }]);

    // 9. Insert AI Recommendations
    await supabase.from('ai_recommendations').insert([
      {
        user_id: demoUserId,
        title: 'Rebalance SIP Portfolio',
        description: 'Based on your recent spending drop, increasing your index fund SIP by ₹5,000 could reach your retirement goal 2 years earlier.',
        category: 'INVESTMENT',
        action_text: 'Apply Recommendation',
        confidence: 0.94,
        created_at: new Date().toISOString()
      },
      {
        user_id: demoUserId,
        title: 'Increase emergency fund',
        description: 'With your monthly EMIs at ₹45,000, having 6 months of expenses in a liquid fund is highly recommended.',
        category: 'INVESTMENT',
        action_text: 'Create Liquid SIP',
        confidence: 0.89,
        created_at: new Date().toISOString()
      },
      {
        user_id: demoUserId,
        title: 'Improve savings consistency',
        description: 'You saved 42% this month! Keep this up for 3 more months to earn the \'Savings Guru\' level 5 badge.',
        category: 'SPENDING',
        action_text: 'View Badges',
        confidence: 0.92,
        created_at: new Date().toISOString()
      }
    ]);

    console.log('Seeder: Active database seeded successfully!');
  } catch (error) {
    console.error('Seeder: Error seeding active database:', error.message);
  }
}

module.exports = seedDatabase;
