-- ════════════════════════════════════════════════════════════════════════
-- Phase 1: Invoice payment tracking + account balance support
-- ════════════════════════════════════════════════════════════════════════
-- Adds amount_paid to invoices so the system can track partial payments and
-- derive amount payable (Total − Paid) on read. Amount payable is NEVER
-- stored — it is always computed from amount and amount_paid.
--
-- Decisions locked with product owner:
--   • No multi-currency (single currency, currency column retained but unused)
--   • amount_paid is a numeric (supports partial payments per requirement
--     table: Total 1000 / Paid 100 / Payable 900)
--   • amount_payable = amount − amount_paid  → DERIVED, never stored
-- ════════════════════════════════════════════════════════════════════════

-- 1. Add amount_paid column (defaults to 0 — nothing paid yet)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0
    CHECK (amount_paid >= 0);

-- 2. Guard: amount_paid must never exceed the invoice amount.
--    (Only enforced when amount is set; draft invoices may have null amount.)
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS chk_amount_paid_not_over;
ALTER TABLE public.invoices
  ADD CONSTRAINT chk_amount_paid_not_over
    CHECK (amount IS NULL OR amount_paid <= amount);

-- 3. Convenience view exposing the DERIVED amount_payable so the UI and
--    dashboard never compute (or accidentally store) it inconsistently.
--    payment_state is a derived label, not a stored flag.
CREATE OR REPLACE VIEW public.invoice_balances AS
SELECT
  i.id,
  i.job_id,
  i.invoice_number,
  i.invoice_status,
  i.amount,
  i.amount_paid,
  -- DERIVED: never stored
  COALESCE(i.amount, 0) - COALESCE(i.amount_paid, 0) AS amount_payable,
  CASE
    WHEN i.amount IS NULL OR i.amount = 0           THEN 'unbilled'
    WHEN COALESCE(i.amount_paid,0) = 0              THEN 'unpaid'
    WHEN i.amount_paid >= i.amount                  THEN 'paid'
    ELSE 'partial'
  END AS payment_state,
  i.invoice_date,
  i.created_at,
  i.updated_at
FROM public.invoices i;

-- 4. Keep invoice_status in sync with payment when fully paid (optional helper).
--    When amount_paid reaches amount, flip status to 'paid' automatically.
CREATE OR REPLACE FUNCTION public.sync_invoice_paid_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.amount IS NOT NULL AND NEW.amount > 0
     AND NEW.amount_paid >= NEW.amount THEN
    NEW.invoice_status := 'paid';
  ELSIF NEW.invoice_status = 'paid'
        AND (NEW.amount IS NULL OR NEW.amount_paid < NEW.amount) THEN
    -- payment reduced below total → no longer fully paid
    NEW.invoice_status := 'sent';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_invoice_paid_status ON public.invoices;
CREATE TRIGGER trg_sync_invoice_paid_status
  BEFORE INSERT OR UPDATE OF amount, amount_paid ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_paid_status();

-- 5. Let helpees read the balances view for their own jobs.
--    Views inherit RLS from base tables, but we expose it explicitly via grant.
GRANT SELECT ON public.invoice_balances TO anon, authenticated;
