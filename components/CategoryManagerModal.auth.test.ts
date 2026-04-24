import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./CategoryManagerModal.tsx', import.meta.url), 'utf8');

test('category manager edit does not require a second password prompt', () => {
  assert.equal(source.includes('CategoryActionAuthModal'), false);
  assert.equal(source.includes('onVerifyPassword'), false);
});
