import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWebsite, blockWebsite, listWebsites, unblockWebsite } from '../website-blocking.mjs';

function mockApi() {
  let rules = [];
  return {
    async getDynamicRules() { return structuredClone(rules); },
    async updateDynamicRules({ addRules = [], removeRuleIds = [] }) {
      rules = rules.filter(rule => !removeRuleIds.includes(rule.id)).concat(addRules);
    }
  };
}

test('normalizes domains and full URLs, including international domains', () => {
  for (const value of ['example.com', ' WWW.Example.COM ', 'http://example.com:8080/', 'example.com.']) {
    assert.equal(normalizeWebsite(value), 'example.com');
  }
  assert.equal(normalizeWebsite('news.example.com'), 'news.example.com');
  assert.equal(normalizeWebsite('https://bücher.de'), 'xn--bcher-kva.de');
  assert.equal(normalizeWebsite('localhost'), 'localhost');
  assert.equal(normalizeWebsite('127.0.0.1'), '127.0.0.1');
  assert.equal(normalizeWebsite('https://www.example.com/watch?v=1'), 'example.com/watch');
});

test('rejects invalid websites, unsupported schemes, wildcards and credentials', () => {
  for (const value of ['', ' ', 'not a website', '*.example.com', '-example.com', 'example..com', 'https://', 'ftp://example.com', 'file:///tmp/test', 'https://user:password@example.com', 'https://example_com']) {
    assert.throws(() => normalizeWebsite(value), Error, value);
  }
});

test('adds persistent main-frame rules and rejects duplicate domains', async () => {
  const api = mockApi();
  assert.equal(await blockWebsite('https://www.example.com/', api), 'example.com');
  assert.deepEqual(await api.getDynamicRules(), [{
    id: 1,
    priority: 1,
    action: { type: 'block' },
    condition: { requestDomains: ['example.com'], resourceTypes: ['main_frame'] }
  }]);
  await assert.rejects(blockWebsite('example.com', api), /already blocked/);
  assert.deepEqual(await listWebsites(api), [{ id: 1, domain: 'example.com' }]);
});

test('preserves path patterns and limits blocking to matching URLs', async () => {
  const api = mockApi();
  assert.equal(await blockWebsite('https://www.youtube.com/shorts/*', api), 'youtube.com/shorts/*');
  const [rule] = await api.getDynamicRules();
  assert.deepEqual(rule.condition, {
    requestDomains: ['youtube.com'],
    resourceTypes: ['main_frame'],
    urlFilter: '||youtube.com/shorts/*',
    isUrlFilterCaseSensitive: true
  });
  assert.deepEqual(await listWebsites(api), [{ id: 1, domain: 'youtube.com/shorts/*' }]);
  // A domain-wide rule remains a distinct entry, not a duplicate of a path rule.
  await blockWebsite('youtube.com', api);
  assert.equal((await listWebsites(api)).length, 2);
  await assert.rejects(blockWebsite('youtube.com/shorts/*', api), /already blocked/);
  await unblockWebsite(rule.id, api);
  assert.deepEqual(await listWebsites(api), [{ id: 2, domain: 'youtube.com' }]);
});

test('keeps path case and wildcards without interpreting filter operators', () => {
  assert.equal(normalizeWebsite('example.com/Some/Path/*?query=ignored#fragment'), 'example.com/Some/Path/*');
  assert.throws(() => normalizeWebsite('example.com/path|other'));
  assert.throws(() => normalizeWebsite('example.com/path^other'));
});

test('lists alphabetically, removes only the selected site and safely reuses IDs', async () => {
  const api = mockApi();
  await blockWebsite('z.example', api);
  await blockWebsite('a.example', api);
  assert.deepEqual(await listWebsites(api), [
    { id: 2, domain: 'a.example' }, { id: 1, domain: 'z.example' }
  ]);
  await unblockWebsite(1, api);
  await blockWebsite('b.example', api);
  assert.deepEqual(await listWebsites(api), [
    { id: 2, domain: 'a.example' }, { id: 1, domain: 'b.example' }
  ]);
});

test('reports API errors rather than claiming a website was saved', async () => {
  const api = mockApi();
  api.updateDynamicRules = async () => { throw new Error('Rule limit reached'); };
  await assert.rejects(blockWebsite('example.com', api), /Rule limit reached/);
  assert.deepEqual(await listWebsites(api), []);
});
