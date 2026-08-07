-- Indian GST / Non-GST Invoicing enhancements
-- Run this in Supabase SQL editor before using /admin/invoices

-- Store / business profile (single-row config)
CREATE TABLE IF NOT EXISTS store_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    legal_name TEXT NOT NULL DEFAULT 'MobiStore',
    trade_name TEXT DEFAULT 'MobiStore',
    address_line1 TEXT NOT NULL DEFAULT '123 Tech Avenue, Block B',
    address_line2 TEXT DEFAULT 'Cyber City',
    city TEXT NOT NULL DEFAULT 'Mumbai',
    state TEXT NOT NULL DEFAULT 'Maharashtra',
    state_code TEXT NOT NULL DEFAULT '27',
    pin_code TEXT NOT NULL DEFAULT '400001',
    phone TEXT DEFAULT '+91 98765 43210',
    email TEXT DEFAULT 'support@mobistore.in',
    website TEXT DEFAULT 'https://mobistore.in',
    gstin TEXT,
    pan TEXT,
    gst_registered BOOLEAN DEFAULT false,
    composition_scheme BOOLEAN DEFAULT false,
    tax_inclusive_pricing BOOLEAN DEFAULT true,
    default_hsn TEXT DEFAULT '8517',
    default_gst_rate DECIMAL(5, 2) DEFAULT 18.00,
    invoice_prefix_gst TEXT DEFAULT 'GST',
    invoice_prefix_nongst TEXT DEFAULT 'BILL',
    bank_name TEXT,
    bank_account TEXT,
    bank_ifsc TEXT,
    bank_branch TEXT,
    terms TEXT DEFAULT 'Goods once sold will not be taken back. Subject to local jurisdiction.',
    authorized_signatory TEXT DEFAULT 'Authorized Signatory',
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed one settings row if empty
INSERT INTO store_settings (legal_name)
SELECT 'MobiStore'
WHERE NOT EXISTS (SELECT 1 FROM store_settings);

-- Invoice number sequences per FY + kind
CREATE TABLE IF NOT EXISTS invoice_sequences (
    financial_year TEXT NOT NULL,
    invoice_kind TEXT NOT NULL CHECK (invoice_kind IN ('gst', 'nongst')),
    last_number INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (financial_year, invoice_kind)
);

-- Enhance invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type TEXT DEFAULT 'tax_invoice';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_gst BOOLEAN DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS financial_year TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS place_of_supply_state TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS place_of_supply_code TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS supply_type TEXT; -- intra | inter | na
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reverse_charge BOOLEAN DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS buyer_gstin TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS items_snapshot JSONB DEFAULT '[]'::jsonb;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'issued';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Allow regenerating cancelled invoices for same order (partial unique on active only)
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_order_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_one_active_per_order
    ON invoices (order_id)
    WHERE status IS DISTINCT FROM 'cancelled';

ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin manage store settings" ON store_settings;
CREATE POLICY "Admin manage store settings" ON store_settings
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'staff'))
    );

DROP POLICY IF EXISTS "Admin manage invoice sequences" ON invoice_sequences;
CREATE POLICY "Admin manage invoice sequences" ON invoice_sequences
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'staff'))
    );

-- Atomic next invoice number
CREATE OR REPLACE FUNCTION next_invoice_number(p_fy TEXT, p_kind TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    next_num INTEGER;
BEGIN
    INSERT INTO invoice_sequences (financial_year, invoice_kind, last_number)
    VALUES (p_fy, p_kind, 1)
    ON CONFLICT (financial_year, invoice_kind)
    DO UPDATE SET last_number = invoice_sequences.last_number + 1
    RETURNING last_number INTO next_num;
    RETURN next_num;
END;
$$;
