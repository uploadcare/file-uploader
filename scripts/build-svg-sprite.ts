import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import SVGSpriter from 'svg-sprite';

type SpriteItem = { input: string; output: string };

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const DATA: SpriteItem[] = [
  {
    input: path.resolve(__dirname, '../src/blocks/CloudImageEditor/src/icons/'),
    output: path.resolve(__dirname, '../src/blocks/CloudImageEditor/src/svg-sprite.ts'),
  },
  {
    input: path.resolve(__dirname, '../src/blocks/themes/uc-basic/icons/'),
    output: path.resolve(__dirname, '../src/blocks/themes/uc-basic/svg-sprite.ts'),
  },
];

const config: any = {
  mode: {
    symbol: {
      inline: true,
    },
  },
  shape: {
    id: {
      generator: (name: string) => `uc-icon-${name.replace(/\.svg$/, '')}`,
    },
    transform: [
      {
        svgo: {
          // multipass + slightly more aggressive cleanup; icons are decorative
          // (aria-hidden on <uc-icon>) so xmlns/dimensions can go. Keeps viewBox.
          multipass: true,
          plugins: [
            {
              name: 'preset-default',
              params: {
                overrides: {
                  // viewBox is required for scaled symbol sprites
                  removeViewBox: false,
                },
              },
            },
            'removeDimensions',
            'removeXMLNS',
            {
              name: 'cleanupNumericValues',
              params: { floatPrecision: 1 },
            },
            {
              name: 'convertPathData',
              params: { floatPrecision: 1 },
            },
            {
              name: 'prefixIds',
              params: {
                prefix: 'uc-icon-id',
              },
            },
          ],
        },
      },
    ],
  },
};

/**
 * Collapse byte-identical gradient definitions and repoint every reference at
 * the survivor. Design exports routinely emit one `<linearGradient>` per path
 * even when all of them are the same definition in the same coordinate space
 * (`vibrance.svg` shipped 8 identical copies), and SVGO has no plugin for it —
 * `removeUselessDefs` only drops *unreferenced* defs. Runs on the assembled
 * sprite, after `prefixIds` has made ids unique per icon, so duplicates within
 * one icon and across icons are both caught.
 */
function dedupeGradients(sprite: string): string {
  const defRe = /<(linearGradient|radialGradient)\s+id="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/g;
  const survivorByShape = new Map<string, string>();
  const replacementById = new Map<string, string>();

  for (const [, tag, id, attrs, body] of sprite.matchAll(defRe)) {
    // Everything but the id decides identity: same element, same attributes,
    // same stops = same paint.
    const shape = `${tag}|${attrs.trim()}|${body}`;
    const survivor = survivorByShape.get(shape);
    if (survivor) {
      replacementById.set(id, survivor);
    } else {
      survivorByShape.set(shape, id);
    }
  }

  if (replacementById.size === 0) {
    return sprite;
  }

  let out = sprite.replace(defRe, (whole, _tag, id: string) => (replacementById.has(id) ? '' : whole));
  for (const [duplicate, survivor] of replacementById) {
    out = out.replaceAll(`url(#${duplicate})`, `url(#${survivor})`);
  }
  console.log(`Deduped ${replacementById.size} identical gradient definition(s)`);
  return out;
}

console.log('Generating SVG sprite...');

DATA.forEach((item: SpriteItem) => {
  const spriter = new SVGSpriter(config);

  fs.readdir(item.input, (err: NodeJS.ErrnoException | null, files: string[]) => {
    if (err) {
      throw err;
    }

    console.log(`Processing ${item.input}...`);

    files.forEach((file: string) => {
      const filePath = path.resolve(item.input, file);
      console.log(`Icon processed: ${filePath}`);
      spriter.add(filePath, null, fs.readFileSync(filePath, { encoding: 'utf-8' }));
    });

    spriter.compile((error, result) => {
      if (error) {
        throw error;
      }

      const spriteContents = dedupeGradients(result.symbol.sprite.contents.toString());
      const jsTemplate = `export default "${spriteContents.replace(/"/g, "'")}";`.trim().concat('\n');

      fs.writeFileSync(item.output, jsTemplate);
    });
  });
});
