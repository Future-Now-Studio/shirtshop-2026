-- 006 · Telefon am Ansprechpartner + Audit-Log für Kundenaktionen
-- ---------------------------------------------------------------------------
-- (a) Phone belongs to the contact person (one account per customer), so it
--     lives on the profile, not the company.
alter table b2b_profiles add column if not exists phone text;

-- (b) Customers may write audit entries for their OWN company, so their actions
--     (Angebot annehmen/ablehnen, Storno, Reklamation) show up in the log next
--     to the back-office actions. Reads stay company-scoped (existing policy);
--     admins already have full access via is_admin().
drop policy if exists audit_own_insert on b2b_audit_log;
create policy audit_own_insert on b2b_audit_log
  for insert with check (company_id = current_company_id());
