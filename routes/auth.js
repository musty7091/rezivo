const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Veritabanı bağlantın

// GİRİŞ YAPMA (LOGIN) ROTASI
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1. Veritabanında kullanıcıyı e-postasıyla ara
        const userRes = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        // 2. Kullanıcı var mı?
        if (userRes.rows.length === 0) {
            return res.status(401).json({ success: false, error: "E-posta kayıtlı değil." });
        }

        const user = userRes.rows[0];

        // 3. Şifre doğru mu? (Şimdilik basit eşleşme, ileride hash kullanacağız)
        if (user.password_hash !== password) {
            return res.status(401).json({ success: false, error: "Hatalı şifre." });
        }

        // 4. ROLÜNE GÖRE YÖNLENDİRME
        let redirectPath = "";
        if (user.role === 'superadmin') {
            redirectPath = "super-admin.html";
        } else if (user.role === 'admin') {
            redirectPath = "business_dashboard.html";
        } else {
            redirectPath = "staff_panel.html";
        }

        // Başarılı yanıt gönder
        res.json({
            success: true,
            role: user.role,
            tenantId: user.tenant_id,
            redirect: redirectPath
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Sunucu hatası oluştu." });
    }
});

module.exports = router;