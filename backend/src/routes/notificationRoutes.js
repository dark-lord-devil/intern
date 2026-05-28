const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/auth');

// All notification routes require JWT authentication
router.use(authMiddleware);

router.get('/', notificationController.getNotifications);
router.post('/', notificationController.createNotification);
router.post('/:id/read', notificationController.markAsRead);
router.delete('/:id', notificationController.dismissNotification);

module.exports = router;
