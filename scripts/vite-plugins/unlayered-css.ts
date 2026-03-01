import fs from 'node:fs/promises';
import path, { dirname, join } from 'node:path';
import postcss from 'postcss';
import postcssCascadeLayers from '@csstools/postcss-cascade-layers';

export const unlayeredCss = (buildItem) => ({
  name: 'unlayered-css',
  apply: 'build',
  async writeBundle(_, bundle) {
    const cssFiles = Object.values(bundle).filter((f: any) => f.type === 'asset' && f.fileName.endsWith('.css'));

    for (const file of cssFiles) {
      const absPath = path.join(buildItem.outDir, file.fileName);

      const fileDir = path.dirname(absPath);
      const baseName = path.basename(absPath);
      const [namePart, ...restParts] = baseName.split('.');
      const layeredName = [`${namePart}.layered`, ...restParts].join('.');
      const layeredPath = join(fileDir, layeredName);

      await fs.copyFile(absPath, layeredPath);

      const cssContent = await fs.readFile(absPath, 'utf-8');

      const processed = await postcss([postcssCascadeLayers()]).process(cssContent, {
        from: absPath,
        to: absPath,
      });

      await fs.writeFile(absPath, processed.css);
    }
  },
});
