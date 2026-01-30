const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer'); 
const path = require('path'); 
const bcrypt = require('bcryptjs'); // Şifreleme için eklendi

// DOSYA YÜKLEME AYARLARI (MULTER)
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, 'event-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

/**
 * 🖼️ ETKİNLİK GÖRSELİ YÜKLEME
 */
router.post('/upload-event-image', upload.single('eventImage'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Dosya yüklenemedi." });
    res.json({ imageUrl: `/uploads/${req.file.filename}` });
});

/**
 * 📊 GELİŞMİŞ GÜNLÜK RAPOR
 * Yeni şemadaki yemek hizmeti verilerini de kapsar.
 */
router.get('/report/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const { tenantId } = req.query;

        const eventDetail = await pool.query(
            'SELECT * FROM events WHERE tenant_id = $1 AND event_date = $2', 
            [tenantId, date]
        );

        const occupancyDetail = await pool.query(
            `SELECT a.area_name, a.total_capacity, 
             COALESCE(SUM(r.guest_count), 0) as current_guests,
             COUNT(r.id) FILTER (WHERE r.is_meal_included = true) as total_meals
             FROM areas a
             LEFT JOIN reservations r ON a.id = r.area_id AND r.reservation_date = $2 AND r.status != 'cancelled'
             WHERE a.tenant_id = $1
             GROUP BY a.id, a.area_name, a.total_capacity`,
            [tenantId, date]
        );

        res.json({ 
            etkinlikBilgisi: eventDetail.rows[0] || null,
            dolulukOranlari: occupancyDetail.rows 
        });
    } catch (err) { 
        console.error("Rapor çekme hatası:", err.message);
        res.status(500).json({ error: "Rapor verileri alınamadı." }); 
    }
});

/**
 * 👥 İŞLETME SAHİBİ İÇİN PERSONEL EKLEME
 * staff_hostess, staff_waiter, staff_kitchen rollerini destekler.
 */
router.post('/add-staff', async (req, res) => {
    const { tenantId, email, username, password, role } = req.body;
    
    if (!tenantId || tenantId === "undefined") {
        return res.status(400).json({ error: "İşletme kimliği eksik." });
    }

    try {
        // GÜNCELLEME: Personel şifresi kaydedilmeden önce şifreleniyor
        const salt = await bcrypt.genSalt(10);
        const hashedPass = await bcrypt.hash(password, salt);

        await pool.query(
            `INSERT INTO users (tenant_id, email, username, password_hash, role, is_active) 
             VALUES ($1, $2, $3, $4, $5, true)`,
            [parseInt(tenantId), email, username, hashedPass, role]
        );
        res.status(201).json({ success: true, message: "Personel başarıyla tanımlandı." });
    } catch (err) {
        console.error("Personel ekleme hatası:", err.message);
        res.status(500).json({ success: false, error: "Bu e-posta zaten kullanımda." });
    }
});

/**
 * 📋 PERSONEL LİSTELEME
 */
router.get('/staff/:tenantId', async (req, res) => {
    try {
        const { tenantId } = req.params;
        const result = await pool.query(
            'SELECT id, username, email, role, is_active FROM users WHERE tenant_id = $1 AND role NOT IN ($2, $3) ORDER BY id DESC', 
            [parseInt(tenantId), 'superadmin', 'owner']
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Personel listesi alınamadı." });
    }
});

/**
 * ❌ PERSONEL SİLME
 */
router.delete('/staff/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: "Personel başarıyla silindi." });
    } catch (err) {
        res.status(500).json({ error: "Silme işlemi başarısız." });
    }
});

/**
 * 📅 ETKİNLİK OLUŞTURMA (NİHAİ)
 * has_meal_service ve meal_price alanlarını doldurur, istatistikleri günceller.
 */
router.post('/create-event', async (req, res) => {
    const { 
        tenantId, eventName, eventDate, prepaymentAmount, description,
        imageUrl, doorTime, startTime, endTime, capacity, hasMeal, mealPrice 
    } = req.body;

    try {
        await pool.query('BEGIN');

        const result = await pool.query(
            `INSERT INTO events (
                tenant_id, event_name, event_date, min_prepayment_amount, description,
                image_url, door_open_time, event_start_time, event_end_time, total_capacity,
                has_meal_service, meal_price
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
            [tenantId, eventName, eventDate, prepaymentAmount, description, imageUrl, doorTime, startTime, endTime, capacity, hasMeal, mealPrice]
        );

        // SüperAdmin İstatistik Güncelleme
        await pool.query('UPDATE tenants SET total_events_created = total_events_created + 1 WHERE id = $1', [tenantId]);

        await pool.query('COMMIT');
        res.status(201).json({ success: true, message: "Etkinlik başarıyla oluşturuldu.", eventId: result.rows[0].id });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error("Etkinlik oluşturma hatası:", err.message);
        res.status(500).json({ error: "Etkinlik oluşturulamadı." });
    }
});

/**
 * 🔍 ETKİNLİKLERİ LİSTELE
 */
router.get('/events/:tenantId', async (req, res) => {
    try {
        const { tenantId } = req.params;
        const result = await pool.query(
            'SELECT * FROM events WHERE tenant_id = $1 ORDER BY event_date DESC',
            [parseInt(tenantId)]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Etkinlikler listelenemedi." });
    }
});

/**
 * 🗑️ ETKİNLİK SİLME
 */
router.delete('/events/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM events WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: "Etkinlik silindi." });
    } catch (err) {
        res.status(500).json({ error: "Silme işlemi başarısız." });
    }
});

/**
 * 📝 ETKİNLİK GÜNCELLEME
 */
router.patch('/events/:id', async (req, res) => {
    const { id } = req.params;
    const { 
        eventName, eventDate, prepaymentAmount, description,
        imageUrl, doorTime, startTime, endTime, capacity, hasMeal, mealPrice 
    } = req.body;
    try {
        await pool.query(
            `UPDATE events SET 
                event_name = $1, event_date = $2, min_prepayment_amount = $3, 
                description = $4, image_url = $5, door_open_time = $6, 
                event_start_time = $7, event_end_time = $8, total_capacity = $9,
                has_meal_service = $10, meal_price = $11
             WHERE id = $12`,
            [eventName, eventDate, prepaymentAmount, description, imageUrl, doorTime, startTime, endTime, capacity, hasMeal, mealPrice, id]
        );
        res.json({ success: true, message: "Etkinlik güncellendi." });
    } catch (err) {
        res.status(500).json({ error: "Güncelleme başarısız." });
    }
});

module.exports = router;