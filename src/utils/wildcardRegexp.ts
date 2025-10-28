const escapeRegExp = (str: string): string => str.replace(/[\\-\\[]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');

export const wildcardRegexp = (str: string, flags = 'i'): RegExp => {
  const parts = str.split('*').map(escapeRegExp);
  return new RegExp(`^${parts.join('.+')}$`, flags);
};
