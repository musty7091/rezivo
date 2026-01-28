const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer'); 
const path = require('path'); 

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
        console.error("Rapor çekme hatası:", err.message);
        res.status(500).json({ error: err.message }); 
    }
});

/**
 * 👥 İŞLETME SAHİBİ İÇİN PERSONEL EKLEME
 */
router.post('/add-staff', async (req, res) => {
    const { tenantId, email, username, password, role } = req.body;
    console.log("Personel Kayıt İsteği:", req.body);
    if (!tenantId || tenantId === "undefined" || tenantId === "null") {
        return res.status(400).json({ 
            success: false, 
            error: "İşletme kimliği (tenantId) tanımlanamadı. Lütfen sayfayı yenileyip tekrar giriş yapın." 
        });
    }
    try {
        await pool.query(
            `INSERT INTO users (tenant_id, email, username, password_hash, role) 
             VALUES ($1, $2, $3, $4, $5)`,
            [parseInt(tenantId), email, username, password, role]
        );
        res.status(201).json({ success: true, message: "Personel başarıyla tanımlandı." });
    } catch (err) {
        console.error("Personel ekleme hatası:", err.message);
        res.status(500).json({ success: false, error: "Veritabanı hatası: " + err.message });
    }
});

/**
 * 📋 PERSONEL LİSTELEME
 */
router.get('/staff/:tenantId', async (req, res) => {
    try {
        const { tenantId } = req.params;
        if (!tenantId || tenantId === "undefined") {
            return res.status(400).json({ error: "İşletme ID eksik." });
        }
        const result = await pool.query(
            'SELECT id, username, email, role FROM users WHERE tenant_id = $1 AND role != $2 ORDER BY id DESC', 
            [parseInt(tenantId), 'admin']
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Personel listeleme hatası:", err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * ❌ PERSONEL SİLME
 */
router.delete('/staff/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        res.json({ success: true, message: "Personel başarıyla silindi." });
    } catch (err) {
        console.error("Personel silme hatası:", err.message);
        res.status(500).json({ error: "Silme işlemi başarısız." });
    }
});

/**
 * 📝 PERSONEL DÜZENLEME
 */
router.patch('/staff/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { username, email, role } = req.body;
        await pool.query(
            'UPDATE users SET username = $1, email = $2, role = $3 WHERE id = $4',
            [username, email, role, id]
        );
        res.json({ success: true, message: "Personel güncellendi." });
    } catch (err) {
        console.error("Personel güncelleme hatası:", err.message);
        res.status(500).json({ error: "Güncelleme işlemi başarısız." });
    }
});

/**
 * 📅 ETKİNLİK OLUŞTURMA (ZENGİNLEŞTİRİLMİŞ)
 */
router.post('/create-event', async (req, res) => {
    const { 
        tenantId, eventName, eventDate, prepaymentAmount, description,
        imageUrl, doorTime, startTime, endTime, capacity 
    } = req.body;
    try {
        await pool.query(
            `INSERT INTO events (
                tenant_id, event_name, event_date, min_prepayment_amount, description,
                image_url, door_open_time, event_start_time, event_end_time, total_capacity
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [tenantId, eventName, eventDate, prepaymentAmount, description, imageUrl, doorTime, startTime, endTime, capacity]
        );
        res.status(201).json({ success: true, message: "Etkinlik başarıyla oluşturuldu." });
    } catch (err) {
        console.error("Etkinlik oluşturma hatası:", err.message);
        res.status(500).json({ error: "Etkinlik oluşturulamadı." });
    }
});

/**
 * 🔍 ETKİNLİKLERİ LİSTELE (Yeni Eklendi)
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
        console.error("Etkinlik listeleme hatası:", err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * 🗑️ ETKİNLİK SİLME (Yeni Eklendi)
 */
router.delete('/events/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM events WHERE id = $1', [id]);
        res.json({ success: true, message: "Etkinlik silindi." });
    } catch (err) {
        console.error("Etkinlik silme hatası:", err.message);
        res.status(500).json({ error: "Silme işlemi başarısız." });
    }
});

/**
 * 📝 ETKİNLİK GÜNCELLEME (Yeni Eklendi)
 */
router.patch('/events/:id', async (req, res) => {
    const { id } = req.params;
    const { 
        eventName, eventDate, prepaymentAmount, description,
        imageUrl, doorTime, startTime, endTime, capacity 
    } = req.body;
    try {
        await pool.query(
            `UPDATE events SET 
                event_name = $1, event_date = $2, min_prepayment_amount = $3, 
                description = $4, image_url = $5, door_open_time = $6, 
                event_start_time = $7, event_end_time = $8, total_capacity = $9
             WHERE id = $10`,
            [eventName, eventDate, prepaymentAmount, description, imageUrl, doorTime, startTime, endTime, capacity, id]
        );
        res.json({ success: true, message: "Etkinlik güncellendi." });
    } catch (err) {
        console.error("Etkinlik güncelleme hatası:", err.message);
        res.status(500).json({ error: "Güncelleme başarısız." });
    }
});

module.exports = router;