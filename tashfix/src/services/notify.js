const Problem = require('../models/Problem');
const { districtName } = require('../config/districts');
const { typeInfo, STATUSES } = require('../config/problemTypes');
const { esc, shortId } = require('../bot/helpers');

const DELAY_MS = 70; // ~14 сообщений/сек, с запасом до лимита Telegram (~30/сек)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Все, кто сообщал или подтверждал проблемы в этом районе
async function getRecipients(district) {
  const rows = await Problem.find({ district }, 'reporterTelegramId confirmedBy').lean();
  const ids = new Set();
  for (const p of rows) {
    ids.add(p.reporterTelegramId);
    (p.confirmedBy || []).forEach((id) => ids.add(id));
  }
  return [...ids];
}

function buildText(problem, note) {
  const t = typeInfo(problem.type);
  const lines = [
    `🔔 <b>Обновление по проблеме #${shortId(problem._id)}</b>`,
    `${t.emoji} ${esc(t.name)}`,
    `📍 ${esc(districtName(problem.district))}, ${esc(problem.address)}`,
    `Новый статус: <b>${STATUSES[problem.status]}</b>`,
  ];
  if (note) lines.push('', `💬 ${esc(note)}`);
  return lines.join('\n');
}

async function sendOne(bot, id, text) {
  try {
    await bot.telegram.sendMessage(id, text, { parse_mode: 'HTML' });
    return true;
  } catch (err) {
    const code = err.response?.error_code;
    if (code === 429) {
      // флуд-лимит: ждём сколько просит Telegram и пробуем один раз
      const wait = (err.response?.parameters?.retry_after || 1) * 1000;
      await sleep(wait);
      try {
        await bot.telegram.sendMessage(id, text, { parse_mode: 'HTML' });
        return true;
      } catch (e2) {
        console.warn(`[notify] ${id}: повтор не удался: ${e2.message}`);
        return false;
      }
    }
    // 403 — бот заблокирован, 400 — чат не найден и т.п. Не падаем.
    console.warn(`[notify] ${id}: ${code || ''} ${err.message}`);
    return false;
  }
}

// Запускается в фоне (не блокирует ответ API)
async function notifyStatusChange(bot, problem, note) {
  const recipients = await getRecipients(problem.district);
  const text = buildText(problem, note);
  let sent = 0;
  for (const id of recipients) {
    if (await sendOne(bot, id, text)) sent++;
    await sleep(DELAY_MS);
  }
  console.log(`[notify] #${shortId(problem._id)}: доставлено ${sent}/${recipients.length}`);
  return { total: recipients.length, sent };
}

module.exports = { notifyStatusChange, getRecipients };
