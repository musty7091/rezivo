-- 1. İŞLETMELER
CREATE TABLE tenants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    is_prepayment_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. ALANLAR
CREATE TABLE areas (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    area_name VARCHAR(100) NOT NULL,
    total_capacity INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true
);

-- 3. MÜŞTERİLER
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

-- 4. ETKİNLİKLER (Gelişmiş)
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    event_name VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL,
    start_time TIME,
    has_meal_service BOOLEAN DEFAULT false,
    meal_price DECIMAL(10,2) DEFAULT 0,
    is_prepayment_required BOOLEAN DEFAULT true,
    min_prepayment_amount DECIMAL(10,2) DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. REZERVASYONLAR
CREATE TABLE reservations (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id),
    customer_id INTEGER REFERENCES customers(id),
    area_id INTEGER REFERENCES areas(id),
    event_id INTEGER REFERENCES events(id),
    guest_count INTEGER NOT NULL,
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    paid_amount DECIMAL(10,2) DEFAULT 0,
    payment_status VARCHAR(50) DEFAULT 'pending',
    status VARCHAR(50) DEFAULT 'confirmed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);