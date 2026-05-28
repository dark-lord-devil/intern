const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 5050;

// Helper delay function
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Built-in HTTP helper to avoid external library dependencies
function makeRequest(url, method, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: headers
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: { raw: data } });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING PHASE 2 ENDPOINTS INTEGRATION TEST ---');
  
  // Make sure mock_db.json contains the seeded demo user
  const mockDbPath = path.resolve(__dirname, '../../../mock_db.json');
  console.log(`Checking mock database at: ${mockDbPath}`);
  if (fs.existsSync(mockDbPath)) {
    console.log('Test: Resetting mock database by unlinking mock_db.json...');
    try {
      fs.unlinkSync(mockDbPath);
    } catch (e) {
      console.warn('Test: Could not delete mock_db.json:', e.message);
    }
  }
  
  // Start the Express server as a subprocess in MOCK DB mode
  console.log('Test: Launching Express backend server...');
  const serverProcess = spawn('node', [path.resolve(__dirname, '../index.js')], {
    env: { ...process.env, PORT: PORT.toString(), SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' },
    stdio: 'pipe'
  });

  let serverStarted = false;

  serverProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[Server Stdout]: ${output.trim()}`);
    if (output.includes('Server is listening')) {
      serverStarted = true;
    }
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[Server Stderr]: ${data.toString().trim()}`);
  });

  // Wait for server to boot up
  for (let i = 0; i < 10; i++) {
    if (serverStarted) break;
    await delay(500);
  }

  if (!serverStarted) {
    console.error('Test Error: Backend server failed to start or write listening confirmation to stdout within timeout.');
    serverProcess.kill();
    process.exit(1);
  }

  try {
    let token = null;

    // 1. Test Login with demo user
    console.log('\n--- 1. Testing Demo Login ---');
    const loginRes = await makeRequest(`http://localhost:${PORT}/api/v1/auth/login`, 'POST', {
      identifier: 'demo@efaws.com',
      password: 'password123'
    });

    console.log(`Login Status: ${loginRes.status}`);
    if (loginRes.status !== 200 || !loginRes.data.token) {
      throw new Error(`Login failed: ${JSON.stringify(loginRes.data)}`);
    }
    
    token = loginRes.data.token;
    console.log('Successfully logged in. Token acquired.');

    // 2. Test GET Wallet Details
    console.log('\n--- 2. Testing Get Wallet Details ---');
    const walletRes = await makeRequest(`http://localhost:${PORT}/api/v1/wallet`, 'GET', null, token);
    console.log(`Wallet Status: ${walletRes.status}`);
    console.log('Wallet Data:', walletRes.data);
    if (walletRes.status !== 200 || walletRes.data.balance !== 2054850) {
      throw new Error(`Expected balance 2054850, got: ${walletRes.data.balance}`);
    }

    // 3. Test GET Transactions List
    console.log('\n--- 3. Testing Get Transactions ---');
    const txRes = await makeRequest(`http://localhost:${PORT}/api/v1/wallet/transactions`, 'GET', null, token);
    console.log(`Transactions Status: ${txRes.status}`);
    console.log(`Fetched ${txRes.data.length} transactions.`);
    if (txRes.status !== 200 || txRes.data.length < 5) {
      throw new Error(`Expected at least 5 seeded transactions, got ${txRes.data.length}`);
    }

    // 4. Test POST Wallet Deposit
    console.log('\n--- 4. Testing Wallet Deposit ---');
    const depositAmt = 15000;
    const depositRes = await makeRequest(`http://localhost:${PORT}/api/v1/wallet/deposit`, 'POST', {
      amount: depositAmt,
      description: 'Test Deposit validation'
    }, token);
    console.log(`Deposit Status: ${depositRes.status}`);
    console.log('Deposit Response:', depositRes.data);
    if (depositRes.status !== 200 || depositRes.data.balance !== 2069850) {
      throw new Error(`Expected updated balance 2069850 after deposit, got: ${depositRes.data.balance}`);
    }

    // 5. Test POST Wallet Withdrawal
    console.log('\n--- 5. Testing Wallet Withdrawal ---');
    const withdrawAmt = 9850;
    const withdrawRes = await makeRequest(`http://localhost:${PORT}/api/v1/wallet/withdraw`, 'POST', {
      amount: withdrawAmt,
      description: 'Test Withdrawal validation'
    }, token);
    console.log(`Withdrawal Status: ${withdrawRes.status}`);
    console.log('Withdrawal Response:', withdrawRes.data);
    if (withdrawRes.status !== 200 || withdrawRes.data.balance !== 2060000) {
      throw new Error(`Expected updated balance 2060000 after withdrawal, got: ${withdrawRes.data.balance}`);
    }

    // 6. Test GET Active Loans
    console.log('\n--- 6. Testing Get Active Loans ---');
    const loanRes = await makeRequest(`http://localhost:${PORT}/api/v1/lending/loans`, 'GET', null, token);
    console.log(`Loans Status: ${loanRes.status}`);
    console.log('Active Loans:', loanRes.data);
    if (loanRes.status !== 200 || loanRes.data.length === 0) {
      throw new Error('Expected at least 1 active loan, got none.');
    }
    const targetLoan = loanRes.data.find(l => l.status === 'ACTIVE');
    if (!targetLoan) {
      throw new Error('No loan with ACTIVE status found.');
    }

    // 7. Test POST EMI Repayment
    console.log('\n--- 7. Testing EMI Repayment ---');
    const repaymentRes = await makeRequest(`http://localhost:${PORT}/api/v1/lending/loans/${targetLoan.id}/repay`, 'POST', null, token);
    console.log(`Repayment Status: ${repaymentRes.status}`);
    console.log('Repayment Response:', repaymentRes.data);
    if (repaymentRes.status !== 200) {
      throw new Error('Expected EMI repayment to succeed (status 200).');
    }
    const expectedRemaining = targetLoan.remaining_amount - targetLoan.emi_amount;
    if (repaymentRes.data.loan.remaining_amount !== expectedRemaining) {
      throw new Error(`Expected remaining loan balance ${expectedRemaining}, got ${repaymentRes.data.loan.remaining_amount}`);
    }
    // Wallet should be debited by EMI amount (45,000) from 2,060,000 -> 2,015,000
    if (repaymentRes.data.walletBalance !== 2015000) {
      throw new Error(`Expected wallet balance to be 2015000 after EMI pay, got ${repaymentRes.data.walletBalance}`);
    }

    // 8. Test GET Investments Portfolio
    console.log('\n--- 8. Testing Get Investments Portfolio ---');
    const invRes = await makeRequest(`http://localhost:${PORT}/api/v1/investments`, 'GET', null, token);
    console.log(`Investments Status: ${invRes.status}`);
    console.log('Investments Portfolio:', invRes.data);
    if (invRes.status !== 200 || invRes.data.length < 4) {
      throw new Error(`Expected at least 4 investment entries, got ${invRes.data.length}`);
    }

    // 9. Test GET Insurance Policies
    console.log('\n--- 9. Testing Get Insurance Policies ---');
    const insRes = await makeRequest(`http://localhost:${PORT}/api/v1/insurance`, 'GET', null, token);
    console.log(`Insurance Status: ${insRes.status}`);
    console.log('Insurance Policies:', insRes.data);
    if (insRes.status !== 200 || insRes.data.length < 2) {
      throw new Error(`Expected at least 2 insurance policies, got ${insRes.data.length}`);
    }

    // 10. Test GET Rewards Progress
    console.log('\n--- 10. Testing Get Rewards Progress ---');
    const rewardsRes = await makeRequest(`http://localhost:${PORT}/api/v1/rewards`, 'GET', null, token);
    console.log(`Rewards Status: ${rewardsRes.status}`);
    console.log('Rewards Data:', rewardsRes.data);
    if (rewardsRes.status !== 200 || rewardsRes.data.level !== 4 || rewardsRes.data.current_xp !== 1200) {
      throw new Error(`Expected Level 4 with 1200 XP, got Level ${rewardsRes.data.level} with ${rewardsRes.data.current_xp} XP`);
    }

    // 11. Test GET Financial Health Score
    console.log('\n--- 11. Testing Financial Health Score ---');
    const scoreRes = await makeRequest(`http://localhost:${PORT}/api/v1/analytics/score`, 'GET', null, token);
    console.log(`Health Score Status: ${scoreRes.status}`);
    console.log('Health Score Response:', scoreRes.data);
    if (scoreRes.status !== 200 || !scoreRes.data.score) {
      throw new Error('Expected health score calculations response.');
    }

    // 12. Test GET AI Recommendations
    console.log('\n--- 12. Testing AI Recommendations ---');
    const recsRes = await makeRequest(`http://localhost:${PORT}/api/v1/analytics/recommendations`, 'GET', null, token);
    console.log(`Recommendations Status: ${recsRes.status}`);
    console.log(`Recommendations Response: Loaded ${recsRes.data.length} recommendations.`);
    if (recsRes.status !== 200 || recsRes.data.length === 0) {
      throw new Error('Expected at least 1 recommendation.');
    }

    console.log('\n======================================================');
    console.log('PHASE 2 INTEGRATION TESTS PASSED SUCCESSFULLY!');
    console.log('======================================================');

  } catch (error) {
    console.error('\n======================================================');
    console.error('PHASE 2 INTEGRATION TEST FAILED!');
    console.error('Error message:', error.message);
    console.error('======================================================');
    serverProcess.kill();
    process.exit(1);
  }

  // Shut down backend server
  serverProcess.kill();
  process.exit(0);
}

runTests();
