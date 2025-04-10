// @ts-check

const calcIsDesktopSafari = () => {
  const ua = navigator.userAgent;
  return /Macintosh|Windows/.test(ua) && /Version\/[\d\.]+.*Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua);
};

const calcHtmlMediaCaptureSupport = () => {
  return 'capture' in document.createElement('input');
};

export const calcBrowserInfo = () => ({
  safariDesktop: calcIsDesktopSafari(),
});

export const calcBrowserFeatures = () => ({
  htmlMediaCapture: calcHtmlMediaCaptureSupport(),
});

export const browserInfo = calcBrowserInfo();

export const browserFeatures = calcBrowserFeatures();
