function createSvgBlobUrl(svg: string): string {
  const blob = new Blob([svg], {
    type: 'image/svg+xml',
  });
  return URL.createObjectURL(blob);
}

export function fileCssBg(color = 'hsl(209, 21%, 65%)', width = 32, height = 32): string {
  return createSvgBlobUrl(/*svg*/ `
  <svg width="${width}" height="${height}" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill-rule="evenodd" fill="${color}" d="M9.69 8.7C9.69 8.42 9.91 8.2 10.19 8.2H15.09C15.22 8.2 15.35 8.25 15.44 8.35L20.34 13.25C20.44 13.34 20.49 13.47 20.49 13.6V21.3C20.49 21.58 20.26 21.8 19.99 21.8H10.19C9.91 21.8 9.69 21.58 9.69 21.3V8.7ZM10.69 9.2V20.8H19.49V14.1L15.09 14.1C14.81 14.1 14.59 13.88 14.59 13.6L14.59 9.2H10.69ZM15.59 9.91L18.78 13.1L15.59 13.1L15.59 9.91Z"/>
  </svg>
  `);
}
