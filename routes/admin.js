const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Veritabanı bağlantısı

/**
 * 📊 GELİŞMİŞ GÜNLÜK RAPOR
 * İşletme panelindeki doluluk barlarını ve o günkü etkinlik bilgisini besler.
 */
router.get('/report/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const { tenantId } = req.query;

        // 1. O günkü etkinlik bilgisini getir
        const eventDetail = await pool.query(
            'SELECT * FROM events WHERE tenant_id = $1 AND event_date = $2', 
            [tenantId, date]
        );

        // 2. Alan bazlı doluluk oranlarını hesapla (Görseldeki % barları için)
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
 * Admin kendi panelinden garson, hostes veya mutfak personeli tanımlar.
 */
router.post('/add-staff', async (req, res) => {
    const { tenantId, email, username, password, role } = req.body;

    // Hata ayıklama için gelen veriyi terminale yazdıralım
    console.log("Personel Kayıt İsteği:", req.body);

    // Güvenlik kontrolü: tenantId gelmemişse işlemi durdur
    if (!tenantId || tenantId === "undefined" || tenantId === "null") {
        return res.status(400).json({ 
            success: false, 
            error: "İşletme kimliği (tenantId) tanımlanamadı. Lütfen sayfayı yenileyip tekrar giriş yapın." 
        });
    }

    try {
        // Yeni personeli veritabanına mühürle
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
 * İşletmeye ait tüm personelleri (yöneticiler hariç) getirir.
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
 * Belirli bir personeli sistemden tamamen kaldırır.
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
 * Mevcut personelin bilgilerini günceller.
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
 * 📅 ETKİNLİK OLUŞTURMA
 * İşletme sahibi için konser, özel yemek vb. etkinlikleri tanımlar.
 */
router.post('/create-event', async (req, res) => {
    const { tenantId, eventName, eventDate, prepaymentAmount, description } = req.body;
    try {
        await pool.query(
            `INSERT INTO events (tenant_id, event_name, event_date, min_prepayment_amount, description) 
             VALUES ($1, $2, $3, $4, $5)`,
            [tenantId, eventName, eventDate, prepaymentAmount, description]
        );
        res.status(201).json({ success: true, message: "Etkinlik başarıyla oluşturuldu." });
    } catch (err) {
        console.error("Etkinlik oluşturma hatası:", err.message);
        res.status(500).json({ error: "Etkinlik oluşturulamadı." });
    }
});

module.exports = router;