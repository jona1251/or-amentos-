const {getSql,ensureCompany,authenticate,send}=require('./_db');
const {getUserPermissions}=require('../lib/permissions');
module.exports=async function handler(req,res){
  try{
    if(req.method!=='GET')return send(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});
    const sql=getSql(),company=await ensureCompany(sql);const user=await authenticate(sql,req);if(!user)return send(res,401,{ok:false,error:'UNAUTHORIZED'});
    const access=await getUserPermissions(sql,company.id,user);
    return send(res,200,{ok:true,role:user.role,primaryAdmin:access.primary,permissions:access.permissions});
  }catch(err){console.error('my-permissions',err);return send(res,500,{ok:false,error:'SERVER_ERROR'})}
};
