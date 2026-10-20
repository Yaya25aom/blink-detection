import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../extension/src/detection/blinkDetector.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { BlinkDetector } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

function setup() {
  const detector = new BlinkDetector();
  let now = 1000;
  const face = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  face[10].y = 0.2;
  face[152].y = 0.8;
  face[33].x = 0.3;
  face[263].x = 0.7;
  const frame = (ear = 0.3, ms = 33) => detector.update(ear, now += ms, face);
  const frames = (ear, count) => { for (let i = 0; i < count; i++) frame(ear); };
  frames(0.3, 36);
  return { detector, face, frame, frames };
}

test('counts a normal blink immediately on reopening, including successive blinks', () => {
  const { detector, frames, frame } = setup();
  for (let count = 1; count <= 3; count++) {
    frames(0.18, 3);
    frame();
    assert.equal(detector.getBlinkCount(), count);
    frames(0.3, 5);
  }
});

test('rejects one-frame spikes and threshold chatter', () => {
  const { detector, frames, frame } = setup();
  for (let i = 0; i < 10; i++) { frame(0.18); frame(); }
  frames(0.25, 10);
  assert.equal(detector.getBlinkCount(), 0);
});

test('rejects a held closure', () => {
  const { detector, frames, frame } = setup();
  frames(0.18, 25);
  frame();
  assert.equal(detector.getBlinkCount(), 0);
});

test('looking down cancels a pending blink and requires open eyes on return', () => {
  const { detector, face, frames, frame } = setup();
  frames(0.18, 2);
  face[152].z = 0.18;
  for (let i = 0; i < 20; i++) { frames(0.18, 3); frames(0.3, 5); }
  face[152].z = 0;
  frames(0.18, 3);
  frame();
  assert.equal(detector.getBlinkCount(), 0);
  frames(0.3, 5);
  frames(0.18, 3);
  frame();
  assert.equal(detector.getBlinkCount(), 1);
});

test('missing face, invalid EAR, pause, and frame gaps cannot complete a blink', () => {
  for (const interrupt of [d => d.interrupt(), (_d, frame) => frame(NaN),
    (_d, frame) => frame(0.3, 300)]) {
    const { detector, frames, frame } = setup();
    frames(0.18, 3);
    interrupt(detector, frame);
    frame();
    assert.equal(detector.getBlinkCount(), 0);
  }
});
