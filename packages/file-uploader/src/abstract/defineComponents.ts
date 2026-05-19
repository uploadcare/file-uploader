const EXCLUDE_COMPONENTS = ['UploaderBlock', 'ActivityBlock', 'Block', 'SolutionBlock'];

export function defineComponents(blockExports: Record<string, any>) {
  for (const blockName in blockExports) {
    if (EXCLUDE_COMPONENTS.includes(blockName)) {
      continue;
    }
    let tagName = [...blockName].reduce((name, char) => {
      if (char.toUpperCase() === char) {
        char = `-${char.toLowerCase()}`;
      }
      name += char;
      return name;
    }, '');
    if (tagName.startsWith('-')) {
      tagName = tagName.replace('-', '');
    }

    if (!tagName.startsWith('uc-')) {
      tagName = `uc-${tagName}`;
    }
    if (blockExports[blockName].reg) {
      blockExports[blockName].reg(tagName);
    }
  }
}
