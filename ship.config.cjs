module.exports = {
  monorepo: {
    mainVersionFile: 'lerna.json',
    packagesToBump: ['upload-blocks', 'uploader'],
    packagesToPublish: ['upload-blocks', 'uploader'],
  },
  buildCommand: () => 'npm run build-libs',
};
