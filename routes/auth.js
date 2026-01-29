// --- ÖNCE (Mevcut Satırlar) ---
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// --- SONRA (Yeni Eklenen ve Güncellenen Satırlar) ---
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcryptjs'); // Şifreleme kütüphanesi
const jwt = require('jsonwebtoken'); // Token oluşturma kütüphanesi

/**
 * 🔑 KULLANICI GİRİŞİ (LOGIN)
 */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const userRes = await pool.query(
            'SELECT * FROM users WHERE email = $1 AND is_active = true',
            [email]
        );

        if (userRes.rows.length === 0) {
            return res.status(401).json({ success: false, error: "E-posta kayıtlı değil veya hesap pasif hale getirilmiş." });
        }

        const user = userRes.rows[0];

        // GÜNCELLEME: Şifre artık güvenli karşılaştırılıyor
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: "Hatalı şifre girdiniz." });
        }

        // YENİ: Kullanıcıya özel dijital anahtar (Token) üretimi
        const token = jwt.sign(
            { userId: user.id, role: user.role, tenantId: user.tenant_id },
            process.env.JWT_SECRET || 'rezivo_gizli_anahtar', // .env dosyasından okunur
            { expiresIn: '24h' } // Anahtar 24 saat geçerli kalır
        );

        let redirectPath = "";
        if (user.role === 'superadmin') {
            redirectPath = "super-admin.html";
        } else if (user.role === 'owner') {
            redirectPath = "business-dashboard.html";
        } else {
            redirectPath = "staff-panel.html";
        }

        res.json({
            success: true,
            token, // Üretilen anahtar istemciye gönderilir
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