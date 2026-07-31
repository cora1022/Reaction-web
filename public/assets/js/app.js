import {
  TRIAL_COUNT,
  getPerformanceLabel,
  getWaitDelay,
  summarizeResults,
} from './reaction-core.js?v=20260731-1';

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
const trialList = document.querySelector('[data-trials]');
const restartButton = document.querySelector('[data-restart]');
const historyList = document.querySelector('[data-history]');
const historyEmpty = document.querySelector('[data-history-empty]');
const bestEver = document.querySelector('[data-best-ever]');

let state = 'idle';
let timerId = null;
let readyAt = 0;
let trials = [];
let sessions = loadSessions();

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

function renderTrialList() {
  trialList.replaceChildren();
  trials.forEach((value, index) => {
    const item = document.createElement('li');
    const label = document.createElement('span');
    const result = document.createElement('strong');
    label.textContent = `${index + 1}회`;
    result.textContent = `${value} ms`;
    item.append(label, result);
    trialList.appendChild(item);
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

function startWaiting() {
  clearTimer();
  resultPanel.hidden = true;
  setPad('waiting', `${trials.length + 1} / ${TRIAL_COUNT}`, '초록색이 될 때까지 기다리세요', '지금 누르면 너무 이른 반응으로 처리됩니다.');
  renderProgress();
  const delay = getWaitDelay();
  timerId = window.setTimeout(() => {
    timerId = null;
    readyAt = performance.now();
    setPad('ready', '지금!', '클릭하세요', '화면을 누르는 순간 반응속도를 측정합니다.');
  }, delay);
}

function showFalseStart() {
  clearTimer();
  setPad('false-start', '너무 빨랐어요', '초록색이 된 뒤 눌러주세요', '이 시도는 기록하지 않습니다. 눌러서 다시 시작하세요.');
  renderProgress();
}

function showTrialResult(milliseconds) {
  trials.push(milliseconds);
  currentValue.textContent = `${milliseconds} ms`;
  bestValue.textContent = `${Math.min(...trials)} ms`;
  averageValue.textContent = `${summarizeResults(trials).average} ms`;
  performanceValue.textContent = getPerformanceLabel(milliseconds);
  renderTrialList();
  renderProgress();
  resultPanel.hidden = false;

  if (trials.length >= TRIAL_COUNT) {
    const summary = summarizeResults(trials);
    sessions = [{ ...summary, createdAt: Date.now() }, ...sessions].slice(0, 10);
    saveSessions();
    renderHistory();
    setPad('complete', '측정 완료', `평균 ${summary.average} ms`, `최고 기록은 ${summary.best} ms입니다. 눌러서 새 테스트를 시작하세요.`);
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
  clearTimer();
  trials = [];
  resultPanel.hidden = true;
  currentValue.textContent = '—';
  bestValue.textContent = '—';
  averageValue.textContent = '—';
  performanceValue.textContent = '—';
  renderTrialList();
  setPad('idle', '반응속도 측정', '시작하려면 누르세요', '초록색 화면이 나타나면 최대한 빠르게 다시 누르세요.');
  renderProgress();
}

pad.addEventListener('click', handlePadActivation);
restartButton.addEventListener('click', resetTest);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && (state === 'waiting' || state === 'ready' || state === 'result')) {
    clearTimer();
    setPad('false-start', '측정이 중단됐어요', '화면을 계속 보고 측정해 주세요', '눌러서 이 측정을 다시 시작하세요.');
  }
});

resetTest();
renderHistory();
