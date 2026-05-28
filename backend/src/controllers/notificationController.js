const supabase = require('../config/supabase');

/**
 * Get all notifications for the authenticated user
 */
async function getNotifications(req, res) {
  const userId = req.user.userId;

  try {
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching notifications:', error.message);
      return res.status(500).json({ error: 'Failed to retrieve notifications.' });
    }

    // Sort by created_at desc (newest first)
    const sorted = (notifications || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.status(200).json(sorted);
  } catch (error) {
    console.error('Get notifications error:', error.message);
    res.status(500).json({ error: 'Internal server error fetching notifications.' });
  }
}

/**
 * Mark a notification as read
 */
async function markAsRead(req, res) {
  const userId = req.user.userId;
  const notifId = req.params.id;

  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notifId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error marking notification as read:', error.message);
      return res.status(500).json({ error: 'Failed to update notification.' });
    }

    res.status(200).json({ success: true, message: 'Notification marked as read.' });
  } catch (error) {
    console.error('Mark read error:', error.message);
    res.status(500).json({ error: 'Internal server error updating notification.' });
  }
}

/**
 * Delete/Dismiss a notification
 */
async function dismissNotification(req, res) {
  const userId = req.user.userId;
  const notifId = req.params.id;

  try {
    const { data, error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notifId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting notification:', error.message);
      return res.status(500).json({ error: 'Failed to delete notification.' });
    }

    res.status(200).json({ success: true, message: 'Notification dismissed.' });
  } catch (error) {
    console.error('Dismiss notification error:', error.message);
    res.status(500).json({ error: 'Internal server error dismissing notification.' });
  }
}

/**
 * Create a new notification (useful for simulations)
 */
async function createNotification(req, res) {
  const userId = req.user.userId;
  const { type, title, description, priority } = req.body;

  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert([
        {
          user_id: userId,
          type: type || 'ALERT',
          title: title || 'System Update',
          description: description || 'No details provided.',
          priority: priority || 'LOW',
          is_read: false,
          created_at: new Date().toISOString()
        }
      ]);

    if (error) {
      console.error('Error creating notification:', error.message);
      return res.status(500).json({ error: 'Failed to create notification.' });
    }

    res.status(201).json({ success: true, message: 'Notification created successfully.', data });
  } catch (error) {
    console.error('Create notification error:', error.message);
    res.status(500).json({ error: 'Internal server error creating notification.' });
  }
}

module.exports = {
  getNotifications,
  markAsRead,
  dismissNotification,
  createNotification
};
