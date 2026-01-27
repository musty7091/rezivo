const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ETKİNLİK OLUŞTURMA
router.post('/create-event', async (req, res) => {
    try {
        const { tenantId, eventName, date, hasMeal, mealPrice, prepayment } = req.body;
        const newEvent = await pool.query(
            `INSERT INTO events (tenant_id, event_name, event_date, has_meal_service, meal_price, min_prepayment_amount) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [tenantId, eventName, date, hasMeal, mealPrice, prepayment]
        );
        res.status(201).json({ message: "Etkinlik Tanımlandı!", eventId: newEvent.rows[0].id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// RAPOR ALMA
router.get('/report/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const { tenantId } = req.query;
        const eventDetail = await pool.query(
            'SELECT * FROM events WHERE tenant_id = $1 AND event_date = $2', [tenantId, date]
        );
        res.json({ etkinlikBilgisi: eventDetail.rows[0] || null });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;