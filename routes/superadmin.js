const express = require('express');
const router = express.Router();
const pool = require('../config/db'); //

router.post('/wizard-setup', async (req, res) => {
    const { tenantName, tenantPhone, tenantAddress, areas, features, adminUser, adminPass } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // Güvenli mod: Ya hepsi ya hiç!

        // 1. İşletme Kaydı (Yeni sütunlarla birlikte)
        const tQuery = `
            INSERT INTO tenants (name, is_prepayment_enabled) 
            VALUES ($1, $2) RETURNING id`;
        const tRes = await client.query(tQuery, [tenantName, features.prepayment]);
        const tenantId = tRes.rows[0].id;

        // 2. Dinamik Alan Kaydı
        for (let area of areas) {
            await client.query(
                'INSERT INTO areas (tenant_id, area_name, total_capacity) VALUES ($1, $2, $3)',
                [tenantId, area.name, area.capacity]
            );
        }

        // 3. Admin Kullanıcı Kaydı
        await client.query(
            'INSERT INTO users (tenant_id, username, password_hash, role) VALUES ($1, $2, $3, $4)',
            [tenantId, adminUser, adminPass, 'admin']
        );

        await client.query('COMMIT');
        res.status(201).json({ success: true, message: "İşletme DNA'sı başarıyla işlendi!" });

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
});

module.exports = router;