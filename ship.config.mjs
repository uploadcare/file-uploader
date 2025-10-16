export default {
  buildCommand: () => 'npm run build',
  publishCommand: ({ defaultCommand }) => `${defaultCommand} --access public`,
};
