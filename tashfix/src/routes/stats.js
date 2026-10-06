const express = require('express');
const Problem = require('../models/Problem');

const router = express.Router();

// active = new + in_progress; review и resolved считаются отдельно
router.get('/', async (_req, res) => {
  const rows = await Problem.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
  const by = Object.fromEntries(rows.map((r) => [r._id, r.n]));
  const count = (s) => by[s] || 0;
  res.json({
    total: rows.reduce((a, r) => a + r.n, 0),
    active: count('new') + count('in_progress'),
    review: count('review'),
    resolved: count('resolved'),
    byStatus: { new: count('new'), review: count('review'), in_progress: count('in_progress'), resolved: count('resolved') },
  });
});

module.exports = router;
