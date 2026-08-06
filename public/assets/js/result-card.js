const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

function roundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function fillRoundedRect(context, x, y, width, height, radius, color) {
  roundedRect(context, x, y, width, height, radius);
  context.fillStyle = color;
  context.fill();
}

function loadImage(src, ImageApi) {
  return new Promise((resolve, reject) => {
    if (typeof ImageApi !== 'function') {
      reject(new Error('이미지를 불러올 수 없습니다.'));
      return;
    }
    const image = new ImageApi();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('결과 이미지를 만들 수 없습니다.'));
    }, 'image/png');
  });
}

export function getReactionShareText({ average, best }) {
  return `반응속도 테스트에서 5회 평균 ${average}ms · 최고 ${best}ms를 기록했어요.`;
}

export function getReactionChartY(value, { lower, upper, top = 0, height = 1 }) {
  if (![value, lower, upper, top, height].every(Number.isFinite) || upper <= lower || height < 0) {
    throw new RangeError('그래프 범위를 확인해 주세요.');
  }
  return top + (((upper - value) / (upper - lower)) * height);
}

export async function createReactionResultCard({ average, best, trials }, environment = {}) {
  const documentApi = environment.documentApi ?? globalThis.document;
  const ImageApi = environment.ImageApi ?? globalThis.Image;
  const canvas = documentApi.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const context = canvas.getContext('2d');

  context.fillStyle = '#f8f8ff';
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  context.fillStyle = '#6375f4';
  context.fillRect(0, 0, 18, CARD_HEIGHT);
  fillRoundedRect(context, 650, 70, 490, 490, 30, '#11172b');
  fillRoundedRect(context, 686, 122, 418, 344, 22, '#ffffff');

  try {
    const logo = await loadImage('/cora-icon.png', ImageApi);
    context.drawImage(logo, 74, 62, 64, 64);
  } catch {
    fillRoundedRect(context, 74, 62, 64, 64, 18, '#6375f4');
  }

  context.textBaseline = 'middle';
  context.fillStyle = '#111827';
  context.font = '900 34px Pretendard, "Noto Sans KR", sans-serif';
  context.fillText('Cora', 154, 94);
  context.fillStyle = '#596179';
  context.font = '750 24px Pretendard, "Noto Sans KR", sans-serif';
  context.fillText('반응속도 테스트 결과', 74, 183);

  context.fillStyle = '#111827';
  context.font = '900 92px Pretendard, "Noto Sans KR", sans-serif';
  context.fillText(String(average), 70, 290);
  const averageWidth = context.measureText(String(average)).width;
  context.fillStyle = '#6375f4';
  context.font = '850 34px Pretendard, "Noto Sans KR", sans-serif';
  context.fillText('ms', 82 + averageWidth, 306);
  context.fillStyle = '#7c8497';
  context.font = '750 20px Pretendard, "Noto Sans KR", sans-serif';
  context.fillText('5회 평균', 74, 356);

  fillRoundedRect(context, 70, 395, 500, 94, 18, '#ffffff');
  context.fillStyle = '#7c8497';
  context.font = '750 20px Pretendard, "Noto Sans KR", sans-serif';
  context.fillText('최고 기록', 96, 427);
  context.fillStyle = '#111827';
  context.font = '900 34px Pretendard, "Noto Sans KR", sans-serif';
  context.fillText(`${best} ms`, 96, 465);

  context.fillStyle = '#dce1f2';
  context.font = '800 21px Pretendard, "Noto Sans KR", sans-serif';
  context.fillText('5회 기록', 686, 98);
  context.fillStyle = '#aeb6ce';
  context.font = '700 17px Pretendard, "Noto Sans KR", sans-serif';
  context.fillText('낮을수록 빠른 기록', 929, 98);

  const chart = { x: 728, y: 168, width: 334, height: 238 };
  const minimum = Math.min(...trials);
  const maximum = Math.max(...trials);
  const lower = Math.max(0, minimum - 35);
  const upper = Math.max(lower + 70, maximum + 35);
  const xFor = (index) => chart.x + ((index / Math.max(1, trials.length - 1)) * chart.width);
  const yFor = (value) => getReactionChartY(value, { lower, upper, top: chart.y, height: chart.height });

  context.strokeStyle = '#e7e9f1';
  context.lineWidth = 2;
  for (let index = 0; index < 4; index += 1) {
    const y = chart.y + ((index / 3) * chart.height);
    context.beginPath();
    context.moveTo(chart.x, y);
    context.lineTo(chart.x + chart.width, y);
    context.stroke();
  }

  context.strokeStyle = '#6375f4';
  context.lineWidth = 7;
  context.lineCap = 'round';
  context.lineJoin = 'round';
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
    context.lineWidth = 5;
    context.beginPath();
    context.arc(x, y, 10, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = '#28336e';
    context.font = '800 16px Pretendard, "Noto Sans KR", sans-serif';
    context.textAlign = 'center';
    context.fillText(`${value}`, x, Math.max(148, y - 23));
  });
  context.textAlign = 'left';

  context.fillStyle = '#697188';
  context.font = '700 20px Pretendard, "Noto Sans KR", sans-serif';
  context.fillText('reaction.cora1022.com', 72, 552);
  context.fillStyle = '#aeb6ce';
  context.font = '700 18px Pretendard, "Noto Sans KR", sans-serif';
  context.fillText('단위: ms', 1024, 530);

  return canvasToBlob(canvas);
}
