const express = require('express');
const router = express.Router();
const pool = require('../config/db');

/**
 * 🔑 KULLANICI GİRİŞİ (LOGIN)
 * Mail adresi üzerinden kullanıcıyı tanır ve rolüne göre yönlendirir.
 */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1. Kullanıcıyı e-posta ile ara ve aktiflik durumunu kontrol et
        const userRes = await pool.query(
            'SELECT * FROM users WHERE email = $1 AND is_active = true',
            [email]
        );

        // 2. Kullanıcı var mı?
        if (userRes.rows.length === 0) {
            return res.status(401).json({ success: false, error: "E-posta kayıtlı değil veya hesap pasif hale getirilmiş." });
        }

        const user = userRes.rows[0];

        // 3. Şifre kontrolü (Şimdilik düz metin, bcrypt entegrasyonuna hazırdır)
        if (user.password_hash !== password) {
            return res.status(401).json({ success: false, error: "Hatalı şifre girdiniz." });
        }

        // 4. ROL BAZLI YÖNLENDİRME MANTIĞI
        let redirectPath = "";
        if (user.role === 'superadmin') {
            redirectPath = "super-admin.html";
        } else if (user.role === 'owner') {
            redirectPath = "business-dashboard.html";
        } else {
            // staff_hostess, staff_waiter, staff_kitchen rolleri ortak personel paneline gider
            redirectPath = "staff-panel.html";
        }

        // Başarılı yanıt ve kritik oturum verileri
        res.json({
            success: true,
            role: user.role,
            tenantId: user.tenant_id,
            userId: user.id,
            username: user.username,
            redirect: redirectPath
        });

    } catch (err) {
        console.error("Auth Hatası:", err.message);
        res.status(500).json({ success: false, error: "Sunucu tarafında bir hata oluştu." });
    }
});

module.exports = router;