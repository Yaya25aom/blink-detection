import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../extension/src/content/authBridge.ts', import.meta.url), 'utf8');
const bridge = source.slice(source.indexOf('let liveStatus:'), source.indexOf('\nwindow.addEventListener("blinkcare:extension-command"'));
const { outputText } = ts.transpileModule(bridge, { compilerOptions: { target: ts.ScriptTarget.ES2022 } });
const flush = () => new Promise(resolve => setImmediate(resolve));

async function setup() {
  const requests = [], published = [];
  let changed, poll;
  vm.runInNewContext(outputText, {
    chrome: {
      runtime: { sendMessage: () => new Promise(resolve => requests.push(resolve)) },
      storage: { onChanged: { addListener: listener => { changed = listener; } } },
    },
    window: { dispatchEvent() {}, postMessage: message => published.push(message.payload) },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    setInterval: callback => { poll = callback; },
  });
  requests.shift()({ ok: true, sessionId: 'one', monitoring: true, blinkCount: 0 });
  await flush();
  return { requests, published, changed, poll };
}

test('pushed counts reach the page synchronously without another status request', async () => {
  const { changed, published, requests } = await setup();
  changed({ blinkCount: { newValue: 1 } }, 'local');
  assert.equal(published.at(-1).blinkCount, 1);
  assert.equal(requests.length, 0);
});

test('an old polling response cannot overwrite a newer pushed count', async () => {
  const { changed, published, requests, poll } = await setup();
  poll();
  changed({ blinkCount: { newValue: 2 } }, 'local');
  requests.shift()({ ok: true, sessionId: 'one', blinkCount: 0 });
  await flush();
  assert.equal(published.at(-1).blinkCount, 2);
});

test('a session change refreshes identity before publishing new totals', async () => {
  const { changed, published, requests } = await setup();
  changed({ blinkcareSessionId: { newValue: 'two' }, blinkCount: { newValue: 0 } }, 'local');
  assert.equal(requests.length, 1);
  requests.shift()({ ok: true, sessionId: 'two', monitoring: true, blinkCount: 0 });
  await flush();
  assert.equal(published.at(-1).sessionId, 'two');
});
