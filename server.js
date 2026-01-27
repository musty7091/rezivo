const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Parçaları Dahil Et
const reservationRoutes = require('./routes/reservations');
const adminRoutes = require('./routes/admin');

// Parçaları Adreslere Bağla
app.use('/api/reservations', reservationRoutes);
app.use('/api/admin', adminRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Sistem modüler olarak ${PORT} portunda yayında!`));