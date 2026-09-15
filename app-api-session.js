(function(){
  const nativeFetch=window.fetch.bind(window);

  function isSameOriginApi(input){
    try{
      const raw=typeof input==='string'?input:input?.url;
      const url=new URL(raw||'',location.href);
      return url.origin===location.origin&&url.pathname.startsWith('/api/');
    }catch(_){return false}
  }

  function sanitizeHeaders(input,init){
    const base=init?.headers||(input instanceof Request?input.headers:undefined);
    const headers=new Headers(base||{});
    headers.delete('x-orca-auth');
    headers.delete('x-orca-user');
    return headers;
  }

  window.fetch=function(input,init={}){
    if(!isSameOriginApi(input))return nativeFetch(input,init);
    const headers=sanitizeHeaders(input,init);
    return nativeFetch(input,{...init,headers,credentials:'same-origin'});
  };

  window.orcaApi=async function(url,options={}){
    const headers=new Headers(options.headers||{});
    if(options.body!=null&&!headers.has('Content-Type')&&!(options.body instanceof FormData))headers.set('Content-Type','application/json');
    const res=await window.fetch(url,{...options,headers,cache:options.cache||'no-store'});
    let body={};
    const type=String(res.headers.get('content-type')||'');
    try{body=type.includes('application/json')?await res.json():await res.text()}catch(_){}
    if(!res.ok){
      const code=body&&typeof body==='object'?body.error:null;
      const err=new Error(code||('HTTP_'+res.status));
      err.status=res.status;
      err.body=body;
      err.retryAfter=Number((body&&body.retryAfter)||res.headers.get('Retry-After')||0);
      err.attemptsRemaining=body&&body.attemptsRemaining;
      err.permission=body&&body.permission;
      throw err;
    }
    return body;
  };

  window.orcaSessionApiEnabled=true;
})();
