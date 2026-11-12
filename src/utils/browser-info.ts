export const browserInfo = {
  safariDesktop: ((ua) =>
    /Macintosh|Windows/.test(ua) && /Version\/[\d.]+.*Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua))(
    navigator.userAgent,
  ),
};

export const browserFeatures = {
  htmlMediaCapture: 'capture' in document.createElement('input'),
};
