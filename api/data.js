import { collection, getData, readBody, requireUser, send, safeData, saveData } from '../lib/server.js';
export default async function handler(req,res){
 try { const user=await requireUser(req,res); if(!user)return; const col=await collection();
  if(req.method==='GET') return send(res,200,{data:safeData(await getData(col),user)});
  if(req.method==='PUT') { const body=await readBody(req); if(!body.data || typeof body.data!=='object')return send(res,400,{error:'Invalid database payload.'}); await saveData(col,body.data,user); return send(res,200,{ok:true}); }
  return send(res,405,{error:'Method not allowed.'});
 } catch(e){console.error(e);return send(res,500,{error:e.message||'Database operation failed.'});}
}
