export const renameOutput = (buildItem) => ({
  name: 'rename-output',
  generateBundle(_, bundle) {
    if (buildItem.cssFilename) {
      const cssKeys = Object.keys(bundle).filter((key) => key.endsWith('.css'));
      if (cssKeys.length > 1) {
        throw new Error('Multiple CSS files generated, cannot rename.');
      }
      if (cssKeys.length === 1) {
        const oldKey = cssKeys[0];
        const asset = bundle[oldKey];
        delete bundle[oldKey];
        asset.fileName = buildItem.cssFilename;
        bundle[buildItem.cssFilename] = asset;
      }
    }
  },
})
