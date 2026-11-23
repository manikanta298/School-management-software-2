import test from 'node:test';
import assert from 'node:assert/strict';
import { getForwardedClientIp } from '../src/middleware/rate-limit-key.js';

function request(forwarded, ip = '127.0.0.1') {
  return {
    ip,
    get(name) {
      return name.toLowerCase() === 'forwarded' ? forwarded : undefined;
    }
  };
}

test('uses Express-resolved IP when Forwarded is not trusted', () => {
  assert.equal(getForwardedClientIp(request('for=198.51.100.4'), 0), '127.0.0.1');
});

test('uses a valid client address from a trusted Forwarded chain', () => {
  assert.equal(getForwardedClientIp(request('for=198.51.100.4;proto=https', 1), 1), '198.51.100.4');
});

test('supports quoted IPv6 Forwarded addresses', () => {
  assert.equal(getForwardedClientIp(request('for="[2001:db8::1]"'), 1), '2001:db8::1');
});

test('selects the address at the configured trusted proxy boundary', () => {
  assert.equal(
    getForwardedClientIp(request('for=198.51.100.4, for=203.0.113.8'), 2),
    '198.51.100.4'
  );
});

test('falls back to Express IP for missing, malformed, or short chains', () => {
  assert.equal(getForwardedClientIp(request(undefined), 1), '127.0.0.1');
  assert.equal(getForwardedClientIp(request('for=_hidden'), 1), '127.0.0.1');
  assert.equal(getForwardedClientIp(request('for=not-an-ip'), 1), '127.0.0.1');
  assert.equal(getForwardedClientIp(request('for=198.51.100.4'), 2), '127.0.0.1');
});

test('falls back for an invalid trust-proxy hop configuration', () => {
  assert.equal(getForwardedClientIp(request('for=198.51.100.4'), -1), '127.0.0.1');
  assert.equal(getForwardedClientIp(request('for=198.51.100.4'), 1.5), '127.0.0.1');
});
