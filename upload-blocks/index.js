import * as UC from './exports.js';

export function register() {
  for (let blockName in UC) {
    let tagName = [...blockName].reduce((name, char) => {
      if (char.toUpperCase() === char) {
        char = '-' + char.toLowerCase();
      }
      return (name += char);
    }, '');
    if (tagName.startsWith('-')) {
      tagName = tagName.replace('-', '');
    }
    console.log(tagName);
    UC[blockName].reg(tagName);
  }
}

if (typeof window !== 'undefined') {
  // TODO: should we register components automatically?
  register();
}
