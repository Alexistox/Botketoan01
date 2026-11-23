const BroadcastSchedule = require('../models/BroadcastSchedule');
const {
  fireBroadcastSchedule,
  getSaigonNowParts
} = require('../controllers/broadcastCommands');

let isRunning = false;

async function watchBroadcastSchedules(bot) {
  if (!bot || isRunning) return;
  isRunning = true;
  try {
    const { dateStr, timeHHmm } = getSaigonNowParts();
    const due = await BroadcastSchedule.find({
      enabled: { $ne: false },
      timeHHmm,
      $or: [
        { lastFiredDate: null },
        { lastFiredDate: { $ne: dateStr } }
      ]
    }).lean();

    for (const row of due) {
      try {
        const result = await fireBroadcastSchedule(bot, row);
        if (result.errors.length) {
          console.warn(
            `Broadcast schedule #${String(row._id).slice(-6)} ${row.timeHHmm}: ` +
              `${result.ok}/${result.total} ok; ${result.errors.slice(0, 3).join(' | ')}`
          );
        } else {
          console.log(
            `Broadcast schedule #${String(row._id).slice(-6)} ${row.timeHHmm}: ` +
              `${result.ok}/${result.total} sent`
          );
        }
      } catch (error) {
        console.error(
          `Broadcast schedule #${String(row._id).slice(-6)} failed:`,
          error.message || error
        );
      }
    }
  } catch (error) {
    console.error('watchBroadcastSchedules error:', error.message || error);
  } finally {
    isRunning = false;
  }
}

function startBroadcastScheduleWatcher(bot) {
  const intervalMs = parseInt(process.env.BROADCAST_SCHEDULE_POLL_MS, 10) || 30000;
  setTimeout(() => watchBroadcastSchedules(bot), 8000);
  setInterval(() => watchBroadcastSchedules(bot), intervalMs);
  console.log(`Broadcast schedule watcher started (interval ${intervalMs}ms, TZ Asia/Ho_Chi_Minh)`);
}

module.exports = {
  watchBroadcastSchedules,
  startBroadcastScheduleWatcher
};
