const { Markup } = require('telegraf');
const { DISTRICTS, districtName } = require('../config/districts');
const { typeInfo, STATUSES } = require('../config/problemTypes');

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const shortId = (id) => String(id).slice(-6);

const mainMenu = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('📋 Проблемы в районе', 'menu:list')],
    [Markup.button.callback('➕ Сообщить о проблеме', 'menu:new')],
    [Markup.button.callback('🏠 Мои сообщения', 'menu:mine')],
  ]);

// buildData(code) -> callback_data, по 2 района в ряд
function districtKeyboard(buildData) {
  const btns = DISTRICTS.map((d) => Markup.button.callback(d.name, buildData(d.code)));
  const rows = [];
  for (let i = 0; i < btns.length; i += 2) rows.push(btns.slice(i, i + 2));
  return Markup.inlineKeyboard(rows);
}

function cardText(p, { viewerId, withDescription = true } = {}) {
  const t = typeInfo(p.type);
  const count = p.confirmedBy?.length || 0;
  const lines = [
    `${t.emoji} <b>${esc(t.name)}</b>  #${shortId(p._id)}`,
    `📍 ${esc(districtName(p.district))}, ${esc(p.address)}`,
    `Статус: ${STATUSES[p.status] || p.status}`,
    `👥 Подтвердили: ${count}`,
  ];
  if (withDescription && p.description) lines.push('', esc(p.description));
  if (viewerId && p.confirmedBy?.includes(viewerId)) lines.push('', '✔️ Вы уже подтвердили');
  return lines.join('\n');
}

function canConfirm(p, viewerId) {
  return p.reporterTelegramId !== viewerId && !p.confirmedBy?.includes(viewerId);
}

const confirmKeyboard = (p, viewerId) =>
  canConfirm(p, viewerId)
    ? Markup.inlineKeyboard([[Markup.button.callback('✅ Я тоже сталкиваюсь', `cf:${p._id}`)]])
    : Markup.inlineKeyboard([]);

async function sendCard(ctx, p, viewerId, { withButton = true } = {}) {
  const text = cardText(p, { viewerId });
  const kb = withButton ? confirmKeyboard(p, viewerId) : {};
  const extra = { parse_mode: 'HTML', ...kb };
  if (p.photoFileId) return ctx.replyWithPhoto(p.photoFileId, { caption: text, ...extra });
  return ctx.reply(text, extra);
}

// Редактирует и текстовое сообщение, и сообщение с фото (подпись)
async function editCard(ctx, text, kb) {
  const extra = { parse_mode: 'HTML', ...kb };
  const m = ctx.callbackQuery.message;
  if (m.photo) return ctx.editMessageCaption(text, extra);
  return ctx.editMessageText(text, extra);
}

module.exports = {
  esc, shortId, mainMenu, districtKeyboard,
  cardText, canConfirm, confirmKeyboard, sendCard, editCard,
};
