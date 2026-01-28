const express = require('express');
const router = express.Router();
const pool = require('../config/db');

/**
 * REZIVO PRO - NİHAİ KURULUM ROTASI
 * 8 Adımdan gelen tüm verileri tek bir TRANSACTION ile kaydeder.
 */
router.post('/wizard-setup', async (req, res) => {
    const { 
        tenantName, tenantPhone, tenantAddress, 
        areas, 
        features, 
        adminUser, adminPass 
    } = req.body;

    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // Güvenli kayıt modunu aç

        // 1. İşletme Kaydı (Tenants tablosuna 8 adımın verilerini işler)
        const tQuery = `
            INSERT INTO tenants (
                name, phone, address, 
                is_prepayment_enabled, is_ticketing_enabled, 
                is_reminder_enabled, is_crm_enabled, 
                is_rating_enabled, is_analytics_enabled
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
        `;
        const tValues = [
            tenantName, tenantPhone, tenantAddress, 
            features.prepayment, features.ticketing, 
            features.reminder, features.crm, 
            features.rating, features.analytics
        ];
        const tRes = await client.query(tQuery, tValues);
        const tenantId = tRes.rows[0].id;

        // 2. Alanlar (Areas) Kaydı
        if (areas && areas.length > 0) {
            const aQuery = `INSERT INTO areas (tenant_id, area_name, total_capacity) VALUES ($1, $2, $3)`;
            for (let area of areas) {
                await client.query(aQuery, [tenantId, area.name, area.capacity]);
            }
        }

        // 3. Admin Kullanıcı Kaydı (Users tablosuna)
        const uQuery = `
            INSERT INTO users (tenant_id, username, password_hash, role) 
            VALUES ($1, $2, $3, 'admin')
        `;
        await client.query(uQuery, [tenantId, adminUser, adminPass]);

        await client.query('COMMIT'); // Her şey tamamsa kalıcı olarak kaydet
        res.status(201).json({ success: true, message: "İşletme tüm modülleriyle kuruldu!" });

    } catch (err) {
        await client.query('ROLLBACK'); // Hata olursa hiçbir şey yapma, başa dön
        console.error("KURULUM HATASI:", err.message);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
});

module.exports = router;