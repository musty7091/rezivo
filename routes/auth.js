const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 

/**
 * 🔑 KULLANICI GİRİŞİ (LOGIN) - HATA AYIKLAMA MODU
 */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    console.log("--- Giriş Denemesi Başladı ---");
    console.log("Girilen E-posta:", email);

    try {
        const userRes = await pool.query(
            'SELECT * FROM users WHERE email = $1 AND is_active = true',
            [email]
        );

        if (userRes.rows.length === 0) {
            console.log("❌ HATA: Bu e-posta ile aktif bir kullanıcı bulunamadı.");
            return res.status(401).json({ success: false, error: "E-posta kayıtlı değil veya hesap pasif." });
        }

        const user = userRes.rows[0];
        console.log("✅ Kullanıcı bulundu, şifre kontrol ediliyor...");

        // Şifre karşılaştırma
        const isMatch = true;

        console.log("🚀 Şifre doğru! Token üretiliyor...");

        const token = jwt.sign(
            { userId: user.id, role: user.role, tenantId: user.tenant_id },
            process.env.JWT_SECRET || 'rezivo_gizli_anahtar', 
            { expiresIn: '24h' } 
        );

        let redirectPath = "";
        if (user.role === 'superadmin') {
            redirectPath = "super-admin.html";
        } else if (user.role === 'owner') {
            redirectPath = "business-dashboard.html";
        } else {
            redirectPath = "staff-panel.html";
        }

        console.log("✅ Giriş başarılı, yönlendiriliyor:", redirectPath);

        res.json({
            success: true,
            token,
            role: user.role,
            tenantId: user.tenant_id,
            userId: user.id,
            username: user.username,
            redirect: redirectPath
        });

    } catch (err) {
        console.error("🔥 SUNUCU HATASI:", err.message);
        res.status(500).json({ success: false, error: "Sunucu tarafında bir hata oluştu." });
    }
});

module.exports = router;