-- Supabase Schema for E-Commerce Mobile Store

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles & Roles
CREATE TYPE user_role AS ENUM ('customer', 'staff', 'admin');

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    phone_number TEXT,
    avatar_url TEXT,
    role user_role DEFAULT 'customer'::user_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Categories
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    image_url TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Brands
CREATE TABLE brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    description TEXT,
    seo_title TEXT,
    seo_description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Products (Base table for New, Used, Accessories)
CREATE TYPE product_status AS ENUM ('draft', 'active', 'archived', 'sold');
CREATE TYPE product_type AS ENUM ('new_mobile', 'used_mobile', 'accessory', 'part');

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    barcode TEXT,
    type product_type NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
    brand_id UUID REFERENCES brands(id) ON DELETE RESTRICT,
    short_description TEXT,
    full_description TEXT,
    specifications JSONB DEFAULT '{}'::jsonb,
    main_image_url TEXT,
    cost_price DECIMAL(10, 2),
    mrp DECIMAL(10, 2) NOT NULL,
    selling_price DECIMAL(10, 2) NOT NULL,
    stock_quantity INTEGER DEFAULT 0 NOT NULL,
    low_stock_threshold INTEGER DEFAULT 5,
    tax_rate DECIMAL(5, 2) DEFAULT 18.00, -- e.g., 18% GST
    warranty_info TEXT,
    status product_status DEFAULT 'draft'::product_status NOT NULL,
    is_featured BOOLEAN DEFAULT false,
    is_best_seller BOOLEAN DEFAULT false,
    seo_title TEXT,
    seo_description TEXT,
    search_keywords TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Product Images Gallery
CREATE TABLE product_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    alt_text TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Product Variants (e.g. Storage, Color)
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL, -- e.g., "128GB - Black"
    price_difference DECIMAL(10, 2) DEFAULT 0,
    mrp DECIMAL(10, 2),
    selling_price DECIMAL(10, 2), -- Can override product price
    stock_quantity INTEGER DEFAULT 0 NOT NULL,
    attributes JSONB DEFAULT '{}'::jsonb, -- e.g., {"color": "Black", "storage": "128GB"}
    image_url TEXT,
    status BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Used Device Details
CREATE TYPE device_condition AS ENUM ('excellent', 'very_good', 'good', 'fair');

CREATE TABLE used_device_details (
    product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    condition device_condition NOT NULL,
    battery_health_percentage INTEGER,
    device_age_months INTEGER,
    purchase_year INTEGER,
    warranty_available BOOLEAN DEFAULT false,
    warranty_duration_months INTEGER DEFAULT 0,
    original_box_available BOOLEAN DEFAULT false,
    original_charger_available BOOLEAN DEFAULT false,
    invoice_available BOOLEAN DEFAULT false,
    scratches TEXT,
    dents TEXT,
    display_condition TEXT,
    camera_condition TEXT,
    speaker_condition TEXT,
    charging_condition TEXT,
    biometric_status TEXT, -- FaceID/Fingerprint
    repair_history TEXT,
    parts_replaced TEXT,
    overall_notes TEXT
);

-- 8. Used Device Quality Checklist (Admin)
CREATE TABLE used_device_inspections (
    product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    display_tested BOOLEAN DEFAULT false,
    touch_tested BOOLEAN DEFAULT false,
    camera_tested BOOLEAN DEFAULT false,
    speaker_tested BOOLEAN DEFAULT false,
    microphone_tested BOOLEAN DEFAULT false,
    wifi_tested BOOLEAN DEFAULT false,
    bluetooth_tested BOOLEAN DEFAULT false,
    charging_tested BOOLEAN DEFAULT false,
    battery_tested BOOLEAN DEFAULT false,
    fingerprint_tested BOOLEAN DEFAULT false,
    face_id_tested BOOLEAN DEFAULT false,
    sim_tested BOOLEAN DEFAULT false,
    buttons_tested BOOLEAN DEFAULT false,
    quality_checked_badge BOOLEAN GENERATED ALWAYS AS (
        display_tested AND touch_tested AND camera_tested AND speaker_tested AND 
        microphone_tested AND wifi_tested AND bluetooth_tested AND charging_tested AND 
        battery_tested AND (fingerprint_tested OR face_id_tested) AND sim_tested AND buttons_tested
    ) STORED,
    inspected_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    inspected_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Addresses
CREATE TYPE address_type AS ENUM ('home', 'work', 'other');

CREATE TABLE addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    mobile_number TEXT NOT NULL,
    address_line TEXT NOT NULL,
    landmark TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    pin_code TEXT NOT NULL,
    type address_type DEFAULT 'home'::address_type NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Orders & Order Items
CREATE TYPE order_status AS ENUM (
    'pending', 'confirmed', 'processing', 'ready_for_pickup', 
    'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'refunded'
);
CREATE TYPE payment_method AS ENUM ('cod', 'store_pickup', 'online');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number TEXT UNIQUE NOT NULL, -- e.g., ORD-2026-000001
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    address_snapshot JSONB NOT NULL, -- Snapshot of shipping address
    subtotal DECIMAL(10, 2) NOT NULL,
    discount DECIMAL(10, 2) DEFAULT 0,
    tax_total DECIMAL(10, 2) DEFAULT 0,
    shipping_charge DECIMAL(10, 2) DEFAULT 0,
    grand_total DECIMAL(10, 2) NOT NULL,
    payment_method payment_method NOT NULL,
    payment_status payment_status DEFAULT 'pending'::payment_status NOT NULL,
    status order_status DEFAULT 'pending'::order_status NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL, -- Snapshot
    variant_name TEXT, -- Snapshot
    sku TEXT NOT NULL, -- Snapshot
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL, -- Snapshot
    discount DECIMAL(10, 2) DEFAULT 0,
    tax_rate DECIMAL(5, 2) DEFAULT 0,
    total_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    status order_status NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Invoices
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number TEXT UNIQUE NOT NULL, -- e.g., INV-2026-000001
    order_id UUID UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    invoice_date TIMESTAMPTZ DEFAULT NOW(),
    store_snapshot JSONB NOT NULL, -- Store details at time of generation
    customer_snapshot JSONB NOT NULL,
    totals_snapshot JSONB NOT NULL,
    pdf_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Cart & Wishlist
CREATE TABLE carts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    session_id TEXT UNIQUE, -- For guest carts
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cart_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id UUID REFERENCES carts(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(cart_id, product_id, variant_id)
);

-- 13. Inventory Movements
CREATE TYPE movement_type AS ENUM ('purchase', 'sale', 'return', 'adjustment', 'cancelled_order_restore');

CREATE TABLE inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    quantity_change INTEGER NOT NULL, -- Can be negative
    type movement_type NOT NULL,
    reference_id UUID, -- order_id or adjustment_id
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to handle `updated_at` automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at (example on profiles and products, can be applied to others)
CREATE TRIGGER update_profiles_modtime
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_products_modtime
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
