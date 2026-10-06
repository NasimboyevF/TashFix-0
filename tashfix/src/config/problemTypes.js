const PROBLEM_TYPES = [
  { code: 'trash',      emoji: '🗑',  name: 'Урна / мусор' },
  { code: 'light',      emoji: '💡', name: 'Фонарь / освещение' },
  { code: 'road',       emoji: '🕳',  name: 'Яма / дорога' },
  { code: 'playground', emoji: '🛝',  name: 'Площадка' },
  { code: 'water',      emoji: '💧', name: 'Вода' },
  { code: 'other',      emoji: '⚠️', name: 'Другое' },
];

const TYPE_CODES = PROBLEM_TYPES.map((t) => t.code);
const typeInfo = (code) => PROBLEM_TYPES.find((t) => t.code === code) || PROBLEM_TYPES[5];

const STATUSES = {
  new:         '🆕 Новая',
  review:      '🔍 На проверке',
  in_progress: '🛠 В работе',
  resolved:    '✅ Решена',
};

module.exports = { PROBLEM_TYPES, TYPE_CODES, typeInfo, STATUSES };
