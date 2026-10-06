const express = require('express');
const mongoose = require('mongoose');
const Problem = require('../models/Problem');
const { DISTRICT_CODES } = require('../config/districts');
const { notifyStatusChange } = require('../services/notify');

const STATUS_LIST = ['new', 'review', 'in_progress', 'resolved'];

// file_id наружу не отдаём, только флаг
const toDto = (p) => {
  const { photoFileId, ...rest } = p;
  return { ...rest, hasPhoto: !!photoFileId, confirmCount: (p.confirmedBy || []).length };
};

module.exports = function problemsRouter(bot) {
  const router = express.Router();

  // GET /api/problems?district=&status=  (сортировка по числу подтверждений)
  router.get('/', async (req, res) => {
    const { district, status } = req.query;
    const filter = {};
    if (district) {
      if (!DISTRICT_CODES.includes(district)) return res.status(400).json({ error: 'Неизвестный район' });
      filter.district = district;
    }
    if (status) {
      if (!STATUS_LIST.includes(status)) return res.status(400).json({ error: 'Неизвестный статус' });
      filter.status = status;
    }

    const rows = await Problem.aggregate([
      { $match: filter },
      { $addFields: { confirmCount: { $size: '$confirmedBy' } } },
      { $sort: { confirmCount: -1, createdAt: -1 } },
      { $limit: 500 },
    ]);
    res.json(rows.map(toDto));
  });

  // GET /api/problems/:id
  router.get('/:id', async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Неверный id' });
    const p = await Problem.findById(req.params.id).lean();
    if (!p) return res.status(404).json({ error: 'Не найдено' });
    res.json(toDto(p));
  });

  // PATCH /api/problems/:id/status  { status, note }
  router.patch('/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status, note = '' } = req.body || {};
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Неверный id' });
    if (!STATUS_LIST.includes(status)) return res.status(400).json({ error: 'Неверный статус' });
    if (typeof note !== 'string' || note.length > 500) {
      return res.status(400).json({ error: 'Сообщение жителям — строка до 500 символов' });
    }

    const problem = await Problem.findById(id);
    if (!problem) return res.status(404).json({ error: 'Не найдено' });

    // защита от спама: тот же статус или слишком частая смена
    if (problem.status === status) {
      return res.status(409).json({ error: 'Этот статус уже установлен' });
    }
    const cooldown = Number(process.env.STATUS_COOLDOWN_SEC ?? 60) * 1000;
    const last = problem.statusHistory[problem.statusHistory.length - 1];
    if (last && Date.now() - new Date(last.changedAt).getTime() < cooldown) {
      return res.status(429).json({ error: 'Статус только что менялся, подождите немного' });
    }

    problem.status = status;
    problem.statusHistory.push({ status, note: note.trim(), changedAt: new Date() });
    await problem.save();

    // рассылка в фоне, API отвечает сразу
    notifyStatusChange(bot, problem, note.trim()).catch((e) =>
      console.error('[notify] ошибка рассылки:', e)
    );

    res.json(toDto(problem.toObject()));
  });

  // GET /api/problems/:id/photo — проксируем байты, токен бота не светим
  router.get('/:id/photo', async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Неверный id' });
    const p = await Problem.findById(req.params.id, 'photoFileId').lean();
    if (!p || !p.photoFileId) return res.status(404).json({ error: 'Фото нет' });

    try {
      const link = await bot.telegram.getFileLink(p.photoFileId);
      const upstream = await fetch(link.href);
      if (!upstream.ok) throw new Error(`Telegram ответил ${upstream.status}`);
      res.set('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
      res.set('Cache-Control', 'private, max-age=3600');
      res.send(Buffer.from(await upstream.arrayBuffer()));
    } catch (e) {
      console.error('[photo]', e.message);
      res.status(502).json({ error: 'Не удалось получить фото из Telegram' });
    }
  });

  return router;
};
