const express = require('express');
const router = express.Router();
const pool = require('../config/db');

/**
 * 1. TAM LİSTELEME (Operasyonel Görünüm)
 * Yeni veritabanındaki yemek notları ve masa bilgilerini de getirir.
 */
router.get('/list/:date', async (req, res) => {
    const { date } = req.params;
    const { tenantId } = req.query;
    try {
        const list = await pool.query(
            `SELECT r.*, c.full_name, c.phone, c.reliability_score, a.area_name 
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

/**
 * 2. MASTER KAYIT (Mutfak, Garson ve Kapasite Zekasıyla)
 * Artık yemek tercihi, özel notlar ve masa bilgisi de kaydediliyor.
 */
router.post('/create', async (req, res) => {
    const { 
        tenantId, customerName, phone, areaId, guestCount, 
        date, time, isMealIncluded, specialNotes, tableInfo, userId 
    } = req.body;

    try {
        await pool.query('BEGIN');

        // Kapasite Kontrolü
        const areaInfo = await pool.query('SELECT total_capacity, area_name FROM areas WHERE id = $1', [areaId]);
        const capacity = areaInfo.rows[0].total_capacity;
        const currentOccupancy = await pool.query(
            'SELECT SUM(guest_count) as filled FROM reservations WHERE area_id = $1 AND reservation_date = $2 AND status != $3', 
            [areaId, date, 'cancelled']
        );
        const filled = parseInt(currentOccupancy.rows[0].filled || 0);

        if (filled + parseInt(guestCount) > capacity) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ 
                error: `${areaInfo.rows[0].area_name} kapasitesi yetersiz!`, 
                mevcutBosYer: capacity - filled 
            });
        }

        // Müşteri Kayıt veya Güncelleme
        let customer = await pool.query('SELECT id FROM customers WHERE phone = $1 AND tenant_id = $2', [phone, tenantId]);
        let customerId;
        if (customer.rows.length === 0) {
            const newCust = await pool.query(
                'INSERT INTO customers (tenant_id, full_name, phone) VALUES ($1, $2, $3) RETURNING id',
                [tenantId, customerName, phone]
            );
            customerId = newCust.rows[0].id;
        } else {
            customerId = customer.rows[0].id;
        }

        // Etkinlik Kontrolü
        const eventCheck = await pool.query('SELECT id, min_prepayment_amount FROM events WHERE tenant_id = $1 AND event_date = $2', [tenantId, date]);
        let eventId = eventCheck.rows.length > 0 ? eventCheck.rows[0].id : null;
        let prepayment = eventCheck.rows.length > 0 ? (eventCheck.rows[0].min_prepayment_amount * guestCount) : 0;

        // Rezervasyonu Kaydet (Yeni Sütunlarla)
        const newRes = await pool.query(
            `INSERT INTO reservations (
                tenant_id, customer_id, area_id, event_id, guest_count, 
                reservation_date, reservation_time, is_meal_included, special_notes, table_info, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'confirmed') RETURNING id`,
            [tenantId, customerId, areaId, eventId, guestCount, date, time, isMealIncluded, specialNotes, tableInfo]
        );

        // İşlem Kaydı (Activity Log)
        await pool.query(
            'INSERT INTO activity_logs (tenant_id, user_id, action, details) VALUES ($1, $2, $3, $4)',
            [tenantId, userId, 'YENI_REZERVASYON', JSON.stringify({ reservationId: newRes.rows[0].id, guestCount })]
        );

        await pool.query('COMMIT');
        res.status(201).json({ 
            success: true, 
            message: "Kayıt Başarılı!", 
            prepaymentRequired: prepayment,
            reservationId: newRes.rows[0].id 
        });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error("Kayıt hatası:", err.message);
        res.status(500).json({ error: "Sistem hatası: " + err.message });
    }
});

/**
 * 3. GELECEK TAKVİMİ (Tüm Personel İçin)
 * Personelin ileri tarihli etkinlikleri görmesini sağlar.
 */
router.get('/upcoming-events/:tenantId', async (req, res) => {
    try {
        const { tenantId } = req.params;
        const result = await pool.query(
            `SELECT * FROM events 
             WHERE tenant_id = $1 AND event_date >= CURRENT_DATE 
             ORDER BY event_date ASC`,
            [tenantId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Takvim çekilemedi." });
    }
});

/**
 * 4. MUTFAK RAPORU (Özel Sorgu)
 * Belirli bir tarihteki toplam yemek sayısını ve özel notları getirir.
 */
router.get('/kitchen-report/:tenantId/:date', async (req, res) => {
    try {
        const { tenantId, date } = req.params;
        const result = await pool.query(
            `SELECT 
                SUM(guest_count) FILTER (WHERE is_meal_included = true) as total_meals,
                COUNT(*) as total_reservations,
                json_agg(special_notes) FILTER (WHERE special_notes IS NOT NULL) as notes
             FROM reservations 
             WHERE tenant_id = $1 AND reservation_date = $2 AND status != 'cancelled'`,
            [tenantId, date]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Mutfak raporu hatası." });
    }
});

/**
 * 5. DURUM GÜNCELLEME VE SİLME
 */
router.patch('/update-status/:id', async (req, res) => {
    const { status, userId, tenantId } = req.body;
    try {
        await pool.query('UPDATE reservations SET status = $1 WHERE id = $2', [status, req.params.id]);
        
        // Logla
        await pool.query(
            'INSERT INTO activity_logs (tenant_id, user_id, action, details) VALUES ($1, $2, $3, $4)',
            [tenantId, userId, 'DURUM_GUNCELLEME', JSON.stringify({ resId: req.params.id, newStatus: status })]
        );
        
        res.json({ success: true, message: "Durum güncellendi." });
    } catch (err) {
        res.status(500).json({ error: "Güncelleme hatası." });
    }
});

router.delete('/delete/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM reservations WHERE id = $1', [req.params.id]);
        res.json({ message: "Rezervasyon tamamen silindi." });
    } catch (err) {
        res.status(500).json({ error: "Silme hatası." });
    }
});

/**
 * 6. ALAN LİSTELEME (Personel Paneli İçin)
 * Personel panelindeki hızlı kayıt modalında alanların görünmesini sağlar.
 */
router.get('/areas/:tenantId', async (req, res) => {
    try {
        const { tenantId } = req.params;
        const areas = await pool.query(
            'SELECT id, area_name, total_capacity FROM areas WHERE tenant_id = $1', 
            [tenantId]
        );
        res.json(areas.rows);
    } catch (err) {
        console.error("Alan çekme hatası:", err.message);
        res.status(500).json({ error: "Alanlar yüklenemedi." });
    }
});

/**
 * 7. AKTİF PERSONEL LİSTESİ
 * Personel panelinde o günkü rezervasyonları listeler.
 */
router.get('/active-staff/:tenantId', async (req, res) => {
    try {
        const { tenantId } = req.params;
        const result = await pool.query(
            `SELECT r.*, c.full_name, a.area_name 
             FROM reservations r 
             JOIN customers c ON r.customer_id = c.id 
             LEFT JOIN areas a ON r.area_id = a.id
             WHERE r.tenant_id = $1 AND r.reservation_date = CURRENT_DATE
             ORDER BY r.reservation_time ASC`,
            [tenantId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Liste çekilemedi." });
    }
});

module.exports = router;