import { MongoClient } from 'mongodb';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

let clientPromise;
export async function collection() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured in Vercel environment variables.');
  if (!clientPromise) { const c = new MongoClient(process.env.MONGODB_URI); clientPromise = c.connect(); }
  const c = await clientPromise;
  const db = c.db(process.env.MONGODB_DB || 'customer_collection_system');
  return db.collection('system');
}
export function send(res, status, body) { res.status(status); res.setHeader('Content-Type','application/json; charset=utf-8'); return res.json(body); }
export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let s=''; for await (const chunk of req) s += chunk;
  try { return JSON.parse(s || '{}'); } catch { return {}; }
}
function secret() { if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET must be a random string of at least 32 characters.'); return new TextEncoder().encode(process.env.SESSION_SECRET); }
export async function issueSession(res, user) {
  const token = await new SignJWT({ sub: String(user.id), role: user.role, username: user.username })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('12h').sign(secret());
  res.setHeader('Set-Cookie', `ccs_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200`);
}
export async function requireUser(req, res) {
  const cookie = req.headers.cookie || '';
  const token = cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith('ccs_session='))?.slice('ccs_session='.length);
  if (!token) { send(res,401,{error:'Please log in again.'}); return null; }
  try {
    const { payload } = await jwtVerify(token, secret());
    const col = await collection(); const doc = await col.findOne({_id:'main'});
    const user = (doc?.data?.users || []).find(u => String(u.id) === String(payload.sub) && u.active !== false);
    if (!user) { send(res,401,{error:'Account is inactive or no longer exists.'}); return null; }
    return user;
  } catch { send(res,401,{error:'Session expired. Please log in again.'}); return null; }
}
export function safeUser(u) { const {password, passwordHash, ...safe} = u; return safe; }
export function safeData(data, user) {
  const copy = structuredClone(data || {});
  copy.users = (copy.users || []).filter(u => user.role === 'Admin' || String(u.id) === String(user.id)).map(safeUser);
  if (user.role !== 'Admin') {
    copy.departures = (copy.departures || []).filter(r => String(r.staffId) === String(user.id));
    copy.visits = (copy.visits || []).filter(r => String(r.staffId) === String(user.id));
    copy.audit = (copy.audit || []).filter(r => r.user === user.username || r.userId === user.id);
    copy.deletedRecords = (copy.deletedRecords || []).filter(r => String(r.staffId) === String(user.id) || r.user === user.username);
  }
  return copy;
}
export async function hashPassword(p) { return bcrypt.hash(String(p), 12); }
export async function checkPassword(p, u) {
  if (u.passwordHash) return bcrypt.compare(String(p), u.passwordHash);
  // Legacy plaintext is accepted only during the first migration/upgrade, then upgraded on login.
  return typeof u.password === 'string' && String(p) === u.password;
}
export async function getData(col) { const d=await col.findOne({_id:'main'}); return d?.data || {users:[],departures:[],visits:[],audit:[],deletedRecords:[]}; }
export async function saveData(col, data, actor) {
  const old = await getData(col);
  if (actor.role === 'Admin') {
    const oldUsers = old.users || [];
    const users = [];
    for (const incoming of (data.users || [])) {
      const prior = oldUsers.find(x => String(x.id) === String(incoming.id));
      const u = {...prior, ...incoming};
      if (incoming.password) { u.passwordHash = await hashPassword(incoming.password); delete u.password; }
      else if (prior?.passwordHash) { u.passwordHash = prior.passwordHash; delete u.password; }
      else if (prior?.password) { u.passwordHash = await hashPassword(prior.password); delete u.password; }
      users.push(u);
    }
    // Do not allow accidental removal of the last Admin account.
    if (!users.some(u=>u.role==='Admin')) throw new Error('At least one Admin account must remain.');
    const merged = {...old, ...data, users};
    await col.updateOne({_id:'main'},{$set:{data:merged,updatedAt:new Date(),updatedBy:actor.username}},{upsert:true});
    return;
  }
  const mergeOwn = (key) => {
    const existing = old[key] || []; const submitted = data[key] || [];
    const own = existing.filter(x => String(x.staffId) === String(actor.id));
    const other = existing.filter(x => String(x.staffId) !== String(actor.id));
    const sanitized = submitted.filter(x => String(x.staffId) === String(actor.id)).map(x=>({...x,staffId:actor.id}));
    const ownIds = new Set(own.map(x=>String(x.id)));
    const submittedIds = new Set(sanitized.map(x=>String(x.id)));
    const deleted = own.filter(x=>!submittedIds.has(String(x.id))).map(x=>({...x,isDeleted:true,deletedAt:new Date().toISOString(),deletedBy:actor.username}));
    return [...other, ...sanitized, ...deleted.filter(x=>!submittedIds.has(String(x.id)) && !sanitized.some(y=>String(y.id)===String(x.id)))];
  };
  const merged = {...old, departures:mergeOwn('departures'), visits:mergeOwn('visits')};
  const me = (old.users || []).find(x=>String(x.id)===String(actor.id));
  merged.users = (old.users || []).map(x=>String(x.id)===String(actor.id) ? {...x, passwordEnabled: (data.users||[]).find(y=>String(y.id)===String(actor.id))?.passwordEnabled ?? x.passwordEnabled} : x);
  const auditOther = (old.audit||[]).filter(x=>x.user!==actor.username && x.userId!==actor.id);
  const auditMine = (data.audit||[]).filter(x=>x.user===actor.username || x.userId===actor.id);
  merged.audit = [...auditOther, ...auditMine];
  await col.updateOne({_id:'main'},{$set:{data:merged,updatedAt:new Date(),updatedBy:actor.username}},{upsert:true});
}
