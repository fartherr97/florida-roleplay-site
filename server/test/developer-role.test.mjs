import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { permissionsFor } from '../src/permissions.js';
let rows = [{ role_key: 'member' }];
mock.module('../src/db.js', { namedExports: {
  query: async () => { if (rows === null) throw new Error('offline'); return rows; },
  execute: async () => {},
} });
const { resolveRoleKeys } = await import('../src/lib/roleSync.js');
test('confirmed Developer ID resolves alongside old database mappings and revokes without the role', async () => {
  for (const stored of [[{role_key:'member'}], [], null]) {
    rows = stored;
    const roles = await resolveRoleKeys(['1542499913957376140']);
    assert(roles.includes('developer'));
    assert(permissionsFor(roles).has('development.assignments.view'));
    assert(!permissionsFor(roles).has('development.claims.manage'));
    assert(!(await resolveRoleKeys(['1542499913957376141'])).includes('developer'));
    assert(!(await resolveRoleKeys([])).includes('developer'));
  }
});
