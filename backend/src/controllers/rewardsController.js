const supabase = require('../config/supabase');
const { logAudit } = require('../utils/audit');

/**
 * Get user rewards, level and XP
 */
async function getRewards(req, res) {
  const userId = req.user.userId;

  try {
    const { data: rewards, error } = await supabase
      .from('rewards_xp')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      return res.status(500).json({ error: 'Error fetching rewards profile.' });
    }

    if (!rewards || rewards.length === 0) {
      // Create a default level 1 profile
      const defaultRewards = {
        user_id: userId,
        level: 1,
        current_xp: 0,
        next_level_xp: 1000
      };
      const { data: newRewards } = await supabase
        .from('rewards_xp')
        .insert([defaultRewards])
        .select();

      return res.status(200).json(newRewards ? newRewards[0] : defaultRewards);
    }

    res.status(200).json(rewards[0]);
  } catch (error) {
    console.error('Get rewards error:', error.message);
    res.status(500).json({ error: 'Internal server error fetching rewards.' });
  }
}

/**
 * Claim reward XP for completing a milestone
 */
async function claimMilestone(req, res) {
  const userId = req.user.userId;
  const { milestoneId, xpReward } = req.body;

  const xp = parseInt(xpReward);
  if (!milestoneId || isNaN(xp) || xp <= 0) {
    return res.status(400).json({ error: 'milestoneId and valid positive xpReward are required.' });
  }

  try {
    // 1. Fetch rewards profile
    const { data: rewards, error: fetchErr } = await supabase
      .from('rewards_xp')
      .select('*')
      .eq('user_id', userId);

    let profile;
    if (fetchErr || !rewards || rewards.length === 0) {
      profile = {
        user_id: userId,
        level: 1,
        current_xp: 0,
        next_level_xp: 1000
      };
    } else {
      profile = rewards[0];
    }

    // 2. Add XP and check for level up
    let currentXp = profile.current_xp + xp;
    let level = profile.level;
    let nextLevelXp = profile.next_level_xp;
    let leveledUp = false;

    while (currentXp >= nextLevelXp) {
      leveledUp = true;
      currentXp -= nextLevelXp;
      level += 1;
      nextLevelXp = Math.round(nextLevelXp * 1.5); // level up scale factor
    }

    // 3. Save to database
    let updated;
    if (!rewards || rewards.length === 0) {
      const { data } = await supabase
        .from('rewards_xp')
        .insert([{
          user_id: userId,
          level,
          current_xp: currentXp,
          next_level_xp: nextLevelXp
        }])
        .select();
      updated = data ? data[0] : null;
    } else {
      const { data } = await supabase
        .from('rewards_xp')
        .update({
          level,
          current_xp: currentXp,
          next_level_xp: nextLevelXp
        })
        .eq('user_id', userId)
        .select();
      updated = data ? data[0] : null;
    }

    // 4. Log audit
    await logAudit(req, userId, `REWARD_CLAIMED_${milestoneId}_XP_${xp}`, 'REWARDS');

    res.status(200).json({
      message: leveledUp ? `Congratulations! You leveled up to Level ${level}!` : 'XP awarded successfully.',
      rewards: updated,
      leveledUp
    });

  } catch (error) {
    console.error('Claim milestone error:', error.message);
    res.status(500).json({ error: 'Internal server error processing reward.' });
  }
}

module.exports = {
  getRewards,
  claimMilestone
};
