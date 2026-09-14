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
  configuracoes:true,
  excluir:true,
  usuarios:false,
  seguranca:false
};

const allAccess = () => Object.fromEntries(Object.keys(DEFAULTS).map(k => [k, true]));

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
  const adminFull = String(user?.role || '').toLowerCase() === 'admin';

  // Regra principal: qualquer perfil Administrador possui acesso total.
  // Permissões personalizadas só se aplicam a perfis não administrativos.
  if (adminFull) {
    return { permissions:allAccess(), primary, adminFull:true };
  }

  const rows = await sql`
    SELECT permissions FROM user_permissions
    WHERE company_id=${companyId} AND user_id=${user.id}
    LIMIT 1
  `;
  return { permissions:{...DEFAULTS,...(rows[0]?.permissions||{})}, primary:false, adminFull:false };
}

async function hasPermission(sql, companyId, user, key) {
  if (String(user?.role || '').toLowerCase() === 'admin') return true;
  const { permissions, primary } = await getUserPermissions(sql, companyId, user);
  return primary || permissions[key] !== false;
}

async function requirePermission(sql, companyId, user, key) {
  if (!(await hasPermission(sql, companyId, user, key))) {
    const err = new Error('ACCESS_DENIED');
    err.code = 'ACCESS_DENIED';
    err.permission = key;
    throw err;
  }
}

module.exports = { DEFAULTS, allAccess, ensurePermissionsTable, getPrimaryAdmin, getUserPermissions, hasPermission, requirePermission };
