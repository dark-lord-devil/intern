const express = require('express');
const router = express.Router();
const rewardsController = require('../controllers/rewardsController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', rewardsController.getRewards);
router.post('/claim', rewardsController.claimMilestone);

module.exports = router;
