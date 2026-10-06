const { Telegraf, Scenes, session } = require('telegraf');
const reportScene = require('./scenes/report');
const registerMenu = require('./handlers/menu');

function createBot(token) {
  if (!token) throw new Error('BOT_TOKEN не задан');
  const bot = new Telegraf(token);

  const stage = new Scenes.Stage([reportScene]);
  bot.use(session());
  bot.use(stage.middleware());
  registerMenu(bot);

  bot.catch((err, ctx) => {
    console.error(`[bot] ошибка для ${ctx.updateType}:`, err);
  });

  return bot;
}

module.exports = { createBot };
