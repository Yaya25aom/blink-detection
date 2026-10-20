import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../extension/src/detection/blinkDetector.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { BlinkDetector } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

function setup(warmup = true) {
  const detector = new BlinkDetector();
  let now = 1000;
  const categories = ['eyeBlinkLeft', 'eyeBlinkRight', 'eyeLookDownLeft', 'eyeLookDownRight']
    .map(categoryName => ({ categoryName, score: 0 }));
  const result = { faceLandmarks: [[]], faceBlendshapes: [{ categories }],
    facialTransformationMatrixes: [{ data: [] }] };
  const pose = (pitch = 0, yaw = 0) => {
    const c = Math.cos(pitch), s = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
    result.facialTransformationMatrixes[0].data = [cy, s * sy, -c * sy, 0,
      0, c, s, 0, sy, -s * cy, c * cy, 0, 0, 0, 0, 1];
  };
  pose();
  const frame = (ear = 0.3, ms = 33, blink = ear < 0.23 ? 0.85 : 0.05, rightBlink = blink) => {
    categories[0].score = blink;
    categories[1].score = rightBlink;
    return detector.update(ear, now += ms, result);
  };
  const frames = (ear, count) => { for (let i = 0; i < count; i++) frame(ear); };
  if (warmup) frames(0.3, 36);
  return { detector, result, categories, pose, frame, frames };

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
  const { detector, pose, frames, frame } = setup();
  frames(0.18, 2);
  pose(0.7);
  for (let i = 0; i < 20; i++) { frames(0.18, 3); frames(0.3, 5); }
  pose();
  frames(0.18, 3);
  frame();
  assert.equal(detector.getBlinkCount(), 0);
  frames(0.3, 15);
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

test('lower EAR from looking below camera is not a blink', () => {
  const { detector, frame, categories } = setup();
  for (let i = 0; i < 10; i++) {
    categories[2].score = categories[3].score = 0.7;
    // Even an erroneous blink score must not override a clear downward gaze.
    for (let j = 0; j < 3; j++) frame(0.18, 33, 0.8);
    categories[2].score = categories[3].score = 0;
    for (let j = 0; j < 6; j++) frame();
  }
  assert.equal(detector.getBlinkCount(), 0);
});

test('EAR changes without both eye-blink scores never count', () => {
  const { detector, frame } = setup();
  for (let j = 0; j < 3; j++) frame(0.18, 33, 0.1);
  frame();
  for (let j = 0; j < 3; j++) frame(0.18, 33, 0.9, 0.05);
  frame();
  assert.equal(detector.getBlinkCount(), 0);
});

test('small nods and screen-to-screen turns cancel closures, then recover', () => {
  for (const axis of ['pitch', 'yaw']) {
    const { detector, pose, frames, frame } = setup();
    for (let j = 0; j < 8; j++) {
      const angle = 0.025 * j;
      pose(axis === 'pitch' ? angle : 0, axis === 'yaw' ? angle : 0);
      frame(0.18);
    }
    frame();
    assert.equal(detector.getBlinkCount(), 0);
    frames(0.3, 15);
    frames(0.18, 3);
    frame();
    assert.equal(detector.getBlinkCount(), 1);
  }
});

test('missing model signals cancel a closure instead of falling back to EAR', () => {
  const { detector, result, frames, frame } = setup();
  frames(0.18, 3);
  result.faceBlendshapes = [];
  frame();
  assert.equal(detector.getBlinkCount(), 0);
});

test('calibration finishes within three seconds despite interruptions and low FPS', () => {
  const { detector, pose, frame } = setup(false);
  for (let i = 0; i <= 14; i++) {
    pose(i % 2 ? 0.15 : 0);
    detector.interrupt();
    frame(0.3, 200);
  }
  assert.equal(detector.isCalibrated(), true);
  assert.equal(detector.getBaselineEAR(), 0.3);
  assert.equal(detector.getBlinkCount(), 0);
});

test('calibration normally completes in about one second', () => {
  const { detector, frames } = setup(false);
  frames(0.3, 30);
  assert.equal(detector.isCalibrated(), true);
});

test('moderate blink scores and overlapping gaze scores still count a real closure', () => {
  const { detector, categories, frame } = setup();
  categories[2].score = categories[3].score = 0.45;
  for (let i = 0; i < 3; i++) frame(0.18, 33, 0.4, 0.35);
  frame();
  assert.equal(detector.getBlinkCount(), 1);
});

test('higher resting blink scores are calibrated per user', () => {
  const { detector, frame } = setup(false);
  for (let i = 0; i < 36; i++) frame(0.3, 33, 0.3);
  for (let i = 0; i < 3; i++) frame(0.18, 33, 0.55);
  frame(0.3, 33, 0.3);
  assert.equal(detector.getBlinkCount(), 1);
});

test('invalid samples cannot create a baseline', () => {
  const { detector, frame } = setup(false);
  for (let i = 0; i < 40; i++) frame(NaN, 100);
  assert.equal(detector.isCalibrated(), false);
});
