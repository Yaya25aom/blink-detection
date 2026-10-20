import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const source = readFileSync(new URL('../extension/src/detection/cameraFrames.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { startCameraFrames } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const flush = () => new Promise(resolve => setImmediate(resolve));

function setup() {
  let controller, options, trackStopped = false;
  const track = { stop() { trackStopped = true; } };
  globalThis.MediaStreamTrackProcessor = class {
    constructor(value) {
      options = value;
      this.readable = new ReadableStream({ start(value) { controller = value; } });
    }
  };
  const video = { srcObject: { getVideoTracks: () => [{ clone: () => track }] } };
  return { video, push: frame => controller.enqueue(frame), options: () => options,
    stopped: () => trackStopped };
}

test('direct frames run serially with a one-frame buffer and close after inference', async () => {
  const fixture = setup();
  let release, started = 0, closed = 0;
  const errors = [];
  const stop = startCameraFrames(fixture.video, async () => {
    started++;
    if (started === 1) await new Promise(resolve => { release = resolve; });
  }, error => errors.push(error));
  fixture.push({ close() { closed++; } });
  await flush();
  fixture.push({ close() { closed++; } });
  await flush();
  assert.equal(started, 1);
  assert.equal(closed, 0);
  assert.equal(fixture.options().maxBufferSize, 1);
  release();
  await flush();
  assert.equal(started, 2);
  assert.equal(closed, 2);
  stop();
  await flush();
  assert.equal(fixture.stopped(), true);
  assert.deepEqual(errors, []);
});

test('inference errors release the frame and stop the cloned track', async () => {
  const fixture = setup();
  let closed = 0;
  const failure = new Error('inference failed');
  const errors = [];
  startCameraFrames(fixture.video, async () => { throw failure; }, error => errors.push(error));
  fixture.push({ close() { closed++; } });
  await flush();
  assert.equal(closed, 1);
  assert.equal(fixture.stopped(), true);
  assert.deepEqual(errors, [failure]);
});

test('stopping while waiting for a camera frame does not invoke detection', async () => {
  const fixture = setup();
  let called = false;
  const errors = [];
  const stop = startCameraFrames(fixture.video, async () => { called = true; }, error => errors.push(error));
  stop();
  await flush();
  assert.equal(called, false);
  assert.deepEqual(errors, []);
});
