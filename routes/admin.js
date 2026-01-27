const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GELİŞMİŞ GÜNLÜK RAPOR: Doluluk barlarını ve etkinlik bilgisini besler
router.get('/report/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const { tenantId } = req.query;

        // 1. O günkü etkinlik bilgisi
        const eventDetail = await pool.query(
            'SELECT * FROM events WHERE tenant_id = $1 AND event_date = $2', 
            [tenantId, date]
        );

        // 2. Alan bazlı doluluk oranları (Görseldeki % barları için)
        const occupancyDetail = await pool.query(
            `SELECT a.area_name, a.total_capacity, 
             COALESCE(SUM(r.guest_count), 0) as current_guests
             FROM areas a
             LEFT JOIN reservations r ON a.id = r.area_id AND r.reservation_date = $2
             WHERE a.tenant_id = $1
             GROUP BY a.id, a.area_name, a.total_capacity`,
            [tenantId, date]
        );

        res.json({ 
            etkinlikBilgisi: eventDetail.rows[0] || null,
            dolulukOranlari: occupancyDetail.rows 
        });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

module.exports = router;