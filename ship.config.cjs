module.exports = {
  monorepo: {
    mainVersionFile: 'lerna.json',
    packagesToBump: ['upload-blocks'],
    packagesToPublish: ['upload-blocks'],
  },
  buildCommand: () => 'npm run build-libs',
};
