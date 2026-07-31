const measurementId = 'G-PHEXQ6C1M0';
const consentCookieName = 'cora1022-analytics-consent';
const legacyConsentKey = 'cora-reaction:analytics-consent:v1';
const banner = document.querySelector('[data-consent]');
const bannerMessage = document.querySelector('[data-consent-message]');

function loadAnalytics() {
  if (document.querySelector('[data-ga4]')) return;
  const script = document.createElement('script');
  script.async = true;
  script.dataset.ga4 = 'true';
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, { anonymize_ip: true });
}

function cookieAttributes() {
  const domain = location.hostname === 'cora1022.com' || location.hostname.endsWith('.cora1022.com') ? '; Domain=cora1022.com' : '';
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  return `; Path=/; Max-Age=31536000; SameSite=Lax${domain}${secure}`;
}

function readCookie() {
  const prefix = `${consentCookieName}=`;
  const entry = document.cookie.split('; ').find((item) => item.startsWith(prefix));
  if (!entry) return null;
  const value = decodeURIComponent(entry.slice(prefix.length));
  return ['granted', 'denied', 'prompt'].includes(value) ? value : null;
}

function writeCookie(value) {
  document.cookie = `${consentCookieName}=${encodeURIComponent(value)}${cookieAttributes()}`;
}

function readConsent() {
  const shared = readCookie();
  if (shared !== null) {
    try { localStorage.removeItem(legacyConsentKey); } catch { /* 공통 쿠키를 우선합니다. */ }
    return shared;
  }
  let legacy = null;
  try { legacy = localStorage.getItem(legacyConsentKey); } catch { /* 통계 없이 계속합니다. */ }
  if (legacy === 'granted' || legacy === 'denied') {
    writeCookie(legacy);
    try { localStorage.removeItem(legacyConsentKey); } catch { /* 공통 쿠키를 우선합니다. */ }
    return legacy;
  }
  return null;
}

function choose(value) {
  const analyticsWasLoaded = Boolean(document.querySelector('[data-ga4]'));
  writeCookie(value);
  if (banner) banner.hidden = true;
  if (value === 'granted') loadAnalytics();
  else if (analyticsWasLoaded) location.reload();
}

const saved = readConsent();
if (saved === 'granted') loadAnalytics();
else if (saved !== 'denied' && banner) banner.hidden = false;

document.querySelector('[data-consent-accept]')?.addEventListener('click', () => choose('granted'));
document.querySelector('[data-consent-reject]')?.addEventListener('click', () => choose('denied'));
document.querySelectorAll('[data-consent-settings]').forEach((button) => {
  button.addEventListener('click', () => {
    if (!banner) return;
    banner.hidden = false;
    bannerMessage?.focus();
  });
});
document.querySelectorAll('[data-year]').forEach((element) => {
  element.textContent = new Date().getFullYear();
});
