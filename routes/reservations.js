const express = require('express');
const router = express.Router();
const pool = require('../config/db'); //

// 1. TAM LİSTELEME: Kapıdaki görevli ve yönetici paneli için
router.get('/list/:date', async (req, res) => {
    const { date } = req.params;
    const { tenantId } = req.query;
    try {
        const list = await pool.query(
            `SELECT r.*, c.full_name, c.phone, a.area_name 
             FROM reservations r
             JOIN customers c ON r.customer_id = c.id
             JOIN areas a ON r.area_id = a.id
             WHERE r.tenant_id = $1 AND r.reservation_date = $2
             ORDER BY r.reservation_time ASC`,
            [tenantId, date]
        );
        res.json({ kayitlar: list.rows });
    } catch (err) {
        res.status(500).json({ error: "Liste çekilemedi: " + err.message });
    }
});

// 2. TAM KAYIT: Kapasite, Etkinlik ve Kaporo Zekasıyla
router.post('/create', async (req, res) => {
    const { tenantId, customerName, phone, areaId, guestCount, date, time } = req.body;
    try {
        // Kapasite Kontrolü
        const areaInfo = await pool.query('SELECT total_capacity, area_name FROM areas WHERE id = $1', [areaId]);
        const capacity = areaInfo.rows[0].total_capacity;
        const currentOccupancy = await pool.query('SELECT SUM(guest_count) as filled FROM reservations WHERE area_id = $1 AND reservation_date = $2', [areaId, date]);
        const filled = parseInt(currentOccupancy.rows[0].filled || 0);

        if (filled + parseInt(guestCount) > capacity) {
            return res.status(400).json({ error: `${areaInfo.rows[0].area_name} dolu!`, mevcutBosYer: capacity - filled });
        }

        // Etkinlik ve Kaporo Zekası
        const eventCheck = await pool.query('SELECT * FROM events WHERE tenant_id = $1 AND event_date = $2', [tenantId, date]);
        let eventId = eventCheck.rows.length > 0 ? eventCheck.rows[0].id : null;
        let prepayment = eventCheck.rows.length > 0 ? (eventCheck.rows[0].min_prepayment_amount * guestCount) : 0;

        // Müşteri Kayıt/Kontrol
        let customer = await pool.query('SELECT id FROM customers WHERE phone = $1', [phone]);
        let customerId = customer.rows.length === 0 
            ? (await pool.query('INSERT INTO customers (tenant_id, full_name, phone) VALUES ($1, $2, $3) RETURNING id', [tenantId, customerName, phone])).rows[0].id
            : customer.rows[0].id;

        const newRes = await pool.query(
            `INSERT INTO reservations (tenant_id, customer_id, area_id, event_id, guest_count, reservation_date, reservation_time, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending_payment') RETURNING id`,
            [tenantId, customerId, areaId, eventId, guestCount, date, time]
        );

        res.status(201).json({ message: "Kayıt Başarılı!", totalPrepayment: prepayment, reservationId: newRes.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: "Kayıt hatası: " + err.message });
    }
});

// 3. TAM SİLME: Kapasiteyi anında geri açar
router.delete('/delete/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM reservations WHERE id = $1', [req.params.id]);
        res.json({ message: "Rezervasyon silindi, kapasite açıldı!" });
    } catch (err) {
        res.status(500).json({ error: "Silme hatası: " + err.message });
    }
});

// 4. DURUM GÜNCELLEME: Ödemeyi onaylayıp rengini yeşil yapar
router.patch('/update-status/:id', async (req, res) => {
    try {
        const { status } = req.body;
        await pool.query('UPDATE reservations SET status = $1 WHERE id = $2', [status, req.params.id]);
        res.json({ message: "Rezervasyon durumu güncellendi!" });
    } catch (err) {
        res.status(500).json({ error: "Güncelleme hatası: " + err.message });
    }
});

module.exports = router;