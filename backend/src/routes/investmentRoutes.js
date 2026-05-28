const express = require('express');
const router = express.Router();
const investmentController = require('../controllers/investmentController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', investmentController.getInvestments);
router.post('/buy', investmentController.buyInvestment);

module.exports = router;
