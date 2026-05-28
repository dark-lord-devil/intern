const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/score', analyticsController.getHealthScore);
router.get('/recommendations', analyticsController.getRecommendations);
router.get('/goals', analyticsController.getGoals);
router.post('/goals', analyticsController.createGoal);
router.post('/goals/:id/contribute', analyticsController.contributeToGoal);

module.exports = router;
