const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const router = express.Router();

// простейший лимит попыток входа: 10 за 15 минут с одного IP
const attempts = new Map();
const WINDOW = 15 * 60 * 1000;
const MAX = 10;

function limited(ip) {
  const now = Date.now();
  const list = (attempts.get(ip) || []).filter((t) => now - t < WINDOW);
  attempts.set(ip, list);
  return list.length >= MAX;
}

router.post('/login', async (req, res) => {
  const ip = req.ip;
  if (limited(ip)) return res.status(429).json({ error: 'Слишком много попыток, попробуйте позже' });

  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Укажите username и password' });
  }

  const admin = await Admin.findOne({ username: username.trim() });
  const ok = admin && (await bcrypt.compare(password, admin.passwordHash));
  if (!ok) {
    attempts.get(ip).push(Date.now());
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  const token = jwt.sign(
    { id: admin._id, username: admin.username, role: admin.role },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
  res.json({ token, admin: { username: admin.username, role: admin.role } });
});

module.exports = router;
