const { randomUUID } = require('crypto');
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const user = context.clientContext && context.clientContext.user;
  if (!user) return json(401, { message: 'Unauthorized (로그인 필요)' });
  const bearer = (event.headers.authorization || '').trim();
  if (!/^Bearer\s.+/i.test(bearer)) return json(401, { message: 'Missing Authorization Bearer token' });
  const { GIT_OWNER, GIT_REPO, GIT_BASE_BRANCH = 'main' } = process.env;
  if (!GIT_OWNER || !GIT_REPO) return json(500,{ message:'Set GIT_OWNER & GIT_REPO env vars in Netlify.'});
  let body; try{ body = JSON.parse(event.body||'{}'); }catch{ return json(400,{message:'Invalid JSON body'}) }
  const req=['title','category','reward_type','contact','desc']; for(const k of req){ if(!String(body[k]||'').trim()) return json(400,{message:`Missing field: ${k}`}) }
  const id=randomUUID(); const createdAt=new Date().toISOString();
  const author={ id:user.sub, email:user.email, name:(user.user_metadata&&(user.user_metadata.full_name||user.user_metadata.name))||'NOYP User' };
  const job={ id, createdAt, status:'pending', author, data:{ title:String(body.title).slice(0,160), company:String(body.company||'').slice(0,120), category:String(body.category).slice(0,60), location:String(body.location||'').slice(0,60), reward_type:String(body.reward_type).slice(0,60), share:String(body.share||'').slice(0,120), cap:String(body.cap||'').slice(0,120), trigger:String(body.trigger||'').slice(0,120), contact:String(body.contact).slice(0,160), desc:String(body.desc).slice(0,4000) } };
  const relPath=`data/jobs/pending/${id}.json`; const contentB64=Buffer.from(JSON.stringify(job,null,2),'utf8').toString('base64');
  const siteOrigin=new URL(event.rawUrl).origin; const GIT=`${siteOrigin}/.netlify/git/github`;
  const headers={'Authorization':bearer,'Content-Type':'application/json'};
  try{
    let res=await fetch(`${GIT}/repos/${GIT_OWNER}/${GIT_REPO}/git/ref/heads/${encodeURIComponent(GIT_BASE_BRANCH)}`,{headers});
    if(!res.ok){ res=await fetch(`${GIT}/repos/${GIT_OWNER}/${GIT_REPO}/git/refs/heads/${encodeURIComponent(GIT_BASE_BRANCH)}`,{headers}); if(!res.ok) return json(502,{message:'Failed to get base ref',detail:await res.text()}) }
    const ref=await res.json(); const baseSha=(ref.object&&ref.object.sha)||ref.sha; const branch=`job-pending-${id}`;
    let mk=await fetch(`${GIT}/repos/${GIT_OWNER}/${GIT_REPO}/git/refs`,{method:'POST',headers,body:JSON.stringify({ref:`refs/heads/${branch}`,sha:baseSha})});
    if(!mk.ok && mk.status!==422) return json(502,{message:'Failed to create branch',detail:await mk.text()});
    const put=await fetch(`${GIT}/repos/${GIT_OWNER}/${GIT_REPO}/contents/${relPath}`,{method:'PUT',headers,body:JSON.stringify({message:`chore(jobs): add pending job ${id} by ${author.email}`,content:contentB64,branch,committer:{name:author.name,email:author.email||'noreply@noyp'}})});
    if(!put.ok) return json(502,{message:'Failed to write file',detail:await put.text()});
    const prTitle=`[NOYP] Pending Job: ${job.data.title}`; const prBody=`자동 생성: 사용자가 제출한 공고를 검토해 주세요.\n\n- id: ${id}\n- 작성자: ${author.email}\n- 경로: ${relPath}`;
    const pr=await fetch(`${GIT}/repos/${GIT_OWNER}/${GIT_REPO}/pulls`,{method:'POST',headers,body:JSON.stringify({title:prTitle,head:branch,base:GIT_BASE_BRANCH,body:prBody})});
    let prInfo=null; if(pr.ok){ const d=await pr.json(); prInfo={number:d.number,url:d.html_url} } else if(pr.status!==422){ return json(200,{ok:true,id,path:relPath,branch,pr:null,note:'File committed. PR not created.',detail:await pr.text()}) }
    return json(200,{ok:true,id,path:relPath,branch,pr:prInfo});
  }catch(e){ return json(500,{message:'Unexpected error',error:String(e)}) }
};
function json(statusCode,obj){ return { statusCode, headers:{'Content-Type':'application/json; charset=utf-8'}, body: JSON.stringify(obj) } }
