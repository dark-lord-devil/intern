const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 5050;
const BASE_URL = `http://localhost:${PORT}/api/v1/auth`;

// Helper delay function
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Built-in HTTP helper to avoid node-fetch dependency
function makeRequest(url, method, body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
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
  console.log('--- STARTING AUTHENTICATION FLOW INTEGRATION TEST ---');
  
  // 1. Clear previous mock database to start clean
  const mockDbPath = path.resolve(__dirname, '../../../mock_db.json');
  if (fs.existsSync(mockDbPath)) {
    fs.unlinkSync(mockDbPath);
    console.log('Test: Reset and cleared previous mock_db.json file.');
  }

  // 2. Start the Express server as a subprocess
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

  // Wait for server to boot up (max 5 seconds)
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
    const testEmail = `test_user_${Date.now()}@example.com`;
    const testPhone = `+919988776655`;
    const testPassword = `SecurePassword123!`;
    const testName = `Integration Test User`;

    // 3. Test Registration
    console.log('\n--- 1. Testing Registration Endpoint ---');
    const registerRes = await makeRequest(`${BASE_URL}/register`, 'POST', {
      email: testEmail,
      phone: testPhone,
      password: testPassword,
      fullName: testName
    });

    console.log(`Registration Status: ${registerRes.status}`);
    console.log('Registration Response:', registerRes.data);

    if (registerRes.status !== 201) {
      throw new Error(`Expected registration status 201, got ${registerRes.status}`);
    }

    // 4. Read generated OTP from mock database
    console.log('\n--- 2. Retrieving OTP from local mock_db.json ---');
    if (!fs.existsSync(mockDbPath)) {
      throw new Error('mock_db.json file was not created after user registration.');
    }

    const mockDb = JSON.parse(fs.readFileSync(mockDbPath, 'utf8'));
    const userInDb = mockDb.users.find(u => u.email === testEmail);
    if (!userInDb || !userInDb.otp_code) {
      throw new Error('User or OTP code not found in mock_db.json.');
    }

    const otpCode = userInDb.otp_code;
    console.log(`Found OTP Code: "${otpCode}" for registered phone: ${testPhone}`);

    // 5. Test OTP Verification
    console.log('\n--- 3. Testing OTP Verification Endpoint ---');
    const verifyRes = await makeRequest(`${BASE_URL}/verify-otp`, 'POST', {
      phone: testPhone,
      otpCode: otpCode
    });

    console.log(`Verification Status: ${verifyRes.status}`);
    console.log('Verification Response:', verifyRes.data);

    if (verifyRes.status !== 200 || !verifyRes.data.token) {
      throw new Error(`Expected verification status 200 with token, got ${verifyRes.status}`);
    }

    console.log('Token successfully generated during verification:', verifyRes.data.token.substring(0, 30) + '...');

    // 6. Test Login
    console.log('\n--- 4. Testing Login Endpoint (Verified User) ---');
    const loginRes = await makeRequest(`${BASE_URL}/login`, 'POST', {
      identifier: testEmail,
      password: testPassword
    });

    console.log(`Login Status: ${loginRes.status}`);
    console.log('Login Response:', loginRes.data);

    if (loginRes.status !== 200 || !loginRes.data.token) {
      throw new Error(`Expected login status 200 with token, got ${loginRes.status}`);
    }

    // 7. Verify audit logs were written
    console.log('\n--- 5. Verifying Audit Logs ---');
    const dbAfterTests = JSON.parse(fs.readFileSync(mockDbPath, 'utf8'));
    const userAudits = dbAfterTests.audit_logs.filter(log => log.user_id === userInDb.id);
    console.log(`Found ${userAudits.length} audit logs for User ID ${userInDb.id}:`);
    userAudits.forEach(log => {
      console.log(` - Action: ${log.action} | Module: ${log.module}`);
    });

    if (userAudits.length === 0) {
      throw new Error('No audit logs recorded for test user.');
    }

    console.log('\n======================================');
    console.log('INTEGRATION TESTS PASSED SUCCESSFULLY!');
    console.log('======================================');

  } catch (error) {
    console.error('\n======================================');
    console.error('INTEGRATION TEST FAILED!');
    console.error('Error message:', error.message);
    console.error('======================================');
    serverProcess.kill();
    process.exit(1);
  }

  // Shut down backend server
  serverProcess.kill();
  process.exit(0);
}

runTests();
