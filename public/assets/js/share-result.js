export async function shareResult({
  title,
  text,
  url,
  imageBlob = null,
  imageName = 'cora-result.png',
}, environment = {}) {
  const navigatorApi = environment.navigatorApi ?? globalThis.navigator;
  const documentApi = environment.documentApi ?? globalThis.document;
  const FileApi = environment.FileApi ?? globalThis.File;
  const ClipboardItemApi = environment.ClipboardItemApi ?? globalThis.ClipboardItem;
  const BlobApi = environment.BlobApi ?? globalThis.Blob;
  const URLApi = environment.URLApi ?? globalThis.URL;
  const userAgent = navigatorApi?.userAgent ?? '';
  const mobileDevice = /Android|iPhone|iPad|iPod/i.test(userAgent)
    || (navigatorApi?.platform === 'MacIntel' && navigatorApi?.maxTouchPoints > 1);
  const copyText = `${text}\n${url}`;

  let imageFile = null;
  if (imageBlob && typeof FileApi === 'function') {
    try {
      imageFile = new FileApi([imageBlob], imageName, { type: imageBlob.type || 'image/png' });
    } catch {
      imageFile = null;
    }
  }

  if (mobileDevice && typeof navigatorApi?.share === 'function') {
    try {
      const canShareFile = imageFile
        && typeof navigatorApi.canShare === 'function'
        && navigatorApi.canShare({ files: [imageFile] });
      await navigatorApi.share(canShareFile
        ? { title, text, url, files: [imageFile] }
        : { title, text, url });
      return canShareFile ? 'image-shared' : 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
    }
  }

  if (
    imageBlob
    && typeof navigatorApi?.clipboard?.write === 'function'
    && typeof ClipboardItemApi === 'function'
  ) {
    try {
      const type = imageBlob.type || 'image/png';
      const clipboardData = { [type]: imageBlob };
      if (typeof BlobApi === 'function') {
        clipboardData['text/plain'] = new BlobApi([copyText], { type: 'text/plain' });
      }
      await navigatorApi.clipboard.write([new ClipboardItemApi(clipboardData)]);
      return 'image-copied';
    } catch {
      // 이미지 복사가 제한되면 다운로드 또는 텍스트 복사로 대체합니다.
    }
  }

  if (imageBlob && documentApi?.body && typeof URLApi?.createObjectURL === 'function') {
    try {
      const link = documentApi.createElement('a');
      const objectUrl = URLApi.createObjectURL(imageBlob);
      link.href = objectUrl;
      link.download = imageName;
      link.hidden = true;
      documentApi.body.appendChild(link);
      link.click();
      link.remove();
      globalThis.setTimeout?.(() => URLApi.revokeObjectURL(objectUrl), 0);
      return 'downloaded';
    } catch {
      // 다운로드할 수 없으면 아래의 텍스트 복사를 사용합니다.
    }
  }

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
