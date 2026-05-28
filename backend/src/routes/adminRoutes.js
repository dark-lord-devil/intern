const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth');

// All admin routes require authentication
router.use(authMiddleware);

router.get('/stats', adminController.getAdminStats);
router.post('/kyc/verify', adminController.verifyKyc);
router.post('/users/freeze', adminController.toggleUserFreeze);

module.exports = router;
