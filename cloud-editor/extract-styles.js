import fg from 'fast-glob';
import parser from '@babel/parser';
import fs from 'fs';
import traverse from '@babel/traverse';
import osPath from 'path';
import jsBeautify from 'js-beautify';

let cssBeautify = jsBeautify.css;

function camelCaseToDash(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function extractFromExpressionNode(node) {
  let styleObj = {};

  for (let prop of node.properties) {
    if (prop.type !== 'ObjectProperty') {
      console.log(prop);
      console.log('2UNKNOWN NODE TYPE', prop.type);
      continue;
    }
    let token = prop.key.name || prop.key.value;
    let objValue = prop.value;
    styleObj[token] = {};
    for (let prop of objValue.properties) {
      let key = prop.key.name || prop.key.value;
      let value = prop.value.value;
      styleObj[token][key] = value;
    }
  }

  return styleObj;
}

function extractFromImportPath(filepath, ast, path) {
  let styleObj = {};
  let name = path.node.right.name;
  let node = path.scope.bindings[name].path.node;
  traverse.default(ast, {
    ImportSpecifier: (path) => {
      if (path.node.imported.name === node.imported.name) {
        path.findParent((path) => {
          if (path.node.type === 'ImportDeclaration') {
            let importFromPath = path.node.source.value;
            let relativePath = osPath.join(osPath.dirname(filepath), importFromPath);
            let code = fs.readFileSync(relativePath).toString();
            let ast = parser.parse(code, { sourceType: 'module' });
            traverse.default(ast, {
              VariableDeclarator: (path) => {
                if (path.node.id.name === name) {
                  styleObj = extractFromExpressionNode(path.node.init);
                }
              },
            });
          }
        });
      }
    },
  });
  return styleObj;
}

function processIdentifierPath(filepath, ast, path) {
  let styleObj = {};
  let name = path.node.right.name;
  let node = path.scope.bindings[name].path.node;
  if (node.type === 'VariableDeclarator') {
    styleObj = extractFromExpressionNode(node.init);
  } else if (node.type === 'ImportSpecifier') {
    styleObj = extractFromImportPath(filepath, ast, path);
  } else {
    console.log('3UNKNOWN NODE TYPE', node.type);
  }
  return styleObj;
}

function processInlineExpressionPath(path) {
  let node = path.node.right;
  return extractFromExpressionNode(node);
}

function processFile(filepath) {
  let styles = [];
  let code = fs.readFileSync(filepath).toString();
  let ast = parser.parse(code, { sourceType: 'module' });
  traverse.default(ast, {
    AssignmentExpression: (path) => {
      if (path.node.left.property?.name === 'styles') {
        let componentName = path.node.left.object.name;
        let styleObj;
        if (path.node.right.type === 'Identifier') {
          styleObj = processIdentifierPath(filepath, ast, path);
        } else if (path.node.right.type === 'ObjectExpression') {
          styleObj = processInlineExpressionPath(path);
        } else {
          console.log('1UNKNOWN NODE TYPE', path.node.right.type);
        }
        styles.push({
          componentName,
          styles: styleObj,
        });
      }
    },
  });
  return styles;
}

function convertToCss(stylesObj) {
  let css = '';
  for (let { componentName, styles } of stylesObj) {
    Object.keys(styles).forEach((token) => {
      if (token === ':host') {
        css += `${camelCaseToDash(componentName)} {`;
      } else {
        css += `${camelCaseToDash(componentName)} .${token} {`;
      }
      let style = styles[token];
      Object.keys(style).forEach((key) => {
        let value = style[key];
        css += `${camelCaseToDash(key)}: ${value};`;
      });
      css += `}`;
    });
  }
  return cssBeautify(css);
}

(async function () {
  let sourceFiles = fg.sync('./src/**/*.js');
  let styles = [];
  for (let filepath of sourceFiles) {
    styles = [...styles, ...processFile(filepath)];
  }
  let css = convertToCss(styles);
  fs.writeFileSync('./src/css/editor.css', css);
})();
