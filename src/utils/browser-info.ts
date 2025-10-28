const calcIsDesktopSafari = (): boolean => {
  const ua = navigator.userAgent;
  return /Macintosh|Windows/.test(ua) && /Version\/[\d.]+.*Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua);
};

const calcHtmlMediaCaptureSupport = (): boolean => {
  return 'capture' in document.createElement('input');
};

export const calcBrowserInfo = (): { safariDesktop: boolean } => ({
  safariDesktop: calcIsDesktopSafari(),
});

export const calcBrowserFeatures = (): { htmlMediaCapture: boolean } => ({
  htmlMediaCapture: calcHtmlMediaCaptureSupport(),
});

export const browserInfo = calcBrowserInfo();

export const browserFeatures = calcBrowserFeatures();
