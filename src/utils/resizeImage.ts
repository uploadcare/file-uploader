export function generateThumb(
  imgFile: File,
  size: number = 40,
): string | Promise<string> {
  if (imgFile.type === "image/svg+xml") {
    // TODO: Return destuctor here
    return URL.createObjectURL(imgFile);
  }
  const canvas: HTMLCanvasElement = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return Promise.reject(new Error("Canvas context not supported"));
  }
  const img = new Image();
  const promise: Promise<string> = new Promise<string>((resolve, reject) => {
    img.onload = () => {
      const ratio = img.height / img.width;
      if (ratio > 1) {
        canvas.width = size;
        canvas.height = size * ratio;
      } else {
        canvas.height = size;
        canvas.width = size / ratio;
      }
      ctx.fillStyle = "rgb(240, 240, 240)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob: Blob | null) => {
        if (!blob) {
          reject();
          return;
        }
        const url = URL.createObjectURL(blob);
        resolve(url);
      });
    };
    img.onerror = (err: unknown) => {
      reject(err);
    };
  });
  img.src = URL.createObjectURL(imgFile);
  return promise;
}
