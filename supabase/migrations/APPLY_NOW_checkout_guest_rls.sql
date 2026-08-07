-- Allow customers to create/read their own profile (needed for checkout FK → profiles)
-- Run in Supabase SQL Editor if storefront checkout hits profiles RLS errors.

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Guest + logged-in checkout: allow insert when order is yours OR guest (null user)
DROP POLICY IF EXISTS "Users can insert own orders" ON orders;
CREATE POLICY "Users can insert own orders" ON orders
  FOR INSERT
  WITH CHECK (
    user_id IS NULL
    OR auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Anyone can insert guest order items" ON order_items;
CREATE POLICY "Users can insert order items for own or guest orders" ON order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
        AND (o.user_id IS NULL OR o.user_id = auth.uid())
    )
  );

-- Keep existing "Users can insert own order items" if it conflicts — drop the old narrow one
DROP POLICY IF EXISTS "Users can insert own order items" ON order_items;
