import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { permissionsFor } from '../src/permissions.js';
const db = new PGlite();
after(() => db.close());
await db.exec(`CREATE TABLE users(id text PRIMARY KEY, display_name text, username text);
 CREATE TABLE dev_vehicles(id text PRIMARY KEY, name text, year text, make text, model text, spawn_code text, library text, liveries text, resource text);
 CREATE TABLE dev_vehicle_claims(id text, vehicle_id text, discord_id text, member_name text, status text, request_id text, decided_at timestamptz, decided_by_name text);
 INSERT INTO users VALUES ('123', 'Current name', 'username');
 INSERT INTO dev_vehicles(id,name,spawn_code) VALUES('car','2024 Test Car','testcar');
 INSERT INTO dev_vehicle_claims(id,vehicle_id,discord_id,member_name,status) VALUES
 ('active','car','123','Old name','active'), ('pending','car','456','Pending user','pending'),
 ('released','car','789','Released user','released'), ('denied','car','000','Denied user','denied');`);
mock.module('../src/db.js', { namedExports: { query: async (sql, args) => (await db.query(sql, args)).rows } });
const { vehicleAssignments } = await import('../src/lib/vehicleAssignments.js');
test('assignment grants exclude unrelated staff and department heads', () => {
 for (const role of ['developer','directorship','ownership']) assert(permissionsFor([role]).has('development.assignments.view'));
 for (const role of ['member','admin','head_admin','fhp_colonel','bso_sheriff','mpd_chief']) assert(!permissionsFor([role]).has('development.assignments.view'));
});
test('only active assignments are returned, with literal search and pagination', async () => {
 const result = await vehicleAssignments();
 assert.equal(result.total, 1); assert.equal(result.assignments[0].memberName, 'Current name');
 for (const term of ['current', '123', 'testcar', '2024']) assert.equal((await vehicleAssignments(term)).total, 1);
 for (const term of ['Pending user', '%', "' OR true--"]) assert.equal((await vehicleAssignments(term)).total, 0);
 assert.equal((await vehicleAssignments('', 2)).assignments.length, 0);
 assert.equal((await vehicleAssignments('', -4)).page, 1);
 await db.exec("UPDATE dev_vehicle_claims SET status='pending' WHERE id='active'");
 assert.equal((await vehicleAssignments()).total, 0);
});
