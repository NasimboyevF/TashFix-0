const mongoose = require('mongoose');

async function connectDb(uri) {
  if (!uri) throw new Error('MONGODB_URI не задан');
  await mongoose.connect(uri);
  console.log('[db] MongoDB подключена');
}

module.exports = { connectDb };
