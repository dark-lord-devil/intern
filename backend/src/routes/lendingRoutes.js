const express = require('express');
const router = express.Router();
const lendingController = require('../controllers/lendingController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/loans', lendingController.getLoans);
router.post('/loans', lendingController.applyLoan);
router.post('/loans/:id/repay', lendingController.repayLoan);

module.exports = router;
