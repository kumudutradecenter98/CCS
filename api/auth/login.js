import { collection, getData, readBody, send, checkPassword, hashPassword, issueSession, safeUser } from '../../lib/server.js';
export default async function handler(req,res) {
  if(req.method!=='POST') return send(res,405,{error:'Method not allowed.'});
  try {
    const {username,password}=await readBody(req);
    if(!username || !password) return send(res,400,{error:'Username and password are required.'});
    const col=await collection(); const data=await getData(col);
    const user=(data.users||[]).find(u=>String(u.username||'').toLowerCase()===String(username).trim().toLowerCase() && u.active!==false);
    if(!user || !(await checkPassword(password,user))) return send(res,401,{error:'Invalid username or password.'});
    if(!user.passwordHash) { user.passwordHash=await hashPassword(user.password); delete user.password; await col.updateOne({_id:'main'},{$set:{data}}); }
    await issueSession(res,user);
    return send(res,200,{user:safeUser(user)});
  } catch(e) { console.error(e); return send(res,500,{error:'Login service is unavailable. Check server environment settings.'}); }
}
