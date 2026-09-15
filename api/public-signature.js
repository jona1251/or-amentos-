const {getSql,withRlsSql,send}=require('./_db');
const {ensureSuiteSchema}=require('./_suite_schema');

const e=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const valid=v=>/^[a-f0-9]{48}$/i.test(String(v||''));
function reqInfo(req){return {ip:String(req.headers['x-forwarded-for']||req.headers['x-real-ip']||'').split(',')[0].trim().slice(0,120),userAgent:String(req.headers['user-agent']||'').slice(0,500)}}
function securityHeaders(res){res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")}

module.exports=async function handler(req,res){
  try{
    const token=String(req.query?.token||'');if(!valid(token))return send(res,404,{ok:false,error:'LINK_NOT_FOUND'});
    const sql=getSql();await ensureSuiteSchema(sql);
    const rows=await sql`SELECT * FROM suite_public_links WHERE token=${token} AND link_type='signature' AND (expires_at IS NULL OR expires_at>now()) LIMIT 1`;
    const link=rows[0];if(!link)return send(res,404,{ok:false,error:'LINK_NOT_FOUND'});

    if(req.method==='POST'){
      if(link.used_at)return send(res,409,{ok:false,error:'ALREADY_SIGNED'});
      const signer=String(req.body?.signerName||'').trim().slice(0,160);
      const signature=String(req.body?.signature||'');
      if(!signer)return send(res,400,{ok:false,error:'SIGNER_REQUIRED'});
      if(!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(signature)||signature.length>1500000)return send(res,400,{ok:false,error:'INVALID_SIGNATURE'});
      const info=reqInfo(req);
      const outcome=await withRlsSql(link.company_id,{id:link.owner_user_id,role:'operador'},async rls=>{
        // Reserva o link e grava assinatura/documento na mesma transação para impedir
        // duas assinaturas concorrentes do mesmo link.
        const claimed=await rls`
          UPDATE suite_public_links
          SET used_at=now(),payload=payload||${JSON.stringify({signed:true})}::jsonb
          WHERE token=${token} AND used_at IS NULL AND (expires_at IS NULL OR expires_at>now())
          RETURNING id
        `;
        if(!claimed.length)return {claimed:false};
        await rls`INSERT INTO suite_signatures(company_id,owner_user_id,entity_kind,entity_local_id,signer_name,signature_data,ip,user_agent) VALUES(${link.company_id},${link.owner_user_id},${link.entity_kind},${link.entity_local_id},${signer},${signature},${info.ip||null},${info.userAgent||null})`;
        if(link.entity_kind==='contract')await rls`UPDATE contracts SET status='Assinado',signed_at=now(),updated_at=now() WHERE company_id=${link.company_id} AND owner_user_id=${link.owner_user_id} AND local_id=${link.entity_local_id}`;
        if(link.entity_kind==='work_order')await rls`UPDATE business_records SET status='Concluída e assinada',updated_at=now() WHERE company_id=${link.company_id} AND owner_user_id=${link.owner_user_id} AND kind='work_order' AND local_id=${link.entity_local_id}`;
        return {claimed:true};
      });
      if(!outcome.claimed)return send(res,409,{ok:false,error:'ALREADY_SIGNED'});
      return send(res,200,{ok:true});
    }

    if(req.method!=='GET')return send(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});
    let title=String(link.payload?.title||'Assinatura digital').slice(0,180),subtitle=String(link.payload?.subtitle||'Revise e assine abaixo.').slice(0,400);
    if(link.entity_kind==='contract'){
      const data=await withRlsSql(link.company_id,{id:link.owner_user_id,role:'operador'},async rls=>{const r=await rls`SELECT number,contract_type,status FROM contracts WHERE company_id=${link.company_id} AND owner_user_id=${link.owner_user_id} AND local_id=${link.entity_local_id} LIMIT 1`;return r[0]||null});
      if(data){title=`Contrato ${data.number}`;subtitle=data.contract_type||subtitle}
    }
    const used=!!link.used_at;
    const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)}</title><style>*{box-sizing:border-box}body{margin:0;background:#f3f5f8;color:#172033;font-family:Arial,sans-serif}.wrap{width:min(94vw,720px);margin:28px auto}.card{background:#fff;border:1px solid #e5e7eb;border-radius:24px;padding:28px;box-shadow:0 20px 60px rgba(15,23,42,.08)}h1{margin:0 0 7px}.muted{color:#64748b}.field{margin-top:20px}.field label{display:block;font-size:12px;font-weight:800;margin-bottom:7px}.field input{width:100%;padding:13px;border:1px solid #dbe1e8;border-radius:12px}.canvasWrap{border:1px dashed #94a3b8;border-radius:16px;background:#fff;margin-top:8px;overflow:hidden}.canvasWrap canvas{width:100%;height:240px;display:block;touch-action:none}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.btn{border:0;border-radius:13px;padding:13px 17px;font-weight:900;cursor:pointer}.btn:disabled{opacity:.55;cursor:wait}.primary{background:#111827;color:#fff}.soft{background:#f1f5f9;color:#172033}.ok{padding:14px;border-radius:14px;background:#ecfdf3;color:#067647;font-weight:900;margin-top:18px}</style></head><body><div class="wrap"><div class="card"><h1>${e(title)}</h1><p class="muted">${e(subtitle)}</p>${used?'<div class="ok">✓ Este documento já foi assinado.</div>':`<div class="field"><label>Nome completo de quem está assinando</label><input id="name" autocomplete="name" maxlength="160"></div><div class="field"><label>Assinatura</label><div class="canvasWrap"><canvas id="sig"></canvas></div></div><div class="actions"><button class="btn soft" onclick="clearSig()">Limpar</button><button class="btn primary" id="signBtn" onclick="submitSig()">Assinar documento</button></div><div id="msg"></div>`}</div></div>${used?'':`<script>
const c=document.getElementById('sig'),ctx=c.getContext('2d');let drawing=false,moved=false;
function resize(){const r=c.getBoundingClientRect(),d=Math.min(window.devicePixelRatio||1,2);c.width=Math.max(1,Math.floor(r.width*d));c.height=Math.max(1,Math.floor(240*d));ctx.setTransform(d,0,0,d,0,0);ctx.lineWidth=2.2;ctx.lineCap='round';ctx.strokeStyle='#111827'}resize();
function p(ev){const r=c.getBoundingClientRect(),t=ev.touches?ev.touches[0]:ev;return{x:t.clientX-r.left,y:t.clientY-r.top}}
function start(ev){drawing=true;moved=false;const q=p(ev);ctx.beginPath();ctx.moveTo(q.x,q.y);ev.preventDefault()}function move(ev){if(!drawing)return;const q=p(ev);ctx.lineTo(q.x,q.y);ctx.stroke();moved=true;ev.preventDefault()}function end(){drawing=false}
c.addEventListener('mousedown',start);c.addEventListener('mousemove',move);window.addEventListener('mouseup',end);c.addEventListener('touchstart',start,{passive:false});c.addEventListener('touchmove',move,{passive:false});c.addEventListener('touchend',end);
function clearSig(){ctx.clearRect(0,0,c.width,c.height);moved=false}async function submitSig(){const name=document.getElementById('name').value.trim();if(!name)return alert('Informe o nome completo.');if(!moved)return alert('Faça sua assinatura no quadro.');if(!confirm('Confirmar esta assinatura? Esta ação não poderá ser repetida por este link.'))return;const btn=document.getElementById('signBtn');btn.disabled=true;const signature=c.toDataURL('image/png');try{const r=await fetch(location.href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({signerName:name,signature})});const d=await r.json();if(!r.ok){if(r.status===409){location.reload();return}throw new Error(d.error||'Falha')}document.querySelector('.card').innerHTML='<h1>Assinatura registrada</h1><div class="ok">✓ Documento assinado com sucesso.</div><p class="muted">A empresa recebeu sua assinatura, data e registro técnico de confirmação.</p>'}catch(_){btn.disabled=false;alert('Não foi possível registrar a assinatura. Tente novamente.')}}
</script>`}</body></html>`;
    securityHeaders(res);res.status(200).setHeader('Content-Type','text/html; charset=utf-8');return res.send(html);
  }catch(err){console.error('public-signature',err);return send(res,500,{ok:false,error:'SERVER_ERROR'})}
};
