import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const script = await readFile(new URL('../content.js', import.meta.url), 'utf8');

function loadContentScript(pathname) {
  const redirects = [];
  const classes = [];
  const listeners = new Map();
  const location = { pathname, replace(url) { redirects.push(url); } };
  vm.runInNewContext(script, {
    window: { location },
    document: {
      documentElement: { classList: { add(name) { classes.push(name); } } },
      addEventListener(event, listener) { listeners.set(event, listener); }
    }
  });
  return { location, redirects, classes, listeners };
}

test('opening the homepage replaces it with Subscriptions and keeps hiding enabled', () => {
  const { redirects, classes } = loadContentScript('/');
  assert.deepEqual(redirects, ['https://www.youtube.com/feed/subscriptions']);
  assert.deepEqual(classes, ['remove-youtube-shorts']);
});

test('leaves subscriptions, videos, search and channel pages unchanged', () => {
  for (const path of ['/feed/subscriptions', '/watch', '/results', '/@channel', '/shorts/123', '/playables']) {
    assert.deepEqual(loadContentScript(path).redirects, [], path);
  }
});

test('redirects internal Home navigation but not other internal navigation', () => {
  const { location, redirects, listeners } = loadContentScript('/watch');
  const navigate = listeners.get('yt-navigate-finish');
  location.pathname = '/feed/subscriptions';
  navigate();
  assert.deepEqual(redirects, []);
  location.pathname = '/';
  navigate();
  assert.deepEqual(redirects, ['https://www.youtube.com/feed/subscriptions']);
});
