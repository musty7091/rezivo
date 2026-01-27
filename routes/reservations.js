const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// YENİ REZERVASYON OLUŞTURMA (TAM VERSİYON)
router.post('/create', async (req, res) => {
    const { tenantId, customerName, phone, areaId, guestCount, date, time } = req.body;

    try {
        // 1. Kapasite Kontrolü
        const areaInfo = await pool.query('SELECT total_capacity, area_name FROM areas WHERE id = $1', [areaId]);
        const capacity = areaInfo.rows[0].total_capacity;

        const currentOccupancy = await pool.query(
            'SELECT SUM(guest_count) as filled FROM reservations WHERE area_id = $1 AND reservation_date = $2',
            [areaId, date]
        );
        const filled = parseInt(currentOccupancy.rows[0].filled || 0);

        if (filled + parseInt(guestCount) > capacity) {
            return res.status(400).json({ 
                error: `Üzgünüz, ${areaInfo.rows[0].area_name} alanı dolmuştur.`,
                mevcutBosYer: capacity - filled 
            });
        }

        // 2. Etkinlik ve Kaporo Kontrolü
        const eventCheck = await pool.query(
            'SELECT * FROM events WHERE tenant_id = $1 AND event_date = $2',
            [tenantId, date]
        );

        let eventId = null;
        let note = "Standart Gün";
        let requiredPrepayment = 0;

        if (eventCheck.rows.length > 0) {
            const event = eventCheck.rows[0];
            eventId = event.id;
            note = `Özel Etkinlik: ${event.event_name}`;
            requiredPrepayment = event.min_prepayment_amount * guestCount;
        }

        // 3. Müşteri Kaydı
        let customer = await pool.query('SELECT id FROM customers WHERE phone = $1', [phone]);
        let customerId;

        if (customer.rows.length === 0) {
            const newCustomer = await pool.query(
                'INSERT INTO customers (tenant_id, full_name, phone) VALUES ($1, $2, $3) RETURNING id',
                [tenantId, customerName, phone]
            );
            customerId = newCustomer.rows[0].id;
        } else {
            customerId = customer.rows[0].id;
        }

        // 4. Rezervasyon Kaydı
        const newRes = await pool.query(
            `INSERT INTO reservations 
            (tenant_id, customer_id, area_id, event_id, guest_count, reservation_date, reservation_time, status) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [tenantId, customerId, areaId, eventId, guestCount, date, time, 'pending_payment']
        );

        res.status(201).json({
            message: "Rezervasyon Taslağı Oluşturuldu!",
            info: note,
            totalPrepayment: requiredPrepayment,
            reservationId: newRes.rows[0].id
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "İşlem sırasında bir hata oluştu: " + err.message });
    }
});

// LİSTELEME, SİLME VE DURUM GÜNCELLEME KODLARINI DA BURAYA AYNI ŞEKİLDE EKLE
module.exports = router;