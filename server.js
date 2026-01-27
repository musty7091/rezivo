const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const pool = require('./db'); // Az önce oluşturduğumuz db.js dosyasını buraya çağırıyoruz

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// Sunucunun çalışıp çalışmadığını anlamak için ana sayfa testi
app.get('/', (req, res) => {
    res.send('RES-SAAS Sunucusu ve Bulut Veritabanı Hazır!');
});

// SÜPER ADMIN: İlk restoranı ve alanlarını kaydetmek için kullanacağın özel kod
app.post('/api/admin/setup-business', async (req, res) => {
    const { businessName, areas } = req.body; 

    try {
        // İşletmeyi (Tenant) kaydediyoruz
        const tenantResult = await pool.query(
            'INSERT INTO tenants (name) VALUES ($1) RETURNING id',
            [businessName]
        );
        const tenantId = tenantResult.rows[0].id;

        // Belirlediğin alanları (Bahçe, VIP vb.) tek tek ekliyoruz
        for (let areaName of areas) {
            await pool.query(
                'INSERT INTO areas (tenant_id, area_name, total_capacity) VALUES ($1, $2, $3)',
                [tenantId, areaName, 50]
            );
        }

        res.status(201).json({
            message: "İşletme ve Alanlar Başarıyla Kuruldu!",
            id: tenantId
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Kurulum hatası: " + err.message });
    }
});

app.post('/api/reservations/create', async (req, res) => {
    const { tenantId, customerName, phone, areaId, guestCount, date, time } = req.body;

    try {
        // 1. KAPASİTE KONTROLÜ: Seçilen alanın kapasitesini öğren
        const areaInfo = await pool.query('SELECT total_capacity, area_name FROM areas WHERE id = $1', [areaId]);
        const capacity = areaInfo.rows[0].total_capacity;

        // 2. DOLULUK HESABI: O gün o alanda toplam kaç kişi var?
        const currentOccupancy = await pool.query(
            'SELECT SUM(guest_count) as filled FROM reservations WHERE area_id = $1 AND reservation_date = $2',
            [areaId, date]
        );
        const filled = parseInt(currentOccupancy.rows[0].filled || 0);

        // 3. KARAR: Yer var mı?
        if (filled + parseInt(guestCount) > capacity) {
            return res.status(400).json({ 
                error: `Üzgünüz, ${areaInfo.rows[0].area_name} alanı dolmuştur.`,
                mevcutBosYer: capacity - filled
            });
        }

        // --- Yer varsa işlemler devam eder (Aşağısı eski kodun aynısı) ---
        const eventCheck = await pool.query(
            'SELECT * FROM events WHERE tenant_id = $1 AND event_date = $2',
            [tenantId, date]
        );

        let eventId = null;
        let requiredPrepayment = 0;
        if (eventCheck.rows.length > 0) {
            eventId = eventCheck.rows[0].id;
            requiredPrepayment = eventCheck.rows[0].min_prepayment_amount * guestCount;
        }

        let customer = await pool.query('SELECT id FROM customers WHERE phone = $1', [phone]);
        let customerId = customer.rows.length === 0 
            ? (await pool.query('INSERT INTO customers (tenant_id, full_name, phone) VALUES ($1, $2, $3) RETURNING id', [tenantId, customerName, phone])).rows[0].id
            : customer.rows[0].id;

        const newRes = await pool.query(
            `INSERT INTO reservations 
            (tenant_id, customer_id, area_id, event_id, guest_count, reservation_date, reservation_time, status) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [tenantId, customerId, areaId, eventId, guestCount, date, time, 'pending_payment']
        );

        res.status(201).json({
            message: "Kapasite uygun, rezervasyon alındı!",
            totalPrepayment: requiredPrepayment,
            reservationId: newRes.rows[0].id
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Kapasite kontrolü sırasında bir hata oluştu." });
    }
});

app.post('/api/admin/create-event', async (req, res) => {
    // Gelen verileri alıyoruz
    const { tenantId, eventName, date, hasMeal, mealPrice, prepayment } = req.body;

    try {
        const newEvent = await pool.query(
            `INSERT INTO events 
            (tenant_id, event_name, event_date, has_meal_service, meal_price, min_prepayment_amount) 
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [tenantId, eventName, date, hasMeal, mealPrice, prepayment]
        );

        res.status(201).json({
            message: "Özel Etkinlik Başarıyla Tanımlandı!",
            eventId: newEvent.rows[0].id
        });
    } catch (err) {
        // BURASI ÇOK ÖNEMLİ: Hatanın gerçek sebebini terminale yazdırıyoruz
        console.error("🔴 VERİTABANI HATASI:", err.message); 
        res.status(500).json({ error: "Etkinlik oluşturulamadı: " + err.message });
    }
});

// RAPORLAMA: Belirli bir tarihteki mutfak ve finansal durumu özetler
app.get('/api/admin/report/:date', async (req, res) => {
    const { date } = req.params;
    const { tenantId } = req.query; // Hangi işletme için rapor isteniyor?

    try {
        // 1. Toplam misafir ve rezervasyon sayısını çek
        const stats = await pool.query(
            `SELECT 
                COUNT(*) as total_reservations,
                SUM(guest_count) as total_guests
             FROM reservations 
             WHERE tenant_id = $1 AND reservation_date = $2`,
            [tenantId, date]
        );

        // 2. Eğer o gün etkinlik varsa mutfak detayını çek
        const eventDetail = await pool.query(
            'SELECT event_name, has_meal_service, meal_price FROM events WHERE tenant_id = $1 AND event_date = $2',
            [tenantId, date]
        );

        const summary = stats.rows[0];
        const event = eventDetail.rows[0] || null;

        res.json({
            tarih: date,
            ozet: {
                toplamRezervasyon: summary.total_reservations,
                toplamMisafir: summary.total_guests || 0
            },
            etkinlikBilgisi: event,
            mutfakNotu: event && event.has_meal_service 
                ? `${summary.total_guests || 0} kişilik yemek hazırlığı yapılmalı.`
                : "Standart servis, özel hazırlık gerekmiyor."
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Rapor alınamadı." });
    }
});

// REZERVASYON LİSTESİ: Kapıdaki görevli için isim ve telefon listesi
app.get('/api/admin/reservations/:date', async (req, res) => {
    const { date } = req.params;
    const { tenantId } = req.query;

    try {
        const list = await pool.query(
            `SELECT 
                r.id, 
                c.full_name, 
                c.phone, 
                a.area_name, 
                r.guest_count, 
                r.reservation_time, 
                r.status 
             FROM reservations r
             JOIN customers c ON r.customer_id = c.id
             JOIN areas a ON r.area_id = a.id
             WHERE r.tenant_id = $1 AND r.reservation_date = $2
             ORDER BY r.reservation_time ASC`,
            [tenantId, date]
        );

        res.json({
            tarih: date,
            kayitlar: list.rows
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Liste alınamadı." });
    }
});

// ÖDEME ONAYI: Rezervasyon durumunu günceller
app.patch('/api/reservations/update-status/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // Örn: 'confirmed'

    try {
        const updatedRes = await pool.query(
            'UPDATE reservations SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );

        if (updatedRes.rows.length === 0) {
            return res.status(404).json({ error: "Rezervasyon bulunamadı." });
        }

        res.json({
            message: "Rezervasyon durumu başarıyla güncellendi!",
            kayit: updatedRes.rows[0]
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Durum güncellenirken bir hata oluştu." });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 PARA MAKİNESİ ÇALIŞIYOR: http://localhost:${PORT}`);
});