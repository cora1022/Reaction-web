import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  MAX_WAIT_MS,
  MIN_WAIT_MS,
  TRIAL_COUNT,
  getPerformanceLabel,
  getWaitDelay,
  secureRandomInt,
  summarizeResults,
} from '../public/assets/js/reaction-core.js';

test('대기 시간은 지정한 범위 안에서 결정된다', () => {
  assert.equal(getWaitDelay(() => 0), MIN_WAIT_MS);
  assert.equal(getWaitDelay(() => MAX_WAIT_MS - MIN_WAIT_MS), MAX_WAIT_MS);
});

test('안전한 난수는 지정 범위 안의 정수를 반환한다', () => {
  const fakeCrypto = { getRandomValues(array) { array[0] = 23; return array; } };
  assert.equal(secureRandomInt(6, fakeCrypto), 5);
});

test('반응속도 결과의 평균, 최고, 중앙값을 계산한다', () => {
  assert.deepEqual(summarizeResults([220, 180, 260, 200, 240]), {
    average: 220,
    best: 180,
    median: 220,
  });
  assert.equal(TRIAL_COUNT, 5);
});

test('반응속도에 맞는 자연스러운 판정을 반환한다', () => {
  assert.equal(getPerformanceLabel(179), '매우 빠름');
  assert.equal(getPerformanceLabel(200), '빠름');
  assert.equal(getPerformanceLabel(250), '보통');
  assert.equal(getPerformanceLabel(350), '조금 느림');
  assert.equal(getPerformanceLabel(450), '천천히 반응함');
});

test('잘못된 결과값은 요약하지 않는다', () => {
  assert.throws(() => summarizeResults([]), /기록/);
  assert.throws(() => summarizeResults([200, -1]), /기록/);
});

test('화면은 핵심 모듈과 5회 진행 UI를 사용한다', async () => {
  const app = await readFile(new URL('../public/assets/js/app.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(app, /reaction-core\.js\?v=/);
  assert.match(app, /performance\.now\(\)/);
  assert.match(app, /visibilitychange/);
  assert.match(html, /총 5회 측정/);
  assert.match(html, /data-reaction-pad/);
});

