const express = require('express');
const cors = require('cors');
const path = require('path'); // Yeni eklendi: Dosya yolları için
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// YÜKLENEN RESİMLERİN DIŞARIDAN ERİŞİLMESİ İÇİN (Static Folder)
// Artık dükkan afişlerine http://localhost:5000/uploads/resim.jpg şeklinde ulaşılabilecek.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const reservationRoutes = require('./routes/reservations');
const adminRoutes = require('./routes/admin');
const superadminRoutes = require('./routes/superadmin');
const authRoutes = require('./routes/auth');

app.use('/api/reservations', reservationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Rezivo Modüler Sistem ${PORT} portunda tam kapasite çalışıyor!`));