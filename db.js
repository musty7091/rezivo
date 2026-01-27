const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// Neon bulut veritabanına bağlanmak için gerekli ayarlar
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Bulut veritabanı güvenliği için bu satır şarttır
  }
});

// Bağlantı başarılı olduğunda terminale haber ver
pool.on('connect', () => {
  console.log('☁️  RES-SAAS: Bulut Veritabanına (Neon) Başarıyla Bağlanıldı!');
});

module.exports = pool;