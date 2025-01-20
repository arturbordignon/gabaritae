const cron = require("node-cron");
const User = require("../models/User");
const logger = require("../utils/logger");

const renewLives = async () => {
  try {
    logger.info("Starting life renewal check...");
    const now = new Date();

    const usersToUpdate = await User.find({
      vidas: { $lt: 40 },
      proximaVida: { $lte: now },
    });

    logger.info(`Found ${usersToUpdate.length} users eligible for life renewal`);

    const updates = usersToUpdate.map((user) => ({
      updateOne: {
        filter: { _id: user._id },
        update: {
          $inc: { vidas: 1 },
          $set: {
            proximaVida: new Date(now.getTime() + 3 * 60 * 60 * 1000),
          },
        },
      },
    }));

    if (updates.length > 0) {
      await User.bulkWrite(updates);
      logger.info(`Successfully renewed lives for ${updates.length} users`);
    }
  } catch (error) {
    logger.error("Life renewal error:", { error: error.message, stack: error.stack });
  }
};

const startLifeRenewalJob = () => {
  logger.info("Initializing life renewal job...");
  cron.schedule("0 */3 * * *", renewLives);
  logger.info("Life renewal job scheduled - will renew lives up to 40 every 3 hours");
};

module.exports = { startLifeRenewalJob };
