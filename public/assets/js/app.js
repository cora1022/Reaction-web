import {
  REFERENCE_MEAN_MS,
  REFERENCE_STANDARD_DEVIATION_MS,
  TRIAL_COUNT,
  getDistributionPosition,
  getPerformanceLabel,
  getWaitDelay,
  summarizeResults,
} from './reaction-core.js?v=20260731-2';
import { shareResult } from './share-result.js?v=20260805-3';
import { createReactionResultCard, getReactionShareText } from './result-card.js?v=20260805-1';
import { createReactionSoundController } from './sound.js?v=20260806-1';

const STORAGE_KEY = 'cora-reaction:records:v1';
const NEXT_TRIAL_DELAY_MS = 1200;
const pad = document.querySelector('[data-reaction-pad]');
const padKicker = document.querySelector('[data-pad-kicker]');
const padTitle = document.querySelector('[data-pad-title]');
const padDescription = document.querySelector('[data-pad-description]');
const progress = document.querySelector('[data-progress]');
const resultPanel = document.querySelector('[data-result-panel]');
const currentValue = document.querySelector('[data-current-value]');
const bestValue = document.querySelector('[data-best-value]');
const averageValue = document.querySelector('[data-average-value]');
const performanceValue = document.querySelector('[data-performance]');
const trialChart = document.querySelector('[data-trial-chart]');
const distributionResult = document.querySelector('[data-distribution-result]');
const distributionChart = document.querySelector('[data-distribution-chart]');
const distributionRank = document.querySelector('[data-distribution-rank]');
const distributionDescription = document.querySelector('[data-distribution-description]');
const distributionAverage = document.querySelector('[data-distribution-average]');
const restartButton = document.querySelector('[data-restart]');
const shareResultButton = document.querySelector('[data-share-result]');
const shareStatus = document.querySelector('[data-share-status]');
const historyList = document.querySelector('[data-history]');
const historyEmpty = document.querySelector('[data-history-empty]');
const bestEver = document.querySelector('[data-best-ever]');
const sounds = createReactionSoundController();

let state = 'idle';
let timerId = null;
let readyAt = 0;
let trials = [];
let sessions = loadSessions();
let shareImageBlob = null;
let shareCardVersion = 0;

function loadSessions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => Number.isFinite(entry?.average) && Number.isFinite(entry?.best))
      .slice(0, 10);
  } catch {
    return [];
  }
}

function saveSessions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // 저장할 수 없어도 현재 테스트는 계속 진행합니다.
  }
}

function clearTimer() {
  if (timerId !== null) {
    window.clearTimeout(timerId);
    timerId = null;
  }
}

function setPad(nextState, kicker, title, description) {
  state = nextState;
  pad.dataset.state = nextState;
  padKicker.textContent = kicker;
  padTitle.textContent = title;
  padDescription.textContent = description;
}

function renderProgress() {
  const completed = trials.length;
  progress.replaceChildren();
  for (let index = 0; index < TRIAL_COUNT; index += 1) {
    const item = document.createElement('span');
    item.className = index < completed ? 'is-complete' : index === completed && state !== 'complete' ? 'is-current' : '';
    item.setAttribute('aria-label', `${index + 1}번째 측정${index < completed ? ' 완료' : ''}`);
    progress.appendChild(item);
  }
}

function prepareCanvas(canvas, height) {
  const width = Math.max(280, Math.floor(canvas.parentElement.clientWidth));
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  canvas.style.height = `${height}px`;
  const context = canvas.getContext('2d');
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);
  return { context, width, height };
}

function renderTrialChart() {
  if (resultPanel.hidden || trials.length === 0) return;

  trialChart.setAttribute(
    'aria-label',
    `회차별 반응속도 그래프: ${trials.map((value, index) => `${index + 1}회 ${value}밀리초`).join(', ')}`,
  );

  const { context, width, height } = prepareCanvas(trialChart, 210);
  const padding = { top: 30, right: 24, bottom: 38, left: 48 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const minimum = Math.min(...trials);
  const maximum = Math.max(...trials);
  const lower = Math.max(0, minimum - 45);
  const upper = Math.max(lower + 90, maximum + 45);
  const xFor = (index) => padding.left + ((TRIAL_COUNT === 1 ? 0.5 : index / (TRIAL_COUNT - 1)) * plotWidth);
  const yFor = (value) => padding.top + (((upper - value) / (upper - lower)) * plotHeight);

  context.font = '700 11px system-ui, sans-serif';
  context.textBaseline = 'middle';
  context.strokeStyle = '#e7e9f1';
  context.fillStyle = '#7c8497';
  context.lineWidth = 1;

  for (let index = 0; index <= 3; index += 1) {
    const ratio = index / 3;
    const y = padding.top + (ratio * plotHeight);
    const value = Math.round(upper - (ratio * (upper - lower)));
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(width - padding.right, y);
    context.stroke();
    context.textAlign = 'right';
    context.fillText(`${value}`, padding.left - 9, y);
  }

  context.strokeStyle = '#6375f4';
  context.lineWidth = 3;
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.beginPath();
  trials.forEach((value, index) => {
    const x = xFor(index);
    const y = yFor(value);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();

  trials.forEach((value, index) => {
    const x = xFor(index);
    const y = yFor(value);
    context.fillStyle = '#ffffff';
    context.strokeStyle = '#6375f4';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(x, y, 5.5, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    context.fillStyle = '#28336e';
    context.font = '800 11px system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillText(`${value} ms`, x, Math.max(13, y - 15));
  });

  context.fillStyle = '#7c8497';
  context.font = '700 11px system-ui, sans-serif';
  context.textBaseline = 'alphabetic';
  for (let index = 0; index < TRIAL_COUNT; index += 1) {
    context.textAlign = 'center';
    context.fillText(`${index + 1}회`, xFor(index), height - 10);
  }
}

function renderDistribution(average) {
  const position = getDistributionPosition(average);
  distributionRank.textContent = `빠른 상위 ${position.topPercent}%`;
  distributionDescription.textContent = `기준 분포에서 약 ${position.fasterThanPercent}%보다 빠른 기록입니다.`;
  distributionAverage.textContent = `${average} ms`;
  distributionChart.setAttribute(
    'aria-label',
    `평균 ${average}밀리초, 기준 분포에서 빠른 상위 ${position.topPercent}퍼센트`,
  );

  const { context, width, height } = prepareCanvas(distributionChart, 240);
  const padding = { top: 35, right: 28, bottom: 42, left: 28 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const start = REFERENCE_MEAN_MS - (3 * REFERENCE_STANDARD_DEVIATION_MS);
  const end = REFERENCE_MEAN_MS + (3 * REFERENCE_STANDARD_DEVIATION_MS);
  const xFor = (value) => padding.left + (((value - start) / (end - start)) * plotWidth);
  const densityFor = (value) => Math.exp(-0.5 * (((value - REFERENCE_MEAN_MS) / REFERENCE_STANDARD_DEVIATION_MS) ** 2));
  const yFor = (value) => padding.top + ((1 - densityFor(value)) * (plotHeight - 15));

  context.beginPath();
  context.moveTo(xFor(start), padding.top + plotHeight);
  for (let step = 0; step <= 120; step += 1) {
    const value = start + ((step / 120) * (end - start));
    context.lineTo(xFor(value), yFor(value));
  }
  context.lineTo(xFor(end), padding.top + plotHeight);
  context.closePath();
  context.fillStyle = 'rgba(99, 117, 244, .16)';
  context.fill();

  context.beginPath();
  for (let step = 0; step <= 120; step += 1) {
    const value = start + ((step / 120) * (end - start));
    const x = xFor(value);
    const y = yFor(value);
    if (step === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.strokeStyle = '#6375f4';
  context.lineWidth = 3;
  context.stroke();

  const markerValue = Math.max(start, Math.min(end, average));
  const markerX = xFor(markerValue);
  const markerY = yFor(markerValue);
  context.beginPath();
  context.moveTo(markerX, markerY);
  context.lineTo(markerX, padding.top + plotHeight);
  context.strokeStyle = '#ef4444';
  context.lineWidth = 2;
  context.setLineDash([5, 5]);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = '#ef4444';
  context.beginPath();
  context.arc(markerX, markerY, 6, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#111827';
  context.font = '800 12px system-ui, sans-serif';
  context.textAlign = markerX < width / 2 ? 'left' : 'right';
  context.fillText(`내 평균 ${average} ms`, markerX + (markerX < width / 2 ? 10 : -10), Math.max(18, markerY - 12));

  const axisY = padding.top + plotHeight;
  context.strokeStyle = '#cfd3e1';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(padding.left, axisY);
  context.lineTo(width - padding.right, axisY);
  context.stroke();

  context.fillStyle = '#7c8497';
  context.font = '700 11px system-ui, sans-serif';
  context.textBaseline = 'alphabetic';
  [
    [start, '100ms · 빠름'],
    [REFERENCE_MEAN_MS, '250ms · 기준'],
    [end, '400ms · 느림'],
  ].forEach(([value, label]) => {
    context.textAlign = value === start ? 'left' : value === end ? 'right' : 'center';
    context.fillText(label, xFor(value), height - 11);
  });
}

function renderHistory() {
  historyList.replaceChildren();
  historyEmpty.hidden = sessions.length > 0;
  bestEver.textContent = sessions.length ? `${Math.min(...sessions.map((entry) => entry.best))} ms` : '—';

  sessions.forEach((entry, index) => {
    const item = document.createElement('li');
    const label = document.createElement('span');
    const result = document.createElement('strong');
    label.textContent = `${index + 1}번째 테스트`;
    result.textContent = `평균 ${entry.average} ms · 최고 ${entry.best} ms`;
    item.append(label, result);
    historyList.appendChild(item);
  });
}

function showReadySignal() {
  timerId = null;
  readyAt = performance.now();
  setPad('ready', '지금!', '클릭하세요', '화면을 누르는 순간 반응속도를 측정합니다.');
}

function startWaiting() {
  clearTimer();
  resultPanel.hidden = true;
  setPad('waiting', `${trials.length + 1} / ${TRIAL_COUNT}`, '초록색이 될 때까지 기다리세요', '지금 누르면 너무 이른 반응으로 처리됩니다.');
  sounds.play('start');
  renderProgress();
  const delay = getWaitDelay();
  timerId = window.setTimeout(showReadySignal, delay);
}

function clearCurrentTest() {
  clearTimer();
  shareCardVersion += 1;
  shareImageBlob = null;
  shareResultButton.disabled = true;
  trials = [];
  resultPanel.hidden = true;
  currentValue.textContent = '—';
  bestValue.textContent = '—';
  averageValue.textContent = '—';
  performanceValue.textContent = '—';
  distributionResult.hidden = true;
  shareStatus.textContent = '';
}

function showFalseStart() {
  clearCurrentTest();
  setPad('false-start', '너무 빨랐어요', '처음부터 다시 측정합니다', '지금까지의 기록을 모두 지웠습니다. 눌러서 1회차부터 다시 시작하세요.');
  renderProgress();
}

function showTrialResult(milliseconds) {
  trials.push(milliseconds);
  sounds.play(trials.length >= TRIAL_COUNT ? 'complete' : 'result');
  currentValue.textContent = `${milliseconds} ms`;
  bestValue.textContent = `${Math.min(...trials)} ms`;
  averageValue.textContent = `${summarizeResults(trials).average} ms`;
  performanceValue.textContent = getPerformanceLabel(milliseconds);
  renderProgress();
  resultPanel.hidden = false;
  distributionResult.hidden = true;
  renderTrialChart();

  if (trials.length >= TRIAL_COUNT) {
    const summary = summarizeResults(trials);
    performanceValue.textContent = getPerformanceLabel(summary.average);
    sessions = [{ ...summary, createdAt: Date.now() }, ...sessions].slice(0, 10);
    saveSessions();
    renderHistory();
    distributionResult.hidden = false;
    renderDistribution(summary.average);
    setPad('complete', '측정 완료', `평균 ${summary.average} ms`, `최고 기록은 ${summary.best} ms입니다. 눌러서 새 테스트를 시작하세요.`);
    const cardVersion = ++shareCardVersion;
    shareImageBlob = null;
    shareResultButton.disabled = true;
    shareStatus.textContent = '공유 이미지 준비 중...';
    createReactionResultCard({ average: summary.average, best: summary.best, trials: [...trials] })
      .then((blob) => {
        if (state !== 'complete' || cardVersion !== shareCardVersion) return;
        shareImageBlob = blob;
        shareResultButton.disabled = false;
        shareStatus.textContent = '';
      })
      .catch(() => {
        if (state !== 'complete' || cardVersion !== shareCardVersion) return;
        shareResultButton.disabled = false;
        shareStatus.textContent = '이미지를 만들지 못해 기록만 공유합니다.';
      });
    window.requestAnimationFrame(() => {
      distributionResult.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'nearest',
      });
    });
    return;
  }

  setPad('result', `${trials.length}회 측정`, `${milliseconds} ms`, '잠시 후 다음 측정이 자동으로 시작됩니다.');
  timerId = window.setTimeout(() => {
    timerId = null;
    startWaiting();
  }, NEXT_TRIAL_DELAY_MS);
}

function handlePadActivation() {
  if (state === 'idle' || state === 'false-start') {
    startWaiting();
    return;
  }
  if (state === 'waiting') {
    showFalseStart();
    return;
  }
  if (state === 'ready') {
    showTrialResult(Math.max(0, Math.round(performance.now() - readyAt)));
    return;
  }
  if (state === 'complete') {
    resetTest();
    startWaiting();
  }
}

function resetTest() {
  clearCurrentTest();
  setPad('idle', '반응속도 측정', '시작하려면 누르세요', '초록색 화면이 나타나면 최대한 빠르게 다시 누르세요.');
  renderProgress();
}

pad.addEventListener('click', handlePadActivation);
restartButton.addEventListener('click', resetTest);
shareResultButton.addEventListener('click', async () => {
  if (state !== 'complete' || trials.length < TRIAL_COUNT) return;
  const summary = summarizeResults(trials);
  shareResultButton.disabled = true;
  const result = await shareResult({
    title: 'Cora 반응속도 테스트 결과',
    text: getReactionShareText(summary),
    url: 'https://reaction.cora1022.com/',
    imageBlob: shareImageBlob,
    imageName: `cora-reaction-${summary.average}ms.png`,
  });
  shareResultButton.disabled = false;
  if (result === 'image-shared') shareStatus.textContent = '이미지와 결과를 공유했습니다.';
  if (result === 'shared') shareStatus.textContent = '결과와 주소를 공유했습니다.';
  if (result === 'image-copied') shareStatus.textContent = '결과 이미지를 복사했습니다. 채팅창에 붙여넣으세요.';
  if (result === 'downloaded') shareStatus.textContent = '결과 이미지를 저장했습니다.';
  if (result === 'copied') shareStatus.textContent = '결과와 주소를 복사했습니다.';
  if (result === 'unavailable') shareStatus.textContent = '이 브라우저에서는 공유할 수 없습니다.';
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && (state === 'waiting' || state === 'ready' || state === 'result')) {
    clearCurrentTest();
    setPad('false-start', '측정이 중단됐어요', '처음부터 다시 측정합니다', '지금까지의 기록을 모두 지웠습니다. 눌러서 1회차부터 다시 시작하세요.');
    renderProgress();
  }
});
window.addEventListener('resize', () => {
  if (!resultPanel.hidden && trials.length > 0) {
    renderTrialChart();
    if (!distributionResult.hidden) renderDistribution(summarizeResults(trials).average);
  }
});

resetTest();
renderHistory();
