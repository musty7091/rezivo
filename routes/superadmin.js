const express = require('express');
const router = express.Router();
const pool = require('../config/db');

/**
 * REZIVO PRO - NİHAİ KURULUM ROTASI
 * 8 Adımdan gelen tüm verileri tek bir TRANSACTION ile kaydeder.
 * Tireli dosya isimleri ve Mail tabanlı giriş sistemine tam uyumludur.
 */
router.post('/wizard-setup', async (req, res) => {
    // Frontend'den gelen tüm verileri eksiksiz karşılıyoruz
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
        await client.query('BEGIN'); // Güvenli kayıt modunu (Transaction) başlat

        // 1. İşletme Kaydı (Tenants tablosu)
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

        // 2. Alanlar (Areas) Kaydı
        if (areas && areas.length > 0) {
            const aQuery = `INSERT INTO areas (tenant_id, area_name, total_capacity) VALUES ($1, $2, $3)`;
            for (let area of areas) {
                // frontend 'name' gönderiyor, veritabanı 'area_name' bekliyor
                await client.query(aQuery, [tenantId, area.name, area.capacity]);
            }
        }

        // 3. İşletme Sahibi Kaydı (E-posta odaklı)
        // Kullanıcı adını mailin @ işaretinden önceki kısmından otomatik türetelim
        const generatedUsername = adminEmail.split('@')[0];

        const uQuery = `
            INSERT INTO users (tenant_id, email, username, password_hash, role) 
            VALUES ($1, $2, $3, $4, 'admin')
        `;
        await client.query(uQuery, [tenantId, adminEmail, generatedUsername, adminPass]);

        await client.query('COMMIT'); // Tüm adımlar hatasızsa veritabanına kalıcı olarak işle
        
        res.status(201).json({ 
            success: true, 
            message: "İşletme ve Admin hesabı başarıyla oluşturuldu." 
        });

    } catch (err) {
        await client.query('ROLLBACK'); // En ufak hatada yapılan tüm işlemleri geri al (çöp veri oluşmasın)
        console.error("SİHİRBAZ KAYIT HATASI:", err.message);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release(); // Veritabanı bağlantısını havuza geri bırak
    }
});

/**
 * SÜPER ADMİN PANELİ LİSTELEME ROTASI
 * Kaydedilen tüm işletmeleri super-admin.html sayfasındaki tabloda gösterir.
 */
router.get('/tenants', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tenants ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        console.error("LİSTELEME HATASI:", err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;