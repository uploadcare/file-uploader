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
          plugins: [
            {
              name: 'preset-default',
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

      const jsTemplate = `export default "${result.symbol.sprite.contents.toString().replace(/"/g, "'")}";`
        .trim()
        .concat('\n');

      fs.writeFileSync(item.output, jsTemplate);
    });
  });
});
