import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  MAX_WAIT_MS,
  MIN_WAIT_MS,
  REFERENCE_MEAN_MS,
  REFERENCE_STANDARD_DEVIATION_MS,
  TRIAL_COUNT,
  getDistributionPosition,
  getPerformanceLabel,
  getWaitDelay,
  normalCdf,
  secureRandomInt,
  summarizeResults,
} from '../public/assets/js/reaction-core.js';
import { shareResult } from '../public/assets/js/share-result.js';
import { getReactionShareText } from '../public/assets/js/result-card.js';
import { createReactionSoundController, getReactionSoundPattern } from '../public/assets/js/sound.js';

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

test('평균 기록의 정규분포 위치를 계산한다', () => {
  assert.ok(Math.abs(normalCdf(REFERENCE_MEAN_MS) - 0.5) < 0.000001);
  assert.equal(REFERENCE_STANDARD_DEVIATION_MS, 50);
  assert.deepEqual(getDistributionPosition(200), {
    zScore: -1,
    topPercent: 16,
    fasterThanPercent: 84,
  });
});

test('화면은 핵심 모듈과 5회 진행 UI를 사용한다', async () => {
  const app = await readFile(new URL('../public/assets/js/app.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(app, /reaction-core\.js\?v=/);
  assert.match(app, /performance\.now\(\)/);
  assert.match(app, /visibilitychange/);
  assert.match(app, /NEXT_TRIAL_DELAY_MS/);
  assert.match(app, /window\.setTimeout\(\(\) => \{\s*timerId = null;\s*startWaiting\(\);/);
  assert.match(app, /function clearCurrentTest\(\) \{[\s\S]*?trials = \[\];[\s\S]*?resultPanel\.hidden = true;/);
  assert.match(app, /function showFalseStart\(\) \{\s*clearCurrentTest\(\);/);
  assert.match(app, /눌러서 1회차부터 다시 시작하세요/);
  assert.match(app, /renderTrialChart/);
  assert.match(app, /renderDistribution/);
  assert.match(html, /총 5회 측정/);
  assert.match(html, /data-reaction-pad/);
  assert.match(html, /data-distribution-chart/);
});

test('시작과 결과에만 효과음을 사용하고 초록 신호는 무음이다', async () => {
  const app = await readFile(new URL('../public/assets/js/app.js', import.meta.url), 'utf8');
  const readySignal = app.match(/function showReadySignal\(\) \{([\s\S]*?)\n\}/)?.[1] ?? '';

  assert.ok(getReactionSoundPattern('start').length > 0);
  assert.ok(getReactionSoundPattern('result').length > 0);
  assert.ok(getReactionSoundPattern('complete').length > getReactionSoundPattern('result').length);
  assert.deepEqual(getReactionSoundPattern('ready'), []);
  assert.match(app, /sounds\.play\('start'\)/);
  assert.match(app, /sounds\.play\(trials\.length >= TRIAL_COUNT \? 'complete' : 'result'\)/);
  assert.match(app, /window\.setTimeout\(showReadySignal, delay\)/);
  assert.doesNotMatch(readySignal, /sounds\.play/);
});

test('효과음 컨트롤러가 음을 예약하고 초록 신호는 예약하지 않는다', () => {
  const oscillators = [];
  const audioParameter = () => ({
    value: 0,
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
  });
  const context = {
    currentTime: 1,
    destination: {},
    state: 'running',
    createGain: () => ({ gain: audioParameter(), connect() {} }),
    createOscillator: () => {
      const oscillator = {
        frequency: audioParameter(),
        connect() {},
        start(time) { oscillator.started = time; },
        stop(time) { oscillator.stopped = time; },
      };
      oscillators.push(oscillator);
      return oscillator;
    },
  };
  const sounds = createReactionSoundController({ contextFactory: () => context });

  assert.equal(sounds.play('start'), true);
  assert.equal(oscillators.length, getReactionSoundPattern('start').length);
  assert.ok(oscillators.every((oscillator) => oscillator.stopped > oscillator.started));
  assert.equal(sounds.play('ready'), false);
  assert.equal(oscillators.length, getReactionSoundPattern('start').length);
});

test('AdSense 검토에 필요한 광고 식별자와 개인정보 안내를 제공한다', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const privacy = await readFile(new URL('../public/privacy.html', import.meta.url), 'utf8');
  const analytics = await readFile(new URL('../public/assets/js/analytics.js', import.meta.url), 'utf8');

  assert.match(html, /ca-pub-6044197403684738/);
  assert.match(html, /href="\/privacy\.html"/);
  assert.match(html, /data-consent-settings/);
  assert.match(privacy, /Google AdSense/);
  assert.match(privacy, /policies\.google\.com\/technologies\/ads/);
  assert.match(privacy, /Google 인증 동의 관리 플랫폼/);
  assert.match(analytics, /analyticsWasLoaded/);
});

test('결과 공유를 지원하면 시스템 공유창을 사용한다', async () => {
  let payload;
  const result = await shareResult(
    { title: '결과', text: '평균 220ms', url: 'https://reaction.cora1022.com/' },
    { navigatorApi: { userAgent: 'Android', async share(value) { payload = value; } } },
  );
  assert.equal(result, 'shared');
  assert.deepEqual(payload, { title: '결과', text: '평균 220ms', url: 'https://reaction.cora1022.com/' });
});

test('시스템 공유창이 없으면 결과와 주소를 복사한다', async () => {
  let copied = '';
  const result = await shareResult(
    { title: '결과', text: '평균 220ms', url: 'https://reaction.cora1022.com/' },
    { navigatorApi: { clipboard: { async writeText(value) { copied = value; } } } },
  );
  assert.equal(result, 'copied');
  assert.equal(copied, '평균 220ms\nhttps://reaction.cora1022.com/');
});

test('PC에서는 시스템 공유창 대신 바로 복사한다', async () => {
  let shared = false;
  let copied = '';
  const result = await shareResult(
    { title: '결과', text: '평균 220ms', url: 'https://reaction.cora1022.com/' },
    { navigatorApi: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      async share() { shared = true; },
      clipboard: { async writeText(value) { copied = value; } },
    } },
  );
  assert.equal(result, 'copied');
  assert.equal(shared, false);
  assert.equal(copied, '평균 220ms\nhttps://reaction.cora1022.com/');
});

test('반응속도 공유 문구에 평균과 최고 기록을 담는다', () => {
  assert.equal(
    getReactionShareText({ average: 220, best: 180 }),
    '반응속도 테스트에서 5회 평균 220ms · 최고 180ms를 기록했어요.',
  );
});

test('모바일 공유가 파일을 지원하면 PNG 결과 카드를 첨부한다', async () => {
  let payload;
  class FakeFile {
    constructor(parts, name, options) {
      this.parts = parts;
      this.name = name;
      this.type = options.type;
    }
  }
  const imageBlob = new Blob(['image'], { type: 'image/png' });
  const result = await shareResult(
    {
      title: '반응속도 결과',
      text: '평균 220ms',
      url: 'https://reaction.cora1022.com/',
      imageBlob,
      imageName: 'cora-reaction-220ms.png',
    },
    {
      FileApi: FakeFile,
      navigatorApi: {
        userAgent: 'Android',
        canShare(value) { return value.files?.length === 1; },
        async share(value) { payload = value; },
      },
    },
  );
  assert.equal(result, 'image-shared');
  assert.equal(payload.files[0].name, 'cora-reaction-220ms.png');
  assert.equal(payload.files[0].type, 'image/png');
});

test('PC에서는 PNG 결과 카드를 클립보드 이미지로 복사한다', async () => {
  let clipboardItems;
  class FakeClipboardItem {
    constructor(data) { this.data = data; }
  }
  const imageBlob = new Blob(['image'], { type: 'image/png' });
  const result = await shareResult(
    {
      title: '반응속도 결과',
      text: '평균 220ms',
      url: 'https://reaction.cora1022.com/',
      imageBlob,
    },
    {
      ClipboardItemApi: FakeClipboardItem,
      BlobApi: Blob,
      navigatorApi: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        clipboard: { async write(value) { clipboardItems = value; } },
      },
    },
  );
  assert.equal(result, 'image-copied');
  assert.equal(clipboardItems.length, 1);
  assert.equal(clipboardItems[0].data['image/png'], imageBlob);
  assert.equal(clipboardItems[0].data['text/plain'].type, 'text/plain');
});
