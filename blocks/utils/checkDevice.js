export const DeviceTypes = Object.freeze({
  iOS: 'iOS',
  Android: 'Android',
  WindowsPhone: 'Windows Phone',
  Desktop: 'Desktop',
});

export const checkDevice = () => {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;

  if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
    return DeviceTypes.iOS;
  }

  if (/android/i.test(userAgent)) {
    return DeviceTypes.Android;
  }

  if (/windows phone/i.test(userAgent)) {
    return DeviceTypes.WindowsPhone;
  }

  return DeviceTypes.Desktop;
};

export const isMobileDevice = () => {
  const deviceType = checkDevice();

  return deviceType !== DeviceTypes.Desktop;
};
