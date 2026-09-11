const { getSql, ensureCompany, authenticate, withRlsSql, send } = require('./_db');

const toNum = v => Number(v || 0);
const iso = v => v ? new Date(v) : new Date();

async function ensureUserSettings(sql, companyId, userId) {
  let rows = await sql`SELECT * FROM user_settings WHERE company_id=${companyId} AND user_id=${userId} LIMIT 1`;
  if (!rows.length) {
    rows = await sql`
      INSERT INTO user_settings (company_id,user_id,company_name,budget_prefix,budget_seq,contract_prefix,contract_seq)
      VALUES (${companyId},${userId},'Minha empresa','ORC',1,'CTR',1)
      RETURNING *
    `;
  }
  return rows[0];
}

async function clientUuid(sql, companyId, userId, localId) {
  if (!localId) return null;
  const rows = await sql`SELECT id FROM clients WHERE company_id=${companyId} AND owner_user_id=${userId} AND local_id=${localId} LIMIT 1`;
  return rows[0]?.id || null;
}
async function productUuid(sql, companyId, userId, localId) {
  if (!localId) return null;
  const rows = await sql`SELECT id FROM products WHERE company_id=${companyId} AND owner_user_id=${userId} AND local_id=${localId} LIMIT 1`;
  return rows[0]?.id || null;
}
async function budgetUuid(sql, companyId, userId, localId) {
  if (!localId) return null;
  const rows = await sql`SELECT id FROM budgets WHERE company_id=${companyId} AND owner_user_id=${userId} AND local_id=${localId} LIMIT 1`;
  return rows[0]?.id || null;
}

async function saveSettings(sql, companyId, userId, r) {
  const rows = await sql`
    INSERT INTO user_settings (
      company_id,user_id,company_name,company_document,company_owner,company_phone,company_email,company_address,company_city,
      pix_key,logo_url,slogan,budget_prefix,budget_seq,contract_prefix,contract_seq,updated_at
    ) VALUES (
      ${companyId},${userId},${r.companyName || 'Minha empresa'},${r.companyDoc || null},${r.companyOwner || null},${r.companyPhone || null},${r.companyEmail || null},${r.companyAddress || null},${r.companyCity || null},
      ${r.pixKey || null},${r.companyLogo || null},${r.companySlogan || null},${r.budgetPrefix || 'ORC'},${toNum(r.budgetSeq) || 1},${r.contractPrefix || 'CTR'},${toNum(r.contractSeq) || 1},now()
    )
    ON CONFLICT (company_id,user_id) DO UPDATE SET
      company_name=EXCLUDED.company_name, company_document=EXCLUDED.company_document, company_owner=EXCLUDED.company_owner,
      company_phone=EXCLUDED.company_phone, company_email=EXCLUDED.company_email, company_address=EXCLUDED.company_address,
      company_city=EXCLUDED.company_city, pix_key=EXCLUDED.pix_key, logo_url=EXCLUDED.logo_url, slogan=EXCLUDED.slogan,
      budget_prefix=EXCLUDED.budget_prefix, budget_seq=EXCLUDED.budget_seq,
      contract_prefix=EXCLUDED.contract_prefix, contract_seq=EXCLUDED.contract_seq, updated_at=now()
    RETURNING user_id
  `;
  return rows[0];
}

async function saveClient(sql, companyId, userId, r) {
  const rows = await sql`
    INSERT INTO clients (company_id, owner_user_id, local_id, name, document, phone, email, address, notes, created_at, updated_at)
    VALUES (${companyId}, ${userId}, ${r.id}, ${r.name || 'Cliente'}, ${r.doc || null}, ${r.phone || null}, ${r.email || null}, ${r.address || null}, ${r.notes || null}, ${iso(r.createdAt)}, ${iso(r.updatedAt)})
    ON CONFLICT (company_id, local_id) DO UPDATE SET
      name=EXCLUDED.name, document=EXCLUDED.document, phone=EXCLUDED.phone, email=EXCLUDED.email,
      address=EXCLUDED.address, notes=EXCLUDED.notes, updated_at=EXCLUDED.updated_at
    WHERE clients.owner_user_id=${userId}
    RETURNING id
  `;
  if (!rows.length) throw new Error('RECORD_OWNED_BY_ANOTHER_USER');
  return rows[0];
}

async function saveProduct(sql, companyId, userId, r) {
  const rows = await sql`
    INSERT INTO products (company_id, owner_user_id, local_id, type, name, code, category, unit, sale_price, cost_price, stock, description, active, created_at, updated_at)
    VALUES (${companyId}, ${userId}, ${r.id}, ${r.type || 'Produto'}, ${r.name || 'Produto'}, ${r.code || null}, ${r.category || null}, ${r.unit || 'un'}, ${toNum(r.price)}, ${r.cost == null ? null : toNum(r.cost)}, ${r.stock == null || r.stock === '' ? null : Number(r.stock)}, ${r.description || null}, ${r.active !== false}, ${iso(r.createdAt)}, ${iso(r.updatedAt)})
    ON CONFLICT (company_id, local_id) DO UPDATE SET
      type=EXCLUDED.type, name=EXCLUDED.name, code=EXCLUDED.code, category=EXCLUDED.category, unit=EXCLUDED.unit,
      sale_price=EXCLUDED.sale_price, cost_price=EXCLUDED.cost_price, stock=EXCLUDED.stock,
      description=EXCLUDED.description, active=EXCLUDED.active, updated_at=EXCLUDED.updated_at
    WHERE products.owner_user_id=${userId}
    RETURNING id
  `;
  if (!rows.length) throw new Error('RECORD_OWNED_BY_ANOTHER_USER');
  return rows[0];
}

async function saveBudget(sql, companyId, userId, r) {
  let cId = await clientUuid(sql, companyId, userId, r.client?.id);
  if (!cId && r.client?.id) { await saveClient(sql, companyId, userId, r.client); cId = await clientUuid(sql, companyId, userId, r.client.id); }
  if (!cId) throw new Error('CLIENT_NOT_FOUND');
  const rows = await sql`
    INSERT INTO budgets (company_id, owner_user_id, local_id, client_id, number, status, valid_days, payment_method, deadline, warranty, execution_location, notes, subtotal, discount, total, created_at, updated_at)
    VALUES (${companyId}, ${userId}, ${r.id}, ${cId}, ${r.number}, ${r.status || 'Rascunho'}, ${toNum(r.validDays) || 10}, ${r.paymentMethod || null}, ${r.deadline || null}, ${r.warranty || null}, ${r.executionLocation || null}, ${r.notes || null}, ${toNum(r.subtotal)}, ${toNum(r.discount)}, ${toNum(r.total)}, ${iso(r.createdAt)}, ${iso(r.updatedAt)})
    ON CONFLICT (company_id, local_id) DO UPDATE SET
      client_id=EXCLUDED.client_id, number=EXCLUDED.number, status=EXCLUDED.status, valid_days=EXCLUDED.valid_days,
      payment_method=EXCLUDED.payment_method, deadline=EXCLUDED.deadline, warranty=EXCLUDED.warranty,
      execution_location=EXCLUDED.execution_location, notes=EXCLUDED.notes, subtotal=EXCLUDED.subtotal,
      discount=EXCLUDED.discount, total=EXCLUDED.total, updated_at=EXCLUDED.updated_at
    WHERE budgets.owner_user_id=${userId}
    RETURNING id
  `;
  if (!rows.length) throw new Error('RECORD_OWNED_BY_ANOTHER_USER');
  const budgetId = rows[0].id;
  await sql`DELETE FROM budget_items WHERE budget_id=${budgetId}`;
  for (const item of (r.items || [])) {
    const pId = await productUuid(sql, companyId, userId, item.productId);
    await sql`
      INSERT INTO budget_items (budget_id, local_id, product_id, description, quantity, unit_price)
      VALUES (${budgetId}, ${item.id || null}, ${pId}, ${item.description || 'Item'}, ${Number(item.qty || 0)}, ${Number(item.unit || 0)})
    `;
  }
  return { id: budgetId };
}

async function saveContract(sql, companyId, userId, r) {
  const bId = await budgetUuid(sql, companyId, userId, r.budgetId || r.budget?.id);
  if (!bId) throw new Error('BUDGET_NOT_FOUND');
  const b = await sql`SELECT client_id FROM budgets WHERE id=${bId} AND owner_user_id=${userId} LIMIT 1`;
  const cId = b[0]?.client_id;
  if (!cId) throw new Error('CLIENT_NOT_FOUND');
  const rows = await sql`
    INSERT INTO contracts (company_id, owner_user_id, local_id, budget_id, client_id, number, contract_type, forum_city, contract_term, additional_clauses, status, signed_at, created_at, updated_at)
    VALUES (${companyId}, ${userId}, ${r.id}, ${bId}, ${cId}, ${r.number}, ${r.type || r.contractType || 'Prestação de Serviços'}, ${r.forum || r.forumCity || null}, ${r.term || r.contractTerm || null}, ${r.clauses || r.additionalClauses || null}, ${r.status || 'Rascunho'}, ${r.signedAt ? new Date(r.signedAt) : null}, ${iso(r.createdAt)}, ${iso(r.updatedAt)})
    ON CONFLICT (company_id, local_id) DO UPDATE SET
      budget_id=EXCLUDED.budget_id, client_id=EXCLUDED.client_id, number=EXCLUDED.number,
      contract_type=EXCLUDED.contract_type, forum_city=EXCLUDED.forum_city, contract_term=EXCLUDED.contract_term,
      additional_clauses=EXCLUDED.additional_clauses, status=EXCLUDED.status, signed_at=EXCLUDED.signed_at, updated_at=EXCLUDED.updated_at
    WHERE contracts.owner_user_id=${userId}
    RETURNING id
  `;
  if (!rows.length) throw new Error('RECORD_OWNED_BY_ANOTHER_USER');
  return rows[0];
}

async function snapshot(sql, companyId, userId) {
  const s = await ensureUserSettings(sql, companyId, userId);
  const clients = await sql`SELECT * FROM clients WHERE company_id=${companyId} AND owner_user_id=${userId} ORDER BY updated_at`;
  const products = await sql`SELECT * FROM products WHERE company_id=${companyId} AND owner_user_id=${userId} ORDER BY updated_at`;
  const budgets = await sql`
    SELECT b.*, c.local_id AS client_local_id, c.name AS client_name, c.document AS client_document,
      c.phone AS client_phone, c.email AS client_email, c.address AS client_address
    FROM budgets b JOIN clients c ON c.id=b.client_id
    WHERE b.company_id=${companyId} AND b.owner_user_id=${userId} AND c.owner_user_id=${userId}
    ORDER BY b.updated_at
  `;
  const budgetRows = [];
  for (const b of budgets) {
    const items = await sql`
      SELECT bi.*, p.local_id AS product_local_id FROM budget_items bi
      LEFT JOIN products p ON p.id=bi.product_id AND p.owner_user_id=${userId}
      WHERE bi.budget_id=${b.id} ORDER BY bi.id
    `;
    budgetRows.push({
      id:b.local_id, number:b.number, status:b.status, validDays:b.valid_days, paymentMethod:b.payment_method || '',
      deadline:b.deadline || '', warranty:b.warranty || '', executionLocation:b.execution_location || '', notes:b.notes || '',
      subtotal:Number(b.subtotal), discount:Number(b.discount), total:Number(b.total), createdAt:b.created_at, updatedAt:b.updated_at,
      client:{id:b.client_local_id,name:b.client_name,doc:b.client_document||'',phone:b.client_phone||'',email:b.client_email||'',address:b.client_address||''},
      items:items.map(i=>({id:i.local_id||undefined,productId:i.product_local_id||undefined,description:i.description,qty:Number(i.quantity),unit:Number(i.unit_price)}))
    });
  }
  const contracts = await sql`
    SELECT ct.*, b.local_id AS budget_local_id FROM contracts ct
    JOIN budgets b ON b.id=ct.budget_id
    WHERE ct.company_id=${companyId} AND ct.owner_user_id=${userId} AND b.owner_user_id=${userId}
    ORDER BY ct.updated_at
  `;
  return {
    settings:[{id:'main',companyName:s.company_name||'',companyDoc:s.company_document||'',companyOwner:s.company_owner||'',companyPhone:s.company_phone||'',companyEmail:s.company_email||'',companyAddress:s.company_address||'',companyCity:s.company_city||'',companyLogo:s.logo_url||'',companySlogan:s.slogan||'',pixKey:s.pix_key||'',budgetPrefix:s.budget_prefix||'ORC',budgetSeq:s.budget_seq||1,contractPrefix:s.contract_prefix||'CTR',contractSeq:s.contract_seq||1}],
    clients:clients.map(x=>({id:x.local_id,name:x.name,doc:x.document||'',phone:x.phone||'',email:x.email||'',address:x.address||'',notes:x.notes||'',createdAt:x.created_at,updatedAt:x.updated_at})),
    products:products.map(x=>({id:x.local_id,type:x.type,name:x.name,code:x.code||'',category:x.category||'',unit:x.unit,price:Number(x.sale_price),cost:x.cost_price==null?0:Number(x.cost_price),stock:x.stock==null?null:Number(x.stock),description:x.description||'',active:x.active,createdAt:x.created_at,updatedAt:x.updated_at})),
    budgets:budgetRows,
    contracts:contracts.map(x=>({id:x.local_id,budgetId:x.budget_local_id,number:x.number,type:x.contract_type,forum:x.forum_city||'',term:x.contract_term||'',clauses:x.additional_clauses||'',status:x.status,signedAt:x.signed_at,createdAt:x.created_at,updatedAt:x.updated_at}))
  };
}

module.exports = async function handler(req, res) {
  try {
    const adminSql = getSql();
    const company = await ensureCompany(adminSql);
    const user = await authenticate(adminSql, req);
    if (!user) return send(res, 401, { ok:false, error:'UNAUTHORIZED' });

    return await withRlsSql(company.id, user, async sql => {
      if (req.method === 'GET') return send(res, 200, { ok:true, data:await snapshot(sql, company.id, user.id) });

      if (req.method === 'POST') {
        const store = req.body?.store;
        const record = req.body?.record || {};
        if (store === 'settings') await saveSettings(sql, company.id, user.id, record);
        else if (store === 'clients') await saveClient(sql, company.id, user.id, record);
        else if (store === 'products') await saveProduct(sql, company.id, user.id, record);
        else if (store === 'budgets') await saveBudget(sql, company.id, user.id, record);
        else if (store === 'contracts') await saveContract(sql, company.id, user.id, record);
        else return send(res, 400, {ok:false,error:'INVALID_STORE'});
        return send(res, 200, {ok:true});
      }

      if (req.method === 'DELETE') {
        const store = String(req.query?.store || '');
        const id = String(req.query?.id || '');
        if (!['clients','products','budgets','contracts'].includes(store) || !id) return send(res, 400, {ok:false,error:'INVALID_DELETE'});
        if (store === 'clients') await sql`DELETE FROM clients WHERE company_id=${company.id} AND owner_user_id=${user.id} AND local_id=${id}`;
        if (store === 'products') await sql`DELETE FROM products WHERE company_id=${company.id} AND owner_user_id=${user.id} AND local_id=${id}`;
        if (store === 'budgets') await sql`DELETE FROM budgets WHERE company_id=${company.id} AND owner_user_id=${user.id} AND local_id=${id}`;
        if (store === 'contracts') await sql`DELETE FROM contracts WHERE company_id=${company.id} AND owner_user_id=${user.id} AND local_id=${id}`;
        return send(res, 200, {ok:true});
      }

      return send(res, 405, {ok:false,error:'METHOD_NOT_ALLOWED'});
    });
  } catch (err) {
    const missing = err?.message === 'DATABASE_URL_NOT_CONFIGURED';
    const rls = ['RLS_CONTEXT_REQUIRED','42501'].includes(err?.code) || String(err?.message || '').includes('row-level security');
    console.error(err);
    return send(res, missing ? 503 : 500, {
      ok:false,
      error:missing ? 'DATABASE_NOT_CONNECTED' : (rls ? 'RLS_ACCESS_DENIED' : 'SERVER_ERROR')
    });
  }
};
