const manualAdsEnabled = false;

if (manualAdsEnabled) {
  document.querySelectorAll('[data-ad-position]').forEach((slot) => {
    slot.hidden = false;
  });
}

