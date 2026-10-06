require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDb } = require('./db');
const { createBot } = require('./bot');
const { requireAuth } = require('./middleware/auth');

async function main() {
  for (const k of ['BOT_TOKEN', 'MONGODB_URI', 'JWT_SECRET']) {
    if (!process.env[k]) throw new Error(`${k} не задан в .env`);
  }

  await connectDb(process.env.MONGODB_URI);
  const bot = createBot(process.env.BOT_TOKEN);

  const app = express();
  app.set('trust proxy', 1); // за nginx, чтобы req.ip был настоящим
  app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/problems', requireAuth, require('./routes/problems')(bot));
  app.use('/api/stats', requireAuth, require('./routes/stats'));

  app.use((_req, res) => res.status(404).json({ error: 'Не найдено' }));
  app.use((err, _req, res, _next) => {
    console.error('[api]', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  });

  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`[api] http://localhost:${port}`));

  // launch() в telegraf 4.x может не резолвиться до остановки — не await'им
  bot.launch().catch((e) => {
    console.error('[bot] не удалось запустить:', e);
    process.exit(1);
  });
  console.log('[bot] запущен (long polling)');

  const stop = (sig) => () => bot.stop(sig);
  process.once('SIGINT', stop('SIGINT'));
  process.once('SIGTERM', stop('SIGTERM'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
