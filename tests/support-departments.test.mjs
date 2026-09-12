import test from 'node:test';
import assert from 'node:assert/strict';
import * as client from '../client/src/lib/support.js';
import * as server from '../server/src/lib/support.js';

test('department grouping preserves legacy IDs and explicit community placement', () => {
  const raw = [...client.DEFAULT_TICKET_TYPES, {id:'custom', label:'Recruitment', department:'mpd'}, {id:'dept_fhp', label:'Moved', department:''}];
  for (const type of raw) {
    assert.deepEqual(client.normalizeTicketType(type), server.normalizeTicketType(type));
  }
  assert.equal(server.normalizeTicketType({id:'dept_bso'}).department, 'bso');
  assert.equal(server.normalizeTicketType({id:'dept_fhp', department:''}).department, '');
  assert.equal(server.normalizeTicketType({id:'custom', department:'invalid'}).department, '');
});

test('confidential queue grants do not inherit general or department access', () => {
  const type = server.normalizeTicketType({id:'ia', department:'mpd', exclusive:true, workPermissions:['support.escalated']});
  assert.equal(server.canWorkType(type, ['support.work', 'support.manage', 'support.mpd']), false);
  assert.equal(server.canWorkType(type, ['support.escalated']), true);
  assert.equal(server.canOpenType(type, []), true);
  assert.equal(server.canOpenType({...type, enabled:false}, []), false);
});
