export default {
  buildCommand: () => 'npm run build',
  publishCommand: ({ tag }) => `npm stage publish --tag ${tag}`,
};
