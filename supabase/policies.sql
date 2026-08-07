-- Supabase Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE used_device_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE used_device_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- 1. Profiles
-- Users can read and update their own profile. Admins can read all.
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Staff can manage profiles" ON profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.role IN ('admin', 'staff')
        )
    );

-- 2. Public Catalog Data (Categories, Brands, Products, Variants)
-- Public can only select active data. Admins have full access.
CREATE POLICY "Public can view active categories" ON categories
    FOR SELECT USING (active = true);
CREATE POLICY "Admin can manage categories" ON categories
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'staff')));

CREATE POLICY "Public can view active brands" ON brands
    FOR SELECT USING (active = true);
CREATE POLICY "Admin can manage brands" ON brands
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'staff')));

CREATE POLICY "Public can view active products" ON products
    FOR SELECT USING (status = 'active');
CREATE POLICY "Admin can manage products" ON products
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'staff')));

CREATE POLICY "Public can view product images" ON product_images
    FOR SELECT USING (true);
CREATE POLICY "Admin can manage product images" ON product_images
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'staff')));

CREATE POLICY "Public can view active variants" ON product_variants
    FOR SELECT USING (status = true);
CREATE POLICY "Admin can manage variants" ON product_variants
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'staff')));

CREATE POLICY "Public can view used device details" ON used_device_details
    FOR SELECT USING (true);
CREATE POLICY "Admin can manage used device details" ON used_device_details
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'staff')));

-- 3. Addresses
-- Users manage their own addresses.
CREATE POLICY "Users can view own addresses" ON addresses
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own addresses" ON addresses
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own addresses" ON addresses
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own addresses" ON addresses
    FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admin can view all addresses" ON addresses
    FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 4. Orders & Invoices
-- Users can read their own orders and invoices. Admins have full access.
CREATE POLICY "Users can view own orders" ON orders
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own orders" ON orders
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin can manage orders" ON orders
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'staff')));

CREATE POLICY "Users can view own order items" ON order_items
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
    );
CREATE POLICY "Users can insert own order items" ON order_items
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
    );
CREATE POLICY "Admin can manage order items" ON order_items
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'staff')));

CREATE POLICY "Users can view own order history" ON order_status_history
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM orders WHERE orders.id = order_status_history.order_id AND orders.user_id = auth.uid())
    );
CREATE POLICY "Admin can manage order history" ON order_status_history
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'staff')));

CREATE POLICY "Users can view own invoices" ON invoices
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM orders WHERE orders.id = invoices.order_id AND orders.user_id = auth.uid())
    );
CREATE POLICY "Admin can manage invoices" ON invoices
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'staff')));

-- 5. Carts
-- Carts can be tied to user_id or session_id
CREATE POLICY "Users can view own cart" ON carts
    FOR SELECT USING (auth.uid() = user_id OR session_id IS NOT NULL);
CREATE POLICY "Users can insert own cart" ON carts
    FOR INSERT WITH CHECK (auth.uid() = user_id OR session_id IS NOT NULL);
CREATE POLICY "Users can update own cart" ON carts
    FOR UPDATE USING (auth.uid() = user_id OR session_id IS NOT NULL);
CREATE POLICY "Users can delete own cart" ON carts
    FOR DELETE USING (auth.uid() = user_id OR session_id IS NOT NULL);

CREATE POLICY "Users can view own cart items" ON cart_items
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM carts WHERE carts.id = cart_items.cart_id AND (carts.user_id = auth.uid() OR carts.session_id IS NOT NULL))
    );
CREATE POLICY "Users can insert own cart items" ON cart_items
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM carts WHERE carts.id = cart_items.cart_id AND (carts.user_id = auth.uid() OR carts.session_id IS NOT NULL))
    );
CREATE POLICY "Users can update own cart items" ON cart_items
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM carts WHERE carts.id = cart_items.cart_id AND (carts.user_id = auth.uid() OR carts.session_id IS NOT NULL))
    );
CREATE POLICY "Users can delete own cart items" ON cart_items
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM carts WHERE carts.id = cart_items.cart_id AND (carts.user_id = auth.uid() OR carts.session_id IS NOT NULL))
    );

-- 6. Inventory & Admin-only tables
CREATE POLICY "Admin can view inventory movements" ON inventory_movements
    FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'staff')));
CREATE POLICY "Admin can insert inventory movements" ON inventory_movements
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'staff')));
