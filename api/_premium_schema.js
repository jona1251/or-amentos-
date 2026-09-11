let premiumSchemaPromise = null;

async function run(sql, text, params = []) {
  if (typeof sql?.query !== 'function') throw new Error('SQL_QUERY_API_UNAVAILABLE');
  const result = await sql.query(text, params);
  return result?.rows || result || [];
}

async function ensurePremiumSchema(sql) {
  if (!premiumSchemaPromise) {
    premiumSchemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS public_budget_links (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          token text NOT NULL UNIQUE,
          company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
          created_at timestamptz NOT NULL DEFAULT now(),
          viewed_at timestamptz,
          responded_at timestamptz,
          response_status text,
          UNIQUE(company_id, owner_user_id, budget_id)
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS receivables (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
          amount numeric(12,2) NOT NULL DEFAULT 0,
          paid_amount numeric(12,2) NOT NULL DEFAULT 0,
          due_date date,
          status text NOT NULL DEFAULT 'Pendente',
          notes text,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE(company_id, owner_user_id, budget_id)
        )
      `;

      await sql`CREATE INDEX IF NOT EXISTS idx_public_budget_links_token ON public_budget_links(token)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_receivables_owner_due ON receivables(company_id, owner_user_id, due_date)`;

      await run(sql, 'ALTER TABLE receivables ENABLE ROW LEVEL SECURITY');
      await run(sql, 'ALTER TABLE receivables FORCE ROW LEVEL SECURITY');

      const policyRows = await sql`
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='receivables' AND policyname='orca_receivables_owner'
        LIMIT 1
      `;
      const companyCtx = "NULLIF(current_setting('app.current_company_id', true), '')::uuid";
      const userCtx = "NULLIF(current_setting('app.current_user_id', true), '')::uuid";
      const usingExpr = `company_id=${companyCtx} AND owner_user_id=${userCtx}`;
      if (policyRows.length) {
        await run(sql, `ALTER POLICY orca_receivables_owner ON receivables TO PUBLIC USING (${usingExpr}) WITH CHECK (${usingExpr})`);
      } else {
        await run(sql, `CREATE POLICY orca_receivables_owner ON receivables FOR ALL TO PUBLIC USING (${usingExpr}) WITH CHECK (${usingExpr})`);
      }
    })();
  }
  try {
    await premiumSchemaPromise;
  } catch (err) {
    premiumSchemaPromise = null;
    throw err;
  }
}

module.exports = { ensurePremiumSchema };
