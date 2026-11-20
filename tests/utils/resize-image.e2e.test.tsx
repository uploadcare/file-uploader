import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { generateThumb } from '../../src/utils/resizeImage';

type Painter = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

const fillWith =
  (color: string): Painter =>
  (ctx, width, height) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
  };

const makeImage = (width: number, height: number, type: string, paint: Painter = fillWith('red')): Promise<Blob> => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d')!, width, height);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob!), type, 1));
};

/**
 * An APP1 Exif segment whose only tag is Orientation = 6: the stored pixels are the picture turned 90° to the left,
 * so a viewer turns them back and the stored left edge becomes the top.
 */
// biome-ignore format: one row per structure in the segment
const EXIF_ORIENTATION_6 = new Uint8Array([
  0xff, 0xe1, 0x00, 0x22, // APP1, length 34
  0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
  0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // big-endian TIFF header, IFD0 at offset 8
  0x00, 0x01, // one entry
  0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x06, 0x00, 0x00, // Orientation, SHORT, count 1, value 6
  0x00, 0x00, 0x00, 0x00, // no next IFD
]);

/** Stored 80x40 with the left half red and the right half blue: shown upright it is 40x80, red above blue. */
const makeRotatedJpeg = async ({ tagged = true } = {}): Promise<Blob> => {
  const jpeg = await makeImage(80, 40, 'image/jpeg', (ctx) => {
    ctx.fillStyle = 'red';
    ctx.fillRect(0, 0, 40, 40);
    ctx.fillStyle = 'blue';
    ctx.fillRect(40, 0, 40, 40);
  });
  // Right after the SOI marker.
  return tagged ? new Blob([jpeg.slice(0, 2), EXIF_ORIENTATION_6, jpeg.slice(2)], { type: 'image/jpeg' }) : jpeg;
};

const readThumb = async (url: string) => {
  onTestFinished(() => URL.revokeObjectURL(url));
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);
  return {
    width: image.naturalWidth,
    height: image.naturalHeight,
    pixel: (x: number, y: number) => Array.from(ctx.getImageData(x, y, 1, 1).data),
  };
};

/** Makes the thumbnail and tells what its canvas was painted from. */
const generateThumbSpied = async (file: Blob, size?: number) => {
  const drawImage = vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage');
  onTestFinished(() => drawImage.mockRestore());
  const url = await generateThumb(file, size);
  const drawnFrom = drawImage.mock.calls.map(([source]) => source.constructor.name);
  drawImage.mockRestore();
  return { thumb: await readThumb(url), drawnFrom };
};

const stubCreateImageBitmap = (stub: unknown) => {
  vi.stubGlobal('createImageBitmap', stub);
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
};

const PATHS: [name: string, drawnFrom: string, prepare: () => void][] = [
  ['createImageBitmap', 'ImageBitmap', () => {}],
  ['the <img> fallback', 'HTMLImageElement', () => stubCreateImageBitmap(undefined)],
];

describe.each(PATHS)('generateThumb through %s', (_, drawnFrom, prepare) => {
  it.each([
    ['landscape', 200, 100, 80, 40],
    ['portrait', 100, 200, 40, 80],
    ['square', 120, 120, 40, 40],
    ['landscape with a fractional long side', 300, 130, 92, 40],
    ['portrait with a fractional long side', 130, 300, 40, 92],
  ])('makes the shorter side of a %s image 40px', async (_shape, width, height, thumbWidth, thumbHeight) => {
    prepare();

    const { thumb, drawnFrom: sources } = await generateThumbSpied(await makeImage(width, height, 'image/png'));

    expect([thumb.width, thumb.height]).toEqual([thumbWidth, thumbHeight]);
    expect(thumb.pixel(thumbWidth - 1, thumbHeight - 1)).toEqual([255, 0, 0, 255]);
    expect(sources).toEqual([drawnFrom]);
  });

  it('takes the size as the second argument', async () => {
    prepare();

    const thumb = await readThumb(await generateThumb(await makeImage(200, 100, 'image/png'), 20));

    expect([thumb.width, thumb.height]).toEqual([40, 20]);
  });

  it('puts a grey background under a transparent image', async () => {
    prepare();

    const thumb = await readThumb(await generateThumb(await makeImage(200, 100, 'image/png', () => {})));

    expect(thumb.pixel(40, 20)).toEqual([240, 240, 240, 255]);
  });

  it('shows a jpeg with an EXIF orientation upright', async () => {
    prepare();

    const { thumb, drawnFrom: sources } = await generateThumbSpied(await makeRotatedJpeg(), 20);

    // Stored 80x40: an unrotated thumbnail would be 40x20.
    expect([thumb.width, thumb.height]).toEqual([20, 40]);
    const [topRed, , topBlue] = thumb.pixel(10, 5);
    const [bottomRed, , bottomBlue] = thumb.pixel(10, 35);
    expect(topRed).toBeGreaterThan(200);
    expect(topBlue).toBeLessThan(50);
    expect(bottomRed).toBeLessThan(50);
    expect(bottomBlue).toBeGreaterThan(200);
    expect(sources).toEqual([drawnFrom]);
  });

  it('rejects for a file that is not an image', async () => {
    prepare();

    await expect(generateThumb(new File(['not an image'], 'broken.jpg', { type: 'image/jpeg' }))).rejects.toThrow();
  });
});

describe('generateThumb', () => {
  it('asks for a bitmap decoded upright and resized by its shorter side, and closes it', async () => {
    const createBitmap = vi.spyOn(globalThis, 'createImageBitmap');
    const close = vi.spyOn(ImageBitmap.prototype, 'close');
    onTestFinished(() => {
      vi.restoreAllMocks();
    });
    const landscape = await makeImage(200, 100, 'image/png');
    const portrait = await makeImage(100, 200, 'image/png');

    onTestFinished(async () => URL.revokeObjectURL(await landscapeThumb));
    onTestFinished(async () => URL.revokeObjectURL(await portraitThumb));
    const landscapeThumb = generateThumb(landscape);
    const portraitThumb = generateThumb(portrait);
    await Promise.all([landscapeThumb, portraitThumb]);

    const upright = { imageOrientation: 'from-image', resizeQuality: 'medium' };
    expect(createBitmap.mock.calls).toEqual([
      [landscape, { ...upright, resizeHeight: 40 }],
      [portrait, { ...upright, resizeWidth: 40 }],
    ]);
    expect(close).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['rejects', () => Promise.reject(new DOMException('unsupported', 'InvalidStateError'))],
    // A browser that drops the resize options answers with the full-size picture.
    ['ignores the resize options', (blob: Blob) => createImageBitmap(blob)],
    // One that drops `imageOrientation` answers with the stored pixels, which lie on their side: what the same
    // jpeg without the tag decodes to.
    [
      'ignores the orientation',
      async (_blob: Blob, options: ImageBitmapOptions) =>
        createImageBitmap(await makeRotatedJpeg({ tagged: false }), options),
    ],
  ])('falls back to the <img> when createImageBitmap %s', async (_, stub) => {
    const original = createImageBitmap;
    const close = vi.spyOn(ImageBitmap.prototype, 'close');
    onTestFinished(() => close.mockRestore());
    const calls: unknown[] = [];
    stubCreateImageBitmap((blob: Blob, options: ImageBitmapOptions) => {
      calls.push(blob);
      // The stubs above reach the real one through the global.
      vi.stubGlobal('createImageBitmap', original);
      return stub(blob, options);
    });

    const { thumb, drawnFrom } = await generateThumbSpied(await makeRotatedJpeg(), 20);

    expect(calls).toHaveLength(1);
    expect([thumb.width, thumb.height]).toEqual([20, 40]);
    expect(thumb.pixel(10, 5)[0]).toBeGreaterThan(200);
    expect(drawnFrom).toEqual(['HTMLImageElement']);
    // A bitmap that came back wrong is still released.
    expect(close).toHaveBeenCalledTimes(_ === 'rejects' ? 0 : 1);
  });

  it('draws a very elongated image itself, where a resized bitmap would be upscaled to a huge one', async () => {
    // Shorter side 2px scaled up to 40 is 20 times: the longer side would be asked for at 12,000px.
    const strip = await makeImage(2, 600, 'image/png');
    const createImageBitmap = vi.spyOn(globalThis, 'createImageBitmap');
    onTestFinished(() => createImageBitmap.mockRestore());

    const thumb = await readThumb(await generateThumb(strip, 40));

    expect(createImageBitmap).not.toHaveBeenCalled();
    expect(thumb.width).toBe(40);
  });

  it('returns an object url of the file itself for an svg', async () => {
    const createBitmap = vi.spyOn(globalThis, 'createImageBitmap');
    const createObjectURL = vi.spyOn(URL, 'createObjectURL');
    onTestFinished(() => {
      vi.restoreAllMocks();
    });
    const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'], 'a.svg', {
      type: 'image/svg+xml',
    });

    const url = await generateThumb(svg);
    onTestFinished(() => URL.revokeObjectURL(url));

    expect(createObjectURL.mock.calls).toEqual([[svg]]);
    expect(url).toBe(createObjectURL.mock.results[0]?.value);
    expect(await (await fetch(url)).text()).toBe(await svg.text());
    expect(createBitmap).not.toHaveBeenCalled();
  });

  it('leaves no object url behind but the thumbnail', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL');
    onTestFinished(() => {
      vi.restoreAllMocks();
    });

    const url = await generateThumb(await makeImage(200, 100, 'image/png'));
    onTestFinished(() => URL.revokeObjectURL(url));

    const created = createObjectURL.mock.results.map((result) => result.value);
    const revoked = revokeObjectURL.mock.calls.map(([revokedUrl]) => revokedUrl);
    expect(created.filter((createdUrl) => !revoked.includes(createdUrl))).toEqual([url]);
  });
});
