const Problem = require('../../models/Problem');
const { DISTRICT_CODES, districtName } = require('../../config/districts');
const { typeInfo, STATUSES } = require('../../config/problemTypes');
const {
  esc, shortId, mainMenu, districtKeyboard,
  cardText, confirmKeyboard, sendCard, editCard,
} = require('../helpers');
const { Markup } = require('telegraf');

const PAGE_SIZE = 5;

module.exports = function registerMenu(bot) {
  // ---------- /start ----------
  bot.start((ctx) =>
    ctx.reply(
      '👋 Привет! Это <b>TashFix</b> — сообщайте о городских проблемах Ташкента и следите за их решением.',
      { parse_mode: 'HTML', ...mainMenu() }
    )
  );

  bot.action('menu:main', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('Главное меню:', mainMenu());
  });

  // ---------- ➕ сообщить ----------
  bot.action('menu:new', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.enter('report');
  });

  // ---------- 📋 проблемы в районе ----------
  bot.action('menu:list', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('Выберите район:', districtKeyboard((c) => `ld:${c}:0`));
  });

  bot.action(/^ld:([a-z_]+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const [, district, pageStr] = ctx.match;
    if (!DISTRICT_CODES.includes(district)) return;
    const page = Number(pageStr);
    const uid = ctx.from.id;

    // активные проблемы района, по числу подтверждений
    const filter = { district, status: { $ne: 'resolved' } };
    const [items, total] = await Promise.all([
      Problem.aggregate([
        { $match: filter },
        { $addFields: { confirmCount: { $size: '$confirmedBy' } } },
        { $sort: { confirmCount: -1, createdAt: -1 } },
        { $skip: page * PAGE_SIZE },
        { $limit: PAGE_SIZE },
      ]),
      Problem.countDocuments(filter),
    ]);

    if (!total) {
      return ctx.reply(`В районе «${districtName(district)}» активных проблем нет 👍`, mainMenu());
    }

    for (const p of items) await sendCard(ctx, p, uid);

    const pages = Math.ceil(total / PAGE_SIZE);
    const nav = [];
    if (page > 0) nav.push(Markup.button.callback('⬅️ Назад', `ld:${district}:${page - 1}`));
    if (page < pages - 1) nav.push(Markup.button.callback('Дальше ➡️', `ld:${district}:${page + 1}`));
    nav.push(Markup.button.callback('🏠 Меню', 'menu:main'));
    await ctx.reply(`${districtName(district)} — стр. ${page + 1}/${pages}`, Markup.inlineKeyboard([nav]));
  });

  // ---------- ✅ подтверждение (идемпотентно) ----------
  bot.action(/^cf:([a-f0-9]{24})$/, async (ctx) => {
    const uid = ctx.from.id;
    const updated = await Problem.findOneAndUpdate(
      {
        _id: ctx.match[1],
        confirmedBy: { $ne: uid },
        reporterTelegramId: { $ne: uid },
      },
      { $addToSet: { confirmedBy: uid } },
      { new: true }
    );
    await ctx.answerCbQuery(updated ? 'Спасибо, учтено!' : undefined);
    if (!updated) return; // уже подтверждено / своя проблема — молча игнорируем

    try {
      await editCard(ctx, cardText(updated, { viewerId: uid }), confirmKeyboard(updated, uid));
    } catch (e) {
      if (!/message is not modified/i.test(e.message)) console.error('[bot] editCard:', e.message);
    }
  });

  // ---------- 🏠 мои сообщения ----------
  bot.action('menu:mine', async (ctx) => {
    await ctx.answerCbQuery();
    const uid = ctx.from.id;
    const items = await Problem.find({
      $or: [{ reporterTelegramId: uid }, { confirmedBy: uid }],
    })
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();

    if (!items.length) {
      return ctx.reply('У вас пока нет сообщений. Нажмите «Сообщить о проблеме».', mainMenu());
    }

    const lines = items.map((p) => {
      const t = typeInfo(p.type);
      const role = p.reporterTelegramId === uid ? 'вы сообщили' : 'вы подтвердили';
      return `${t.emoji} #${shortId(p._id)} — ${esc(districtName(p.district))}, ${esc(p.address)}\n   ${STATUSES[p.status]} · ${role}`;
    });
    await ctx.reply(`<b>Мои сообщения:</b>\n\n${lines.join('\n\n')}`, {
      parse_mode: 'HTML',
      ...mainMenu(),
    });
  });
};
