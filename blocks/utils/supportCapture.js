export const isSupportCapture = () => {
  return 'capture' in document.createElement('input');
};
