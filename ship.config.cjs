module.exports = {
  monorepo: {
    mainVersionFile: 'lerna.json',
    packagesToBump: ['upload-blocks', 'uploader', 'live-html'],
    packagesToPublish: ['upload-blocks', 'uploader', 'live-html'],
  },
  buildCommand: () => 'npm run build-libs',
};
