/** @param {Object<string, any>} blockExports */
export function registerBlocks(blockExports) {
  for (let blockName in blockExports) {
    let tagName = [...blockName].reduce((name, char) => {
      if (char.toUpperCase() === char) {
        char = '-' + char.toLowerCase();
      }
      return (name += char);
    }, '');
    if (tagName.startsWith('-')) {
      tagName = tagName.replace('-', '');
    }

    let currentTagName = '';
    if (!tagName.startsWith('uc-')) {
      currentTagName = addPrefix('uc-', tagName);
    }

    let legacyTagName = '';
    if (!tagName.startsWith('lr-')) {
      legacyTagName = addPrefix('lr-', tagName);
    }

    if (blockExports[blockName].reg) {
      blockExports[blockName].reg(currentTagName);
      blockExports[blockName].reg(legacyTagName, true);
    }
  }
}

const addPrefix = (prefix, name) => prefix + name;
