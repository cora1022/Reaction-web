export async function shareResult({ title, text, url }, environment = {}) {
  const navigatorApi = environment.navigatorApi ?? globalThis.navigator;
  const documentApi = environment.documentApi ?? globalThis.document;
  const userAgent = navigatorApi?.userAgent ?? '';
  const mobileDevice = /Android|iPhone|iPad|iPod/i.test(userAgent)
    || (navigatorApi?.platform === 'MacIntel' && navigatorApi?.maxTouchPoints > 1);

  if (mobileDevice && typeof navigatorApi?.share === 'function') {
    try {
      await navigatorApi.share({ title, text, url });
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
    }
  }

  const copyText = `${text}\n${url}`;
  if (typeof navigatorApi?.clipboard?.writeText === 'function') {
    try {
      await navigatorApi.clipboard.writeText(copyText);
      return 'copied';
    } catch {
      // 권한이 없으면 아래의 호환 복사 방식을 사용합니다.
    }
  }

  if (documentApi?.body && typeof documentApi.execCommand === 'function') {
    const textarea = documentApi.createElement('textarea');
    textarea.value = copyText;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    documentApi.body.appendChild(textarea);
    textarea.select();
    const copied = documentApi.execCommand('copy');
    textarea.remove();
    if (copied) return 'copied';
  }

  return 'unavailable';
}
