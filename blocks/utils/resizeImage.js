/**
 * @param {File} imgFile
 * @param {Number} [size]
 */
export function generateThumb(imgFile, size = 40) {
  if (imgFile.type === 'image/svg+xml') {
    return URL.createObjectURL(imgFile);
  }
  let canvas = document.createElement('canvas');
  let ctx = canvas.getContext('2d');
  let img = new Image();
  let promise = new Promise((resolve, reject) => {
    img.onload = () => {
      let ratio = img.height / img.width;
      if (ratio > 1) {
        canvas.width = size;
        canvas.height = size * ratio;
      } else {
        canvas.height = size;
        canvas.width = size / ratio;
      }
      ctx.fillStyle = 'rgb(240, 240, 240)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject();
          return;
        }
        let url = URL.createObjectURL(blob);
        resolve(url);
      });
    };
    img.onerror = (err) => {
      reject(err);
    };
  });
  img.src = URL.createObjectURL(imgFile);
  return promise;
}
