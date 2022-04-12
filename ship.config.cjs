module.exports = {
  buildCommand: () => 'npm run build',
  publishCommand: ({ defaultCommand }) => `${defaultCommand} --access public`,
};
