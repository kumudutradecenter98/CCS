import fs from 'node:fs/promises';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

const input = process.argv[2] || './database.json';
if (!process.env.mongodb+srv://CCS:CCS123@ccs.vfz9jeq.mongodb.net/?appName=CCS) throw new Error('Set mongodb+srv://CCS:CCS123@ccs.vfz9jeq.mongodb.net/?appName=CCS before importing.');
const parsed = JSON.parse(await fs.readFile(input, 'utf8'));
for (const key of ['users','departures','visits','audit']) if (!Array.isArray(parsed[key])) parsed[key]=[];
if (!Array.isArray(parsed.deletedRecords)) parsed.deletedRecords=[];
if (!parsed.users.some(u=>u.role==='Admin')) throw new Error('database.json must contain an Admin user before import.');
for (const u of parsed.users) {
  if (u.passwordHash) { delete u.password; continue; }
  if (typeof u.password !== 'string' || !u.password) throw new Error(`User ${u.username||u.id} has no password to hash.`);
  u.passwordHash = await bcrypt.hash(u.password,12); delete u.password;
}
const client = new MongoClient(process.env.mongodb+srv://CCS:CCS123@ccs.vfz9jeq.mongodb.net/?appName=CCS);
try {
  await client.connect();
  const db=client.db(process.env.MONGODB_DB || 'customer_collection_system');
  await db.collection('system').updateOne({_id:'main'},{$set:{data:parsed,updatedAt:new Date(),updatedBy:'migration-script'}},{upsert:true});
  console.log(`Imported ${parsed.users.length} users, ${parsed.visits.length} visits, ${parsed.departures.length} departures and ${parsed.audit.length} audit entries.`);
  console.log('Passwords have been stored as bcrypt hashes. Keep the original database.json as a private backup until verified.');
} finally { await client.close(); }
