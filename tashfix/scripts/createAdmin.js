// Использование: npm run create-admin -- <username> <password> [admin|moderator]
require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Admin = require('../src/models/Admin');

(async () => {
  const [username, password, role = 'admin'] = process.argv.slice(2);
  if (!username || !password) {
    console.error('Использование: npm run create-admin -- <username> <password> [admin|moderator]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Пароль должен быть не короче 8 символов');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const passwordHash = await bcrypt.hash(password, 10);
  await Admin.findOneAndUpdate({ username }, { username, passwordHash, role }, { upsert: true, new: true });
  console.log(`Готово: ${username} (${role})`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
