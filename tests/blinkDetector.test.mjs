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
  const face = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  face[33].x = 0.3;
  face[133].x = 0.4;
  face[362].x = 0.6;
  face[263].x = 0.7;
  const result = { faceLandmarks: [face], faceBlendshapes: [{ categories }],
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

test('rejects weak one-frame spikes and threshold chatter', () => {
  const { detector, frames, frame } = setup();
  for (let i = 0; i < 10; i++) { frame(0.23, 33, 0.35); frame(); }
  frames(0.25, 10);
  assert.equal(detector.getBlinkCount(), 0);
});

test('counts a held closure once, without repeating while closed', () => {
  const { detector, frames, frame } = setup();
  frame(0.18);
  assert.equal(detector.getBlinkCount(), 1);
  frames(0.18, 100);
  frame();
  assert.equal(detector.getBlinkCount(), 1);
});

test('blinks at a settled downward angle are counted after the head movement', () => {
  const { detector, pose, frames, frame } = setup();
  frame(0.23, 33, 0.35);
  pose(0.9);
  frame();
  assert.equal(detector.getBlinkCount(), 0);
  frames(0.3, 8);
  frames(0.18, 3);
  frame();
  assert.equal(detector.getBlinkCount(), 1);
});

test('missing face, invalid EAR, pause, and frame gaps cannot complete a blink', () => {
  for (const interrupt of [d => d.interrupt(), (_d, frame) => frame(NaN),
    (_d, frame) => frame(0.3, 300)]) {
    const { detector, frame } = setup();
    frame(0.23, 33, 0.35);
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
      const angle = 0.1 * (j + 1);
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
  const { detector, result, frame } = setup();
  frame(0.23, 33, 0.35);
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
  frame();
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

for (const fps of [15, 30, 60]) {
  test(`counts all ten brief blinks at ${fps} FPS on the first closed frame`, () => {
    const { detector, frame } = setup();
    for (let count = 1; count <= 10; count++) {
      frame(0.18, 1000 / fps);
      assert.equal(detector.getBlinkCount(), count);
      frame(0.3, 1000 / fps);
      assert.equal(detector.getBlinkCount(), count);
      // ~3 blinks/second: no artificial hold-open requirement.
      for (let i = 0; i < Math.ceil(fps / 3); i++) frame(0.3, 1000 / fps);
    }
  });
}

test('brief deep closures count even when model blink scores are modest', () => {
  const { detector, frame } = setup();
  for (let count = 1; count <= 10; count++) {
    frame(0.18, 33, 0.35);
    frame();
    assert.equal(detector.getBlinkCount(), count);
    frame(0.3, 100);
  }
});

test('strong bilateral blink does not depend on an exact EAR baseline', () => {
  const { detector, frame } = setup();
  frame(0.25, 33, 0.85);
  frame();
  assert.equal(detector.getBlinkCount(), 1);
});

for (const [pitch, yaw] of [[0.9, 0], [0, 0.9], [0.6, 0.6]]) {
  test(`counts ten blinks with visible eyes at pitch ${pitch}, yaw ${yaw}`, () => {
    const { detector, pose, categories, frame } = setup();
    pose(pitch, yaw);
    categories[2].score = categories[3].score = 0.8;
    // Looking down narrows resting EAR too; the open reference follows the view.
    for (let i = 0; i < 8; i++) frame(0.22, 33, 0.05);
    for (let count = 1; count <= 10; count++) {
      frame(0.12, 33, 0.8);
      frame(0.22, 33, 0.05);
      assert.equal(detector.getBlinkCount(), count);
      frame(0.22, 100, 0.05);
    }
  });
}

test('a cropped or collapsed eye cancels a pending blink', () => {
  for (const hide of [face => { face[33].x = -0.1; },
    face => { face[33].x = face[133].x; }, face => { face[160].y = NaN; }]) {
    const { detector, result, frame } = setup();
    frame(0.23, 33, 0.35);
    hide(result.faceLandmarks[0]);
    frame();
    assert.equal(detector.getBlinkCount(), 0);
  }
});

test('weak closure counts on its second closed frame, without waiting for reopening', () => {
  const { detector, frame } = setup();
  frame(0.23, 33, 0.35);
  assert.equal(detector.getBlinkCount(), 0);
  frame(0.23, 33, 0.35);
  assert.equal(detector.getBlinkCount(), 1);
  for (let i = 0; i < 20; i++) frame(0.23, 33, 0.35);
  assert.equal(detector.getBlinkCount(), 1);
});

test('losing tracking after an already counted closure never counts it again', () => {
  const { detector, frame } = setup();
  frame(0.18);
  assert.equal(detector.getBlinkCount(), 1);
  detector.interrupt();
  frame(0.18, 150);
  frame();
  assert.equal(detector.getBlinkCount(), 1);
  frame(0.18, 150);
  assert.equal(detector.getBlinkCount(), 2);
});

for (const fps of [30, 60]) {
  test(`rapid closures separated by one open frame all count at ${fps} FPS`, () => {
    const { detector, frame } = setup();
    for (let count = 1; count <= 10; count++) {
      frame(0.18, 1000 / fps);
      assert.equal(detector.getBlinkCount(), count);
      frame(0.3, 1000 / fps);
      assert.equal(detector.getBlinkCount(), count);
    }
  });
}

test('brief reopening with lagging blink scores rearms without lowering the baseline', () => {
  const { detector, frame } = setup();
  for (let count = 1; count <= 10; count++) {
    frame(0.18, 33, 0.85);
    assert.equal(detector.getBlinkCount(), count);
    frame(0.27, 33, 0.3);
  }
  assert.equal(detector.getBaselineEAR(), 0.3);
});

test('score flutter without recovered eye opening never rearms a held closure', () => {
  const { detector, frame } = setup();
  frame(0.18);
  for (let i = 0; i < 10; i++) {
    frame(0.2, 33, 0.3);
    frame(0.18, 33, 0.85);
  }
  assert.equal(detector.getBlinkCount(), 1);
});

test('baseline does not follow closing eyelids when model scores lag at 40 FPS', () => {
  const { detector, frame } = setup();
  for (let count = 1; count <= 5; count++) {
    frame(0.27, 25, 0.05);
    frame(0.23, 25, 0.1);
    frame(0.18, 25, 0.3);
    assert.equal(detector.getBlinkCount(), count);
    assert.ok(detector.getBaselineEAR() > 0.29);
    frame(0.3, 25, 0.05);
    frame(0.3, 100, 0.05);
  }
});

test('a lower resting view still recalibrates after it stays steady', () => {
  const { detector, frame } = setup();
  for (let i = 0; i < 10; i++) frame(0.22, 33, 0.05);
  assert.equal(detector.getBaselineEAR(), 0.22);
  frame(0.12, 33, 0.35);
  assert.equal(detector.getBlinkCount(), 1);
});

test('reported baseline .390 and EAR .020 counts immediately even with conflicting auxiliary scores', () => {
  const { detector, result, categories, pose, frame } = setup(false);
  for (let i = 0; i < 36; i++) frame(0.390, 1000 / 30, 0.05);
  assert.ok(Math.abs(detector.getFullThreshold() - 0.3042) < 0.001);
  categories[2].score = categories[3].score = 0.9;
  pose(0.3);
  frame(0.020, 1000 / 30, 0.02);
  assert.equal(detector.getBlinkCount(), 1);
  for (let i = 0; i < 30; i++) frame(0.020, 1000 / 30, 0.02);
  assert.equal(detector.getBlinkCount(), 1);
  assert.equal(detector.getBaselineEAR(), 0.390);
  result.faceBlendshapes = [];
  result.facialTransformationMatrixes = [];
  frame(0.020);
  assert.equal(detector.getBlinkCount(), 1);
});

test('five deep closures at 30 FPS count without waiting for model blink scores', () => {
  const { detector, frame } = setup(false);
  for (let i = 0; i < 36; i++) frame(0.390, 1000 / 30, 0.05);
  for (let count = 1; count <= 5; count++) {
    frame(0.020, 1000 / 30, 0.02);
    assert.equal(detector.getBlinkCount(), count);
    frame(0.390, 1000 / 30, 0.05);
  }
});

test('zero EAR is a valid closure but invalid or cropped geometry is not', () => {
  const { detector, frame, result } = setup();
  frame(0, 33, 0.02);
  assert.equal(detector.getBlinkCount(), 1);
  frame();
  result.faceLandmarks[0][33].x = NaN;
  frame(0.020, 33, 0.02);
  assert.equal(detector.getBlinkCount(), 1);
});

test('a preceding pose-rejected frame cannot disarm a clear deep closure', () => {
  const { detector, pose, frame } = setup();
  pose(0.3);
  frame(0.25, 33, 0.05);
  frame(0.020, 33, 0.02);
  assert.equal(detector.getBlinkCount(), 1);
  pose(0.6);
  frame(0.2, 33, 0.3);
  frame(0.020, 33, 0.02);
  assert.equal(detector.getBlinkCount(), 1);
});
