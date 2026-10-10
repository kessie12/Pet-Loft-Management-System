import type { Env } from './platform';
import { HttpError, requireValue } from './platform';
import { initialSystemConfig, initialRooms, initialServices } from '../src/data/seedData';
import { defaultGroomingPricing, defaultReceiptConfig } from '../src/lib/pricing';
import { passwordHash, AccountRow, Actor, requireBoss, publicAccount } from './auth';
import type { SystemConfig, Room, ServiceItem } from '../src/types';
export interface Settings { config:SystemConfig; rooms:Room[]; services:ServiceItem[]; revision:number }
interface SettingsRow { config_json:string;rooms_json:string;services_json:string;revision:number }
export const initialize = async(env:Env) => {
  requireValue(env.DB,'Bind the D1 database in Cloudflare.',503);
  const row=await env.DB.prepare('SELECT id FROM app_settings WHERE id=1').first();
  if(!row){const config=structuredClone(initialSystemConfig);config.staffCredentials={username:'staff'};config.bossCredentials={username:env.INITIAL_BOSS_USERNAME||'admin'};config.groomingPricing=defaultGroomingPricing;config.receiptConfig=defaultReceiptConfig;
    if(env.GOOGLE_SHEET_ID)config.directGoogleSheetUrl=`https://docs.google.com/spreadsheets/d/${env.GOOGLE_SHEET_ID}/edit`;
    await env.DB.prepare('INSERT INTO app_settings(id,config_json,rooms_json,services_json,revision) VALUES(1,?,?,?,1) ON CONFLICT(id) DO NOTHING').bind(JSON.stringify(config),JSON.stringify(initialRooms),JSON.stringify(initialServices)).run();
  }
  const boss=await env.DB.prepare("SELECT id FROM app_accounts WHERE role='Boss' AND active=1 LIMIT 1").first();
  if(!boss){requireValue(env.INITIAL_BOSS_PASSWORD,'Set INITIAL_BOSS_PASSWORD in Cloudflare secrets for the first boss login.',503);
    await env.DB.prepare("INSERT INTO app_accounts(id,username,name,role,password_hash) VALUES('boss-master',?,?,'Boss',?) ON CONFLICT(id) DO NOTHING").bind(env.INITIAL_BOSS_USERNAME||'admin','Boss',await passwordHash(env.INITIAL_BOSS_PASSWORD,env)).run();
  }
};
export const loadSettings=async(env:Env):Promise<Settings>=>{
  const row=await env.DB.prepare('SELECT * FROM app_settings WHERE id=1').first<SettingsRow>();
  if(!row)throw new HttpError(503,'Initialize the shop settings first.');
  return {config:JSON.parse(row.config_json),rooms:JSON.parse(row.rooms_json),services:JSON.parse(row.services_json),revision:row.revision};
};
export const clientConfig=(settings:Settings,actor:Actor|null):SystemConfig=>{
  const config=structuredClone(settings.config);config.staffCredentials={username:config.staffCredentials.username};config.bossCredentials={username:config.bossCredentials.username};
  if(actor?.role==='Staff')config.staffCanManageCredit=actor.canManageCredit;
  if(!actor){config.directGoogleSheetUrl=undefined;config.roomAssignmentRules=[];config.staffCanManageCredit=false;config.staffCredentials={username:''};config.bossCredentials={username:''};}
  return config;
};
export const listAccounts=async(env:Env)=>(await env.DB.prepare('SELECT * FROM app_accounts ORDER BY name').all<AccountRow>()).results.map(publicAccount);
export const validateSettings=(next:Settings)=>{
  const forbidden=['__proto__','prototype','constructor'];const check=(value:unknown,path:string)=>{
    if(typeof value==='number'&&(!Number.isFinite(value)||value<0))throw new HttpError(400,`${path} must be zero or greater.`);
    if(Array.isArray(value))value.forEach((v,i)=>check(v,`${path}[${i}]`));
    else if(value&&typeof value==='object')for(const [key,v] of Object.entries(value)){requireValue(!forbidden.includes(key),'Invalid setting key.');check(v,path?path+'.'+key:key);}
  };check(next.config,'settings');
  const types=next.config.customerBoardingRooms||[];
  requireValue(new Set(types.map(t=>t.species+':'+t.id)).size===types.length,'Room-type IDs must be unique within each species.');
  for(const type of types)requireValue(type.id&&type.title&&['Dog','Cat'].includes(type.species)&&Number.isInteger(type.capacity)&&type.capacity>=1&&type.capacity<=30&&Number.isFinite(type.price)&&type.price>=0&&Number.isFinite(type.extraPetPrice)&&type.extraPetPrice>=0,'Each room type needs a title, valid price and capacity from 1 to 30.');
  requireValue(new Set(next.rooms.map(r=>r.roomNumber)).size===next.rooms.length&&new Set(next.rooms.map(r=>r.id)).size===next.rooms.length,'Kennel IDs and numbers must be unique.');
  for(const room of next.rooms)requireValue(room.id&&/^[A-Za-z0-9-]{1,30}$/.test(room.roomNumber)&&['available','cleaning'].includes(room.status)&&types.some(t=>t.id===room.category&&t.species===room.species),'Each kennel needs an existing room type and Available/Cleaning status. Occupancy is calculated from bookings.');
  for(const rule of next.config.roomAssignmentRules||[])requireValue(Number.isInteger(rule.maxPetsPerRoom)&&rule.maxPetsPerRoom>=1&&rule.maxPetsPerRoom<=30&&rule.preferredRooms.every(number=>next.rooms.some(r=>r.roomNumber===number&&r.species===rule.species)),'Room rules must refer to existing kennels of the same species.');
  const receipt=next.config.receiptConfig||defaultReceiptConfig;
  for(const prefix of [receipt.invoicePrefix,receipt.depositPrefix,receipt.finalPrefix])requireValue(/^[A-Za-z0-9-]{1,16}$/.test(prefix),'Document prefixes must contain 1–16 letters, digits or hyphens.');
  requireValue(['standard','compact'].includes(receipt.layout),'Choose a receipt layout.');
  const grooming=next.config.groomingPricing||defaultGroomingPricing;
  for(const key of ['shortCoat','longCoat','doubleCoat','shavedDown','summerCut','pantsCut','handCut','extraWeight'] as const)requireValue(grooming[key].length===5,'Grooming prices need five weight tiers.');
  requireValue(new Set(grooming.addons.map(a=>a.name)).size===grooming.addons.length,'Grooming add-on names must be unique.');
  requireValue(next.config.depositConfig.percentageRate<=1,'Deposit percentage must be from 0% to 100%.');
  requireValue(Number.isInteger(next.config.groomingCapacity.maxDogsPerDay)&&next.config.groomingCapacity.maxDogsPerDay>=1,'Set a positive daily grooming capacity.');
};
export const saveSettings=async(env:Env,next:Settings,expected:number)=>{
  validateSettings(next);
  const result=await env.DB.prepare('UPDATE app_settings SET config_json=?,rooms_json=?,services_json=?,revision=revision+1 WHERE id=1 AND revision=?').bind(JSON.stringify(next.config),JSON.stringify(next.rooms),JSON.stringify(next.services),expected).run();
  if(!result.meta.changes)throw new HttpError(409,'Settings changed on another device. Refresh and apply your change again.');
};
export const saveAccount=async(env:Env,actor:Actor|null,data:{id?:string;name:string;username:string;role:'Boss'|'Staff';phone?:string;active:boolean;canManageCredit?:boolean;password?:string})=>{
  requireBoss(actor);requireValue(data.name?.trim()&&/^[a-zA-Z0-9_.@-]{3,80}$/.test(data.username||''),'Enter a name and a username of 3–80 letters, digits or . _ @ - .');
  requireValue(['Boss','Staff'].includes(data.role),'Choose Boss or Staff.');
  requireValue(typeof data.active==='boolean'&&(data.canManageCredit===undefined||typeof data.canManageCredit==='boolean'),'Invalid account permissions.');
  const existing=data.id?await env.DB.prepare('SELECT * FROM app_accounts WHERE id=?').bind(data.id).first<AccountRow>():null;
  requireValue(!data.id||existing,'Account not found.',404);
  if(existing?.role==='Boss'&&(data.role!=='Boss'||!data.active)){const count=await env.DB.prepare("SELECT count(*) AS count FROM app_accounts WHERE role='Boss' AND active=1 AND id<>?").bind(existing.id).first<{count:number}>();requireValue(count&&count.count>0,'Keep at least one active boss account.');}
  requireValue(existing||data.password,'Set a password for the new account.');
  const hash=data.password?await passwordHash(data.password,env):existing!.password_hash;
  const access=data.canManageCredit===undefined?null:Number(data.canManageCredit);
  const id=existing?.id||'staff-'+crypto.randomUUID();
  try{await env.DB.prepare('INSERT INTO app_accounts(id,username,name,role,phone,active,credit_access,password_hash) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username,name=excluded.name,role=excluded.role,phone=excluded.phone,active=excluded.active,credit_access=excluded.credit_access,password_hash=excluded.password_hash,auth_version=auth_version+1').bind(id,data.username.trim(),data.name.trim(),data.role,data.phone||'',Number(data.active),access,hash).run();}catch(error){if(String(error).includes('UNIQUE'))throw new HttpError(400,'This login username is already in use.');throw error;}
  return id;
};
