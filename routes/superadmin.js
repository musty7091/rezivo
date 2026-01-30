const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcryptjs'); // Şifreleme için eklendi

/**
 * 🚀 REZIVO PRO - MASTER KURULUM SİHİRBAZI
 * 8 adımdan gelen verileri alır; İşletmeyi, Alanları ve Dükkan Sahibini (Owner) tek bir işlemle kurar.
 */
router.post('/wizard-setup', async (req, res) => {
    // Frontend'den gelen tüm yapılandırılmış veriler
    const { 
        tenantName, 
        tenantPhone, 
        tenantAddress, 
        areas, 
        features, 
        adminEmail, 
        adminPass 
    } = req.body;

    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // İşlemi başlat

        // 1. İşletme Kaydı (Tenants Tablosu)
        // Senin belirlediğin modüler özellikler (CRM, Analiz vb.) burada DNA olarak kaydedilir.
        const tQuery = `
            INSERT INTO tenants (
                name, phone, address, 
                is_prepayment_enabled, is_ticketing_enabled, 
                is_reminder_enabled, is_crm_enabled, 
                is_rating_enabled, is_analytics_enabled
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
        `;
        const tValues = [
            tenantName, 
            tenantPhone, 
            tenantAddress, 
            features.prepayment, 
            features.ticketing, 
            features.reminder, 
            features.crm, 
            features.rating, 
            features.analytics
        ];
        const tRes = await client.query(tQuery, tValues);
        const tenantId = tRes.rows[0].id;

        // 2. İşletme Alanlarının Tanımlanması (Areas Tablosu)
        // Kaç adet alan (Teras, VIP vb.) gönderildiyse döngüyle kaydedilir.
        if (areas && areas.length > 0) {
            const aQuery = `INSERT INTO areas (tenant_id, area_name, total_capacity) VALUES ($1, $2, $3)`;
            for (let area of areas) {
                // Frontend 'name' verisini, veritabanı 'area_name' sütununa yazar.
                await client.query(aQuery, [tenantId, area.name, area.capacity]);
            }
        }

        // 3. İşletme Sahibi (Owner) Hesabı (Users Tablosu)
        // Mail odaklı giriş sistemi için benzersiz kayıt oluşturulur.
        const generatedUsername = adminEmail.split('@')[0];

        // GÜNCELLEME: Şifre veritabanına kaydedilmeden önce şifreleniyor
        const salt = await bcrypt.genSalt(10);
        const hashedPass = await bcrypt.hash(adminPass, salt);

        const uQuery = `
            INSERT INTO users (tenant_id, email, username, password_hash, role, is_active) 
            VALUES ($1, $2, $3, $4, 'owner', true)
        `;
        await client.query(uQuery, [tenantId, adminEmail, generatedUsername, hashedPass]);

        await client.query('COMMIT'); // Tüm adımlar hatasızsa veritabanına kalıcı olarak işle
        
        res.status(201).json({ 
            success: true, 
            message: "Rezivo Master: İşletme kurulumu ve yönetici hesabı başarıyla tamamlandı." 
        });

    } catch (err) {
        await client.query('ROLLBACK'); // En ufak hatada işlemi geri al
        console.error("SİHİRBAZ KAYIT HATASI:", err.message);
        res.status(500).json({ success: false, error: "Kurulum hatası: " + err.message });
    } finally {
        client.release(); // Bağlantıyı havuza geri bırak
    }
});

/**
 * 👁️ SÜPER İZLEME PANELİ (Superadmin Dashboard)
 * Sistemdeki tüm işletmeleri, aktivite sayılarıyla birlikte listeler.
 */
router.get('/tenants', async (req, res) => {
    try {
        // total_events_created ve total_reservations_taken sayesinde etkinlikleri takip edebilirsin.
        const result = await pool.query('SELECT * FROM tenants ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        console.error("LİSTELEME HATASI:", err.message);
        res.status(500).json({ error: "İşletme listesi alınamadı." });
    }
});

/**
 * 🛠️ SÜPERADMİN MÜDAHALE YETKİSİ
 * Bir işletmenin ayarlarını senin panelinden güncellemesini sağlar.
 */
router.patch('/tenant-settings/:id', async (req, res) => {
    const { id } = req.params;
    const { is_prepayment_enabled, is_crm_enabled, is_analytics_enabled } = req.body;
    
    try {
        await pool.query(
            `UPDATE tenants 
             SET is_prepayment_enabled = $1, is_crm_enabled = $2, is_analytics_enabled = $3 
             WHERE id = $4`,
            [is_prepayment_enabled, is_crm_enabled, is_analytics_enabled, id]
        );
        res.json({ success: true, message: "İşletme yetkileri güncellendi." });
    } catch (err) {
        res.status(500).json({ error: "Güncelleme başarısız." });
    }
});

/**
 * 📜 AKTİVİTE LOGLARI (Audit Logs)
 * Sistemde kim ne yapmış, tek bir listede SüperAdmin'e sunar.
 */
router.get('/system-logs', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT l.*, u.email as user_email, t.name as tenant_name 
             FROM activity_logs l
             JOIN users u ON l.user_id = u.id
             JOIN tenants t ON l.tenant_id = t.id
             ORDER BY l.created_at DESC LIMIT 100`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Loglar çekilemedi." });
    }
});

module.exports = router;