const express = require('express');
const router = express.Router();
const securityController = require('../controllers/securityController');
const authMiddleware = require('../middleware/auth');

// All security routes are protected
router.use(authMiddleware);

router.get('/sessions', securityController.getSessions);
router.post('/sessions/revoke', securityController.revokeSession);
router.get('/audit-logs', securityController.getAuditLogs);
router.post('/change-password', securityController.changePassword);

module.exports = router;
