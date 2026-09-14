const DEFAULTS = {
  dashboard:true,
  clientes:true,
  produtos:true,
  orcamentos:true,
  contratos:true,
  financeiro:true,
  operacoes:true,
  crm:true,
  relatorios:true,
  custos:true,
  excluir:true,
  usuarios:false,
  seguranca:false
};

async function ensurePermissionsTable(sql) {
  await sql`CREATE TABLE IF NOT EXISTS user_permissions (
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(company_id,user_id)
  )`;
}

async function getPrimaryAdmin(sql, companyId) {
  const rows = await sql`
    SELECT id FROM users
    WHERE company_id=${companyId} AND role='admin'
    ORDER BY created_at ASC LIMIT 1
  `;
  return rows[0]?.id || null;
}

async function getUserPermissions(sql, companyId, user) {
  await ensurePermissionsTable(sql);
  const primaryId = await getPrimaryAdmin(sql, companyId);
  const primary = String(primaryId || '') === String(user?.id || '');
  if (primary) {
    const all = {...DEFAULTS};
    Object.keys(all).forEach(k => all[k] = true);
    return { permissions:all, primary:true };
  }
  const rows = await sql`
    SELECT permissions FROM user_permissions
    WHERE company_id=${companyId} AND user_id=${user.id}
    LIMIT 1
  `;
  const saved = rows[0]?.permissions || {};
  const permissions = {...DEFAULTS, ...saved};
  if (user?.role === 'admin') {
    // Admin secundário continua podendo usar o sistema, mas o admin principal
    // pode retirar módulos individualmente. Gerenciar usuários e segurança
    // não é liberado automaticamente.
    permissions.dashboard = saved.dashboard !== false;
  }
  return { permissions, primary:false };
}

async function hasPermission(sql, companyId, user, key) {
  const { permissions, primary } = await getUserPermissions(sql, companyId, user);
  return primary || permissions[key] !== false;
}

async function requirePermission(sql, companyId, user, key) {
  const ok = await hasPermission(sql, companyId, user, key);
  if (!ok) {
    const err = new Error('ACCESS_DENIED');
    err.code = 'ACCESS_DENIED';
    err.permission = key;
    throw err;
  }
}

module.exports = { DEFAULTS, ensurePermissionsTable, getPrimaryAdmin, getUserPermissions, hasPermission, requirePermission };
