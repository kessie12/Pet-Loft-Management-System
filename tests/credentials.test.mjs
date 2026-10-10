import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/credentials.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {hashCredential,verifyCredential,migrateCredentials}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('salted hashes verify the correct secret and reject wrong or damaged hashes',async()=>{
 const hash=await hashCredential('example-secret');
 assert.equal(await verifyCredential('example-secret',hash),true);
 assert.equal(await verifyCredential('wrong',hash),false);
 assert.equal(await verifyCredential('example-secret',{...hash,digest:'invalid'}),false);
 assert.equal(await verifyCredential('example-secret',{...hash,iterations:1}),false);
 assert.equal(JSON.stringify(hash).includes('example-secret'),false);
 assert.notEqual((await hashCredential('example-secret')).salt,hash.salt);
 await assert.rejects(hashCredential(''));
});
test('legacy credentials migrate without retaining plaintext or resetting usernames',async()=>{
 const original={staffCredentials:{username:'shop-staff',pin:'legacy-pin'},bossCredentials:{username:'shop-boss',password:'legacy-password'}};
 const migrated=await migrateCredentials(original);
 assert.equal(migrated.staffCredentials.username,'shop-staff');
 assert.equal('pin' in migrated.staffCredentials,false);assert.equal('password' in migrated.bossCredentials,false);
 assert.equal(await verifyCredential('legacy-password',migrated.bossCredentials.passwordHash),true);
 assert.deepEqual(await migrateCredentials(migrated),migrated);
 assert.equal(original.bossCredentials.password,'legacy-password');
});
