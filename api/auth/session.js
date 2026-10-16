import { requireUser, send, safeUser } from '../../lib/server.js';
export default async function handler(req,res) {
  if(req.method!=='GET') return send(res,405,{error:'Method not allowed.'});
  try { const user=await requireUser(req,res); if(!user)return; return send(res,200,{user:safeUser(user)}); }
  catch(e){console.error(e);return send(res,500,{error:'Session service unavailable.'});}
}
