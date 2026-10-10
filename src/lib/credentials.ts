import type { CredentialHash, SystemConfig } from '../types';

const iterations = 600_000;
const toHex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
const fromHex = (value: string) => new Uint8Array(value.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
const derive = async (password: string, salt: string, rounds: number) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(salt), iterations: rounds }, key, 256);
  return toHex(new Uint8Array(bits));
};
export const hashCredential = async (password: string): Promise<CredentialHash> => {
  if (!password) throw new Error('A password or PIN cannot be empty.');
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  return { algorithm: 'PBKDF2-SHA256', iterations, salt, digest: await derive(password, salt, iterations) };
};
export const verifyCredential = async (password: string, stored?: CredentialHash): Promise<boolean> => {
  if (!stored || stored.algorithm !== 'PBKDF2-SHA256' || stored.iterations !== iterations ||
      !/^[a-f0-9]{32}$/.test(stored.salt) || !/^[a-f0-9]{64}$/.test(stored.digest)) return false;
  const actual = await derive(password, stored.salt, stored.iterations);
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ stored.digest.charCodeAt(i);
  return difference === 0;
};
export const migrateCredentials = async (config: SystemConfig): Promise<SystemConfig> => {
  const staff = config.staffCredentials;
  const boss = config.bossCredentials;
  return { ...config,
    staffCredentials: { username: staff.username, passwordHash: staff.passwordHash || await hashCredential(staff.pin || '') },
    bossCredentials: { username: boss.username, passwordHash: boss.passwordHash || await hashCredential(boss.password || '') },
  };
};
