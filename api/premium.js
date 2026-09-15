const crypto = require('crypto');
const QRCode = require('qrcode');
const { getSql, ensureCompany, authenticate, withRlsSql, send } = require('./_db');
const { ensurePremiumSchema } = require('./_premium_schema');
const { buildPixPayload } = require('./_pix');
const { requirePermission } = require('../lib/permissions');

function originFromReq(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().replace(/[\r\n]/g,'');
  return host ? `${proto === 'http' ? 'http' : 'https'}://${host}` : '';
}
function safeDate(v) {
  const s = String(v || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
async function getBudget(sql, companyId, userId, localId) {
  const rows = await sql`
    SELECT b.id, b.local_id, b.number, b.total, b.status, b.client_id,
           c.name AS client_name, c.phone AS client_phone, c.email AS client_email
    FROM budgets b
    JOIN clients c ON c.id=b.client_id
    WHERE b.company_id=${companyId} AND b.owner_user_id=${userId} AND b.local_id=${localId}
    LIMIT 1
  `;
  return rows[0] || null;
}

module.exports = async function handler(req, res) {
  try {
    const adminSql = getSql();
    const company = await ensureCompany(adminSql);
    await ensurePremiumSchema(adminSql);
    const user = await authenticate(adminSql, req);
    if (!user) return send(res,401,{ok:false,error:'UNAUTHORIZED'});

    if (req.method === 'GET') {
      await requirePermission(adminSql,company.id,user,'financeiro');
      const data = await withRlsSql(company.id,user,async sql => {
        const rows = await sql`
          SELECT r.id, r.amount, r.paid_amount, r.due_date, r.status, r.notes,
                 r.created_at, r.updated_at,
                 b.local_id AS budget_local_id, b.number AS budget_number, b.status AS budget_status,
                 c.name AS client_name, c.phone AS client_phone
          FROM receivables r
          JOIN budgets b ON b.id=r.budget_id
          JOIN clients c ON c.id=b.client_id
          WHERE r.company_id=${company.id} AND r.owner_user_id=${user.id}
          ORDER BY COALESCE(r.due_date,CURRENT_DATE + 36500), r.updated_at DESC
        `;
        return rows.map(x=>({
          id:x.id,budgetId:x.budget_local_id,budgetNumber:x.budget_number,budgetStatus:x.budget_status,
          clientName:x.client_name,clientPhone:x.client_phone || '',amount:Number(x.amount || 0),
          paidAmount:Number(x.paid_amount || 0),dueDate:x.due_date || null,status:x.status || 'Pendente',
          notes:x.notes || '',createdAt:x.created_at,updatedAt:x.updated_at
        }));
      });
      return send(res,200,{ok:true,receivables:data});
    }

    if (req.method !== 'POST') return send(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});
    const action = String(req.body?.action || '');

    if (action === 'share_budget') {
      await requirePermission(adminSql,company.id,user,'orcamentos');
      const budgetLocalId = String(req.body?.budgetId || '').trim();
      const budget = await withRlsSql(company.id,user,sql=>getBudget(sql,company.id,user.id,budgetLocalId));
      if (!budget) return send(res,404,{ok:false,error:'BUDGET_NOT_FOUND'});

      let links = await adminSql`
        SELECT token,expires_at,response_status FROM public_budget_links
        WHERE company_id=${company.id} AND owner_user_id=${user.id} AND budget_id=${budget.id}
        LIMIT 1
      `;
      let link = links[0];
      let token = link?.token;
      const expired = link?.expires_at && new Date(link.expires_at).getTime() <= Date.now();

      if (!link) {
        token = crypto.randomBytes(24).toString('hex');
        links = await adminSql`
          INSERT INTO public_budget_links(token,company_id,owner_user_id,budget_id,expires_at)
          VALUES(${token},${company.id},${user.id},${budget.id},now()+interval '30 days')
          ON CONFLICT (company_id,owner_user_id,budget_id) DO NOTHING
          RETURNING token,expires_at,response_status
        `;
        if (!links.length) {
          links = await adminSql`SELECT token,expires_at,response_status FROM public_budget_links WHERE company_id=${company.id} AND owner_user_id=${user.id} AND budget_id=${budget.id} LIMIT 1`;
        }
        link = links[0];token = link?.token || token;
      } else if (expired && !link.response_status) {
        token = crypto.randomBytes(24).toString('hex');
        const renewed = await adminSql`
          UPDATE public_budget_links
          SET token=${token},expires_at=now()+interval '30 days',viewed_at=NULL,responded_at=NULL,response_status=NULL
          WHERE company_id=${company.id} AND owner_user_id=${user.id} AND budget_id=${budget.id} AND response_status IS NULL
          RETURNING token,expires_at,response_status
        `;
        if (renewed.length) link = renewed[0];
      }

      await withRlsSql(company.id,user,async sql => {
        await sql`
          UPDATE budgets SET status=CASE WHEN status='Rascunho' THEN 'Enviado' ELSE status END,updated_at=now()
          WHERE id=${budget.id} AND company_id=${company.id} AND owner_user_id=${user.id}
        `;
      });
      return send(res,200,{
        ok:true,token,
        url:`${originFromReq(req)}/api/public-budget?token=${encodeURIComponent(token)}`,
        budgetNumber:budget.number,clientName:budget.client_name,
        expiresAt:link?.expires_at || null,responseStatus:link?.response_status || null
      });
    }

    if (action === 'pix') {
      await requirePermission(adminSql,company.id,user,'financeiro');
      const budgetLocalId = String(req.body?.budgetId || '').trim();
      const data = await withRlsSql(company.id,user,async sql => {
        const budget = await getBudget(sql,company.id,user.id,budgetLocalId);
        if (!budget) return null;
        const s = await sql`SELECT pix_key,company_name,company_city FROM user_settings WHERE company_id=${company.id} AND user_id=${user.id} LIMIT 1`;
        return {budget,settings:s[0] || {}};
      });
      if (!data) return send(res,404,{ok:false,error:'BUDGET_NOT_FOUND'});
      if (!data.settings.pix_key) return send(res,400,{ok:false,error:'PIX_NOT_CONFIGURED'});
      const payload = buildPixPayload({
        key:data.settings.pix_key,merchantName:data.settings.company_name,merchantCity:data.settings.company_city,
        amount:data.budget.total,description:`Orcamento ${data.budget.number}`,
        txid:String(data.budget.number || 'ORC').replace(/[^A-Za-z0-9]/g,'').slice(0,25) || '***'
      });
      const qr = await QRCode.toDataURL(payload,{width:320,margin:1,errorCorrectionLevel:'M'});
      return send(res,200,{ok:true,payload,qr,amount:Number(data.budget.total || 0),budgetNumber:data.budget.number});
    }

    if (action === 'create_receivable') {
      await requirePermission(adminSql,company.id,user,'financeiro');
      const budgetLocalId = String(req.body?.budgetId || '').trim();
      const dueDate = safeDate(req.body?.dueDate);
      const result = await withRlsSql(company.id,user,async sql => {
        const budget = await getBudget(sql,company.id,user.id,budgetLocalId);
        if (!budget) return null;
        const rows = await sql`
          INSERT INTO receivables(company_id,owner_user_id,budget_id,amount,due_date,status,updated_at)
          VALUES(${company.id},${user.id},${budget.id},${Math.max(0,Number(budget.total || 0))},${dueDate},'Pendente',now())
          ON CONFLICT (company_id,owner_user_id,budget_id)
          DO UPDATE SET due_date=COALESCE(EXCLUDED.due_date,receivables.due_date),updated_at=now()
          RETURNING id,amount,paid_amount,due_date,status
        `;
        return rows[0];
      });
      if (!result) return send(res,404,{ok:false,error:'BUDGET_NOT_FOUND'});
      return send(res,200,{ok:true,receivable:result});
    }

    if (action === 'update_receivable') {
      await requirePermission(adminSql,company.id,user,'financeiro');
      const id = String(req.body?.id || '').trim();
      const dueDate = safeDate(req.body?.dueDate);
      const requestedStatus = String(req.body?.status || 'Pendente');
      const allowed = new Set(['Pendente','Parcial','Pago','Cancelado']);
      if (!allowed.has(requestedStatus)) return send(res,400,{ok:false,error:'INVALID_STATUS'});
      const paidAmount = Math.max(0,Number(req.body?.paidAmount || 0));
      const notes = String(req.body?.notes || '').slice(0,1000);
      const rows = await withRlsSql(company.id,user,async sql => {
        const current = await sql`SELECT id,amount FROM receivables WHERE id::text=${id} AND company_id=${company.id} AND owner_user_id=${user.id} LIMIT 1`;
        if (!current.length) return [];
        const amount = Number(current[0].amount || 0);
        let status = requestedStatus;
        if (paidAmount >= amount && amount > 0) status='Pago';
        else if (paidAmount > 0 && status === 'Pendente') status='Parcial';
        return sql`
          UPDATE receivables
          SET paid_amount=${Math.min(paidAmount,amount || paidAmount)},due_date=${dueDate},status=${status},notes=${notes},updated_at=now()
          WHERE id=${current[0].id} AND company_id=${company.id} AND owner_user_id=${user.id}
          RETURNING id,amount,paid_amount,due_date,status,notes
        `;
      });
      if (!rows.length) return send(res,404,{ok:false,error:'RECEIVABLE_NOT_FOUND'});
      return send(res,200,{ok:true,receivable:rows[0]});
    }

    return send(res,400,{ok:false,error:'INVALID_ACTION'});
  } catch (err) {
    console.error('premium',err);
    const denied = err?.message === 'ACCESS_DENIED' || err?.code === 'ACCESS_DENIED';
    const missing = err?.message === 'DATABASE_URL_NOT_CONFIGURED';
    return send(res,denied?403:(missing?503:500),{
      ok:false,error:denied?'ACCESS_DENIED':(missing?'DATABASE_NOT_CONNECTED':'SERVER_ERROR'),
      ...(denied?{permission:err.permission || null}:{})
    });
  }
};
