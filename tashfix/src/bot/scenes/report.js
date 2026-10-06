const { Scenes, Markup } = require('telegraf');
const Problem = require('../../models/Problem');
const { DISTRICT_CODES, districtName } = require('../../config/districts');
const { PROBLEM_TYPES, TYPE_CODES, typeInfo } = require('../../config/problemTypes');
const { districtKeyboard, mainMenu, esc, shortId } = require('../helpers');

const scene = new Scenes.BaseScene('report');

const cancelRow = [Markup.button.callback('✖️ Отмена', 'r:cancel')];

const typeKeyboard = () => {
  const btns = PROBLEM_TYPES.map((t) => Markup.button.callback(`${t.emoji} ${t.name}`, `rt:${t.code}`));
  const rows = [];
  for (let i = 0; i < btns.length; i += 2) rows.push(btns.slice(i, i + 2));
  rows.push(cancelRow);
  return Markup.inlineKeyboard(rows);
};

const data = (ctx) => ctx.scene.state.data;
const step = (ctx) => ctx.scene.state.step;
const setStep = (ctx, s) => (ctx.scene.state.step = s);

async function exit(ctx, text) {
  await ctx.scene.leave();
  return ctx.reply(text, mainMenu());
}

// --- вход ---
scene.enter(async (ctx) => {
  ctx.scene.state.data = {};
  setStep(ctx, 'district');
  const kb = districtKeyboard((c) => `rd:${c}`);
  kb.reply_markup.inline_keyboard.push(cancelRow);
  await ctx.reply('Шаг 1/5. Выберите район:', kb);
});

// --- команды выхода ---
scene.command('cancel', (ctx) => exit(ctx, 'Отменено.'));
scene.command('start', (ctx) => exit(ctx, 'Главное меню:'));
scene.action('r:cancel', async (ctx) => {
  await ctx.answerCbQuery();
  return exit(ctx, 'Отменено.');
});

// --- 1. район ---
scene.action(/^rd:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  if (step(ctx) !== 'district') return;
  const code = ctx.match[1];
  if (!DISTRICT_CODES.includes(code)) return;
  data(ctx).district = code;
  setStep(ctx, 'type');
  await ctx.reply(`Район: ${districtName(code)}\n\nШаг 2/5. Тип проблемы:`, typeKeyboard());
});

// --- 2. тип ---
scene.action(/^rt:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  if (step(ctx) !== 'type') return;
  const code = ctx.match[1];
  if (!TYPE_CODES.includes(code)) return;
  data(ctx).type = code;
  setStep(ctx, 'photo');
  await ctx.reply(
    'Шаг 3/5. Пришлите фото проблемы или нажмите «Пропустить».',
    Markup.inlineKeyboard([[Markup.button.callback('⏭ Пропустить', 'r:skip')], cancelRow])
  );
});

// --- 3. фото ---
async function askAddress(ctx) {
  setStep(ctx, 'address');
  await ctx.reply(
    'Шаг 4/5. Напишите адрес (уточнение внутри района), например: «12-й квартал, дом 5».',
    Markup.inlineKeyboard([cancelRow])
  );
}

scene.action('r:skip', async (ctx) => {
  await ctx.answerCbQuery();
  if (step(ctx) !== 'photo') return;
  data(ctx).photoFileId = null;
  await askAddress(ctx);
});

scene.on('photo', async (ctx) => {
  if (step(ctx) !== 'photo') return;
  const sizes = ctx.message.photo;
  data(ctx).photoFileId = sizes[sizes.length - 1].file_id; // самое большое разрешение
  await askAddress(ctx);
});

// --- 4–5. текстовые шаги ---
scene.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  const s = step(ctx);

  if (s === 'address') {
    if (text.length < 3 || text.length > 200) {
      return ctx.reply('Адрес должен быть от 3 до 200 символов. Попробуйте ещё раз.');
    }
    data(ctx).address = text;
    setStep(ctx, 'description');
    return ctx.reply('Шаг 5/5. Опишите проблему (до 500 символов).', Markup.inlineKeyboard([cancelRow]));
  }

  if (s === 'description') {
    if (text.length < 3 || text.length > 500) {
      return ctx.reply('Описание должно быть от 3 до 500 символов. Попробуйте ещё раз.');
    }
    data(ctx).description = text;
    setStep(ctx, 'confirm');
    const d = data(ctx);
    const t = typeInfo(d.type);
    const preview =
      `<b>Проверьте данные:</b>\n\n` +
      `${t.emoji} ${esc(t.name)}\n` +
      `📍 ${esc(districtName(d.district))}, ${esc(d.address)}\n` +
      `📝 ${esc(d.description)}\n` +
      `📷 Фото: ${d.photoFileId ? 'есть' : 'нет'}`;
    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('✅ Отправить', 'r:ok'), Markup.button.callback('✖️ Отмена', 'r:cancel')],
    ]);
    const extra = { parse_mode: 'HTML', ...kb };
    return d.photoFileId
      ? ctx.replyWithPhoto(d.photoFileId, { caption: preview, ...extra })
      : ctx.reply(preview, extra);
  }

  if (s === 'photo') return ctx.reply('Пришлите фото или нажмите «Пропустить».');
  return ctx.reply('Пожалуйста, используйте кнопки выше или /cancel для выхода.');
});

// --- 6–8. сохранение ---
scene.action('r:ok', async (ctx) => {
  await ctx.answerCbQuery();
  if (step(ctx) !== 'confirm') return;
  const d = data(ctx);
  const from = ctx.from;
  const name = [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || '';

  const problem = await Problem.create({
    type: d.type,
    title: typeInfo(d.type).name,
    description: d.description,
    district: d.district,
    address: d.address,
    photoFileId: d.photoFileId || null,
    reporterTelegramId: from.id,
    reporterName: name,
    status: 'new',
    statusHistory: [{ status: 'new', note: '' }],
  });

  await ctx.scene.leave();
  await ctx.reply(`✅ Проблема отправлена. Номер #${shortId(problem._id)}`, mainMenu());
});

module.exports = scene;
