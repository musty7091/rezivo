const express = require('express');
const cors = require('cors');
require('dotenv').config(); //

const app = express();
app.use(cors());
app.use(express.json());

const reservationRoutes = require('./routes/reservations'); //
const adminRoutes = require('./routes/admin'); //
const superadminRoutes = require('./routes/superadmin');
const authRoutes = require('./routes/auth');

app.use('/api/reservations', reservationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 5000; //
app.listen(PORT, () => console.log(`🚀 Rezivo Modüler Sistem ${PORT} portunda tam kapasite çalışıyor!`));