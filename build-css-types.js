import postcss from 'postcss';
import fs from 'fs';
import prettier from 'prettier';

const input = ['./blocks/themes/uc-basic/config.css'];

let base = {
  '--cfg-pubkey': 'String',
};

let types = new Map(Object.entries(base));

for (let filepath of input) {
  let css = fs.readFileSync(filepath).toString();
  let root = postcss.parse(css);
  root.walkDecls(/--cfg/, (decl) => {
    let value = JSON.parse(decl.value.replace(/\'/g, '"'));
    let type = '';
    if (typeof value === 'string') {
      type = 'String';
    } else if (typeof value === 'number') {
      type = 'Number';
    } else {
      console.warn(`Unknown type for property ${decl.prop}`);
    }
    if (types.has(decl.prop) && types.get(decl.prop) !== type) {
      console.warn(`Different types for property ${decl.prop}`);
    }
    types.set(decl.prop, type);
  });
}

let typeContent = `{
  ${[...types].map(([name, type]) => `'*${name}': ${type};`).join(' ')}
}`;

let content = `
/**
 * @typedef {${typeContent}} CssConfigTypes
 */
export {};
`;

prettier.resolveConfig('./').then((options) => {
  const formatted = prettier.format(content, options);
  fs.writeFileSync('./css-types.js', formatted);
});
