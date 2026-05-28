const express = require('express');
const router = express.Router();
const insuranceController = require('../controllers/insuranceController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', insuranceController.getPolicies);
router.post('/buy', insuranceController.buyPolicy);

module.exports = router;
