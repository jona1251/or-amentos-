const {getSql,ensureCompany,authenticate,send}=require('./_db');
const {ensureSuiteSchema}=require('./_suite_schema');
module.exports=async function handler(req,res){
  try{
    if(req.method!=='GET')return send(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});
    const sql=getSql(),company=await ensureCompany(sql);await ensureSuiteSchema(sql);const user=await authenticate(sql,req);if(!user)return send(res,401,{ok:false,error:'UNAUTHORIZED'});
    const rows=await sql`SELECT permissions FROM user_permissions WHERE company_id=${company.id} AND user_id=${user.id} LIMIT 1`;
    return send(res,200,{ok:true,role:user.role,permissions:rows[0]?.permissions||{}});
  }catch(err){console.error('my-permissions',err);return send(res,500,{ok:false,error:'SERVER_ERROR'})}
};
