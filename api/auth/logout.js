import { send } from '../../lib/server.js';
export default function handler(req,res) { if(req.method!=='POST')return send(res,405,{error:'Method not allowed.'}); res.setHeader('Set-Cookie','ccs_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'); return send(res,200,{ok:true}); }
