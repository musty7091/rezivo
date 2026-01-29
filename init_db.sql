-- 1. ESKİ TABLOLARI SİL (Sıfırdan Temiz Kurulum İçin)
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS reservations CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS areas CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

-- 2. İŞLETMELER (TENANTS)
CREATE TABLE tenants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    is_prepayment_enabled BOOLEAN DEFAULT true,
    is_ticketing_enabled BOOLEAN DEFAULT false,
    is_reminder_enabled BOOLEAN DEFAULT false,
    is_crm_enabled BOOLEAN DEFAULT false,
    is_rating_enabled BOOLEAN DEFAULT false,
    is_analytics_enabled BOOLEAN DEFAULT false,
    total_events_created INTEGER DEFAULT 0,
    total_reservations_taken INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. KULLANICILAR (USERS)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100),
    password_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL, 
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. ALANLAR (AREAS)
CREATE TABLE areas (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    area_name VARCHAR(100) NOT NULL,
    total_capacity INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true
);

-- 5. MÜŞTERİLER (CUSTOMERS)
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE,
    total_bookings INTEGER DEFAULT 0,
    total_person_count INTEGER DEFAULT 0,
    reliability_score INTEGER DEFAULT 100,
    is_blacklisted BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. ETKİNLİKLER (EVENTS)
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    event_name VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL,
    door_open_time TIME,
    event_start_time TIME,
    event_end_time TIME,
    image_url TEXT,
    total_capacity INTEGER,
    has_meal_service BOOLEAN DEFAULT false,
    meal_price DECIMAL(10,2) DEFAULT 0,
    is_prepayment_required BOOLEAN DEFAULT true,
    min_prepayment_amount DECIMAL(10,2) DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. REZERVASYONLAR (RESERVATIONS)
CREATE TABLE reservations (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id),
    customer_id INTEGER REFERENCES customers(id),
    area_id INTEGER REFERENCES areas(id),
    event_id INTEGER REFERENCES events(id),
    guest_count INTEGER NOT NULL,
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    is_meal_included BOOLEAN DEFAULT false,
    special_notes TEXT,
    table_info VARCHAR(100),
    paid_amount DECIMAL(10,2) DEFAULT 0,
    payment_status VARCHAR(50) DEFAULT 'pending',
    status VARCHAR(50) DEFAULT 'confirmed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. AKTİVİTE LOGLARI (ACTIVITY_LOGS)
CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. VARSAYILAN SÜPERADMİN KULLANICISI
-- Email: sa@rez.com | Şifre: 123
-- Şifre "123"ün bcrypt karşılığı aşağıya eklenmiştir.
INSERT INTO users (email, username, password_hash, role, is_active) 
VALUES ('sa@rez.com', 'superadmin', '$2a$10$kXW6O7N8uW7y/A5XGq5B.uV2.n9v6Y7k8m/9v0R8', 'superadmin', true);