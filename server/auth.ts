import type { Env } from './platform';
import { digest, HttpError, requireValue } from './platform';
import { hashCredential, verifyCredential } from '../src/lib/credentials';
import type { StaffAccount, CredentialHash } from '../src/types';
export interface AccountRow { id:string; username:string; name:string; role:'Boss'|'Staff'; phone:string; active:number; credit_access:number|null; password_hash:string; auth_version:number }
export interface Actor { id:string; name:string; role:'Boss'|'Staff'; canManageCredit:boolean; username:string }
const pepperPassword = async (password:string,env:Env) => {
  requireValue(env.AUTH_PEPPER && env.AUTH_PEPPER.length>=32,'Configure the server AUTH_PEPPER secret.',503);
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.AUTH_PEPPER),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(password))),x=>x.toString(16).padStart(2,'0')).join('');
};
export const passwordHash = async (password:string,env:Env) => {
  requireValue(typeof password==='string' && password.length>=12 && password.length<=256,'Use a password with 12–256 characters.');
  return JSON.stringify(await hashCredential(await pepperPassword(password,env)));
};
export const publicAccount = (row:AccountRow): StaffAccount => ({id:row.id,name:row.name,username:row.username,role:row.role,phone:row.phone,active:row.active===1,...(row.credit_access===null?{}:{canManageCredit:row.credit_access===1})});
export const rateLimit = async (env:Env,key:string,max:number,seconds=60) => {
  const start=Math.floor(Date.now()/1000/seconds)*seconds;
  const row=await env.DB.prepare('INSERT INTO app_rate_limits(key,window_start,count) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window_start=excluded.window_start THEN count+1 ELSE 1 END,window_start=excluded.window_start RETURNING count').bind(key,start).first<{count:number}>();
  if (!row || row.count>max) throw new HttpError(429,'Too many requests. Please wait before trying again.');
};
export const requestActor = async (request:Request,env:Env,staffCreditAccess:boolean):Promise<Actor|null> => {
  const token=request.headers.get('Cookie')?.match(/(?:^|;\s*)mpl_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if(!token)return null;
  const row=await env.DB.prepare('SELECT a.* FROM app_sessions s JOIN app_accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>? AND s.auth_version=a.auth_version AND a.active=1').bind(await digest(token),Date.now()).first<AccountRow>();
  return row?{id:row.id,name:row.name,username:row.username,role:row.role,canManageCredit:row.role==='Boss'||(row.credit_access===null?staffCreditAccess:row.credit_access===1)}:null;
};
export const cookie = (request:Request,token:string,maxAge:number) => `mpl_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(request.url).protocol==='https:'?'; Secure':''}`;
export const login = async (request:Request,env:Env,input:{username:string;password:string;portal:string}) => {
  await rateLimit(env,'login:'+await digest(request.headers.get('CF-Connecting-IP')||'local'),8,900);
  requireValue(typeof input.username==='string' && typeof input.password==='string' && input.username.length<=80 && input.password.length<=256,'Invalid login.');
  const row=await env.DB.prepare('SELECT * FROM app_accounts WHERE username=? COLLATE NOCASE AND active=1').bind(input.username.trim()).first<AccountRow>();
  const dummy:CredentialHash={algorithm:'PBKDF2-SHA256',iterations:600000,salt:'00000000000000000000000000000000',digest:'0000000000000000000000000000000000000000000000000000000000000000'};
  const valid=await verifyCredential(await pepperPassword(input.password,env),row?JSON.parse(row.password_hash):dummy);
  if(!row || !valid || (input.portal==='boss'&&row.role!=='Boss'))throw new HttpError(401,'Invalid username or password.');
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
  await env.DB.prepare('INSERT INTO app_sessions(token_hash,account_id,auth_version,expires_at) VALUES(?,?,?,?)').bind(await digest(token),row.id,row.auth_version,Date.now()+8*3600000).run();
  await env.DB.prepare('DELETE FROM app_sessions WHERE expires_at<?').bind(Date.now()).run();
  return {account:publicAccount(row),cookie:cookie(request,token,8*3600)};
};
export const logout = async (request:Request,env:Env) => {
  const token=request.headers.get('Cookie')?.match(/(?:^|;\s*)mpl_session=([a-f0-9]{64})/)?.[1];
  if(token)await env.DB.prepare('DELETE FROM app_sessions WHERE token_hash=?').bind(await digest(token)).run();
  return cookie(request,'',0);
};
export const requireBoss = (actor:Actor|null) => { if(actor?.role!=='Boss')throw new HttpError(403,'Only the boss can change these settings.'); };
export const requireShop = (actor:Actor|null) => { if(!actor)throw new HttpError(401,'Log in to continue.'); };
