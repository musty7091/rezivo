const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('connect', () => {
  console.log("🚀 REZIVO: Master Veritabanına (Neon) Başarıyla Bağlanıldı!");
});

pool.on('error', (err) => {
    console.error('Beklenmedik veritabanı hatası:', err);
    process.exit(-1);
});

module.exports = pool;