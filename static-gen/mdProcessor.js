import { marked } from 'marked';

export function mdProcessor(md) {
  return marked(md);
}
