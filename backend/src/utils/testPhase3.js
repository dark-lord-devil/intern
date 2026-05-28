const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 5060;

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
  console.log('--- STARTING PHASE 3 ENDPOINTS INTEGRATION TEST ---');
  
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

    // 2. Test GET Notifications
    console.log('\n--- 2. Testing Get Notifications ---');
    const getNotifRes = await makeRequest(`http://localhost:${PORT}/api/v1/notifications`, 'GET', null, token);
    console.log(`Notifications Status: ${getNotifRes.status}`);
    console.log(`Fetched ${getNotifRes.data.length} notifications.`);
    if (getNotifRes.status !== 200) {
      throw new Error(`Expected status 200, got: ${getNotifRes.status}`);
    }

    // 3. Test POST Create Notification
    console.log('\n--- 3. Testing Create Notification ---');
    const newNotif = {
      type: 'ALERT',
      priority: 'HIGH',
      title: 'Integration Test Alert',
      description: 'A mock notification created during automated integration tests.'
    };
    const createNotifRes = await makeRequest(`http://localhost:${PORT}/api/v1/notifications`, 'POST', newNotif, token);
    console.log(`Create Notification Status: ${createNotifRes.status}`);
    console.log('Create Notification Response:', createNotifRes.data);
    if (createNotifRes.status !== 201) {
      throw new Error(`Expected status 201, got: ${createNotifRes.status}`);
    }
    
    // Retrieve the created notification id
    const getUpdatedNotifRes = await makeRequest(`http://localhost:${PORT}/api/v1/notifications`, 'GET', null, token);
    const createdNotifItem = getUpdatedNotifRes.data.find(n => n.title === 'Integration Test Alert');
    if (!createdNotifItem) {
      throw new Error('Created notification was not found in get list.');
    }
    const createdNotifId = createdNotifItem.id;

    // 4. Test POST Mark Notification as Read
    console.log('\n--- 4. Testing Mark Notification as Read ---');
    const readNotifRes = await makeRequest(`http://localhost:${PORT}/api/v1/notifications/${createdNotifId}/read`, 'POST', null, token);
    console.log(`Mark Read Status: ${readNotifRes.status}`);
    if (readNotifRes.status !== 200) {
      throw new Error(`Expected status 200, got: ${readNotifRes.status}`);
    }

    // 5. Test DELETE Dismiss Notification
    console.log('\n--- 5. Testing Dismiss Notification ---');
    const dismissNotifRes = await makeRequest(`http://localhost:${PORT}/api/v1/notifications/${createdNotifId}`, 'DELETE', null, token);
    console.log(`Dismiss Status: ${dismissNotifRes.status}`);
    if (dismissNotifRes.status !== 200) {
      throw new Error(`Expected status 200, got: ${dismissNotifRes.status}`);
    }

    // 6. Test GET Security Sessions
    console.log('\n--- 6. Testing Get Security Sessions ---');
    const sessionsRes = await makeRequest(`http://localhost:${PORT}/api/v1/security/sessions`, 'GET', null, token);
    console.log(`Sessions Status: ${sessionsRes.status}`);
    console.log(`Fetched ${sessionsRes.data.length} sessions.`);
    if (sessionsRes.status !== 200) {
      throw new Error(`Expected status 200, got: ${sessionsRes.status}`);
    }

    // 7. Test POST Revoke Session
    if (sessionsRes.data.length > 0) {
      console.log('\n--- 7. Testing Revoke Session ---');
      const revokeSessionId = sessionsRes.data[0].id;
      const revokeRes = await makeRequest(`http://localhost:${PORT}/api/v1/security/sessions/revoke`, 'POST', { sessionId: revokeSessionId }, token);
      console.log(`Revoke Session Status: ${revokeRes.status}`);
      console.log('Revoke Session Response:', revokeRes.data);
      if (revokeRes.status !== 200) {
        throw new Error(`Expected status 200, got: ${revokeRes.status}`);
      }
    }

    // 8. Test GET Security Audit Logs
    console.log('\n--- 8. Testing Get Security Audit Logs ---');
    const auditLogsRes = await makeRequest(`http://localhost:${PORT}/api/v1/security/audit-logs`, 'GET', null, token);
    console.log(`Audit Logs Status: ${auditLogsRes.status}`);
    console.log(`Fetched ${auditLogsRes.data.length} audit logs.`);
    if (auditLogsRes.status !== 200) {
      throw new Error(`Expected status 200, got: ${auditLogsRes.status}`);
    }

    // 9. Test POST Change Password
    console.log('\n--- 9. Testing Change Password (with rollback) ---');
    const changePassRes = await makeRequest(`http://localhost:${PORT}/api/v1/security/change-password`, 'POST', {
      currentPassword: 'password123',
      newPassword: 'password12345'
    }, token);
    console.log(`Change Password Status: ${changePassRes.status}`);
    console.log('Change Password Response:', changePassRes.data);
    if (changePassRes.status !== 200) {
      throw new Error(`Expected status 200, got: ${changePassRes.status}`);
    }

    // Rollback password back to password123 to keep demo account working
    const rollbackPassRes = await makeRequest(`http://localhost:${PORT}/api/v1/security/change-password`, 'POST', {
      currentPassword: 'password12345',
      newPassword: 'password123'
    }, token);
    console.log(`Rollback Password Status: ${rollbackPassRes.status}`);

    // 10. Test GET Admin Stats
    console.log('\n--- 10. Testing Get Admin Stats ---');
    const adminStatsRes = await makeRequest(`http://localhost:${PORT}/api/v1/admin/stats`, 'GET', null, token);
    console.log(`Admin Stats Status: ${adminStatsRes.status}`);
    console.log('Admin Stats Response keys:', Object.keys(adminStatsRes.data));
    if (adminStatsRes.status !== 200) {
      throw new Error(`Expected status 200, got: ${adminStatsRes.status}`);
    }

    // Get a target user from users list
    const usersList = adminStatsRes.data.users || [];
    if (usersList.length > 0) {
      const targetUser = usersList.find(u => u.email === 'etsintern0012@gmail.com') || usersList[0];
      
      // 11. Test POST KYC Verify
      console.log(`\n--- 11. Testing KYC Verification for user: ${targetUser.email} ---`);
      const kycRes = await makeRequest(`http://localhost:${PORT}/api/v1/admin/kyc/verify`, 'POST', {
        userId: targetUser.id,
        status: 'Verified'
      }, token);
      console.log(`KYC Verify Status: ${kycRes.status}`);
      console.log('KYC Verify Response:', kycRes.data);
      if (kycRes.status !== 200) {
        throw new Error(`Expected status 200, got: ${kycRes.status}`);
      }

      // 12. Test POST User Freeze
      console.log(`\n--- 12. Testing Toggle Freeze for user: ${targetUser.email} ---`);
      const freezeRes = await makeRequest(`http://localhost:${PORT}/api/v1/admin/users/freeze`, 'POST', {
        userId: targetUser.id,
        freeze: true
      }, token);
      console.log(`Freeze Toggle Status: ${freezeRes.status}`);
      console.log('Freeze Toggle Response:', freezeRes.data);
      if (freezeRes.status !== 200) {
        throw new Error(`Expected status 200, got: ${freezeRes.status}`);
      }

      // Unfreeze user to restore state
      const unfreezeRes = await makeRequest(`http://localhost:${PORT}/api/v1/admin/users/freeze`, 'POST', {
        userId: targetUser.id,
        freeze: false
      }, token);
      console.log(`Restore Freeze Status: ${unfreezeRes.status}`);
    }

    console.log('\n======================================================');
    console.log('PHASE 3 INTEGRATION TESTS PASSED SUCCESSFULLY!');
    console.log('======================================================');

  } catch (error) {
    console.error('\n======================================================');
    console.error('PHASE 3 INTEGRATION TEST FAILED!');
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
