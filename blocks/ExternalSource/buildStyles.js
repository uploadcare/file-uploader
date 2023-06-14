let styleToCss = (style) => {
  let css = Object.keys(style).reduce((acc, selector) => {
    let propertiesObj = style[selector];
    let propertiesStr = Object.keys(propertiesObj).reduce((acc, prop) => {
      let value = propertiesObj[prop];
      return acc + `${prop}: ${value};`;
    }, '');
    return acc + `${selector}{${propertiesStr}}`;
  }, '');
  return css;
};

export function buildStyles({ textColor, backgroundColor, linkColor, linkColorHover, shadeColor }) {
  let border = `solid 1px ${shadeColor}`;

  // TODO: we need to update source source styles, add css custom properties to control theme
  return styleToCss({
    body: {
      color: textColor,
      'background-color': backgroundColor,
    },
    '.side-bar': {
      background: 'inherit',
      'border-right': border,
    },
    '.main-content': {
      background: 'inherit',
    },
    '.main-content-header': {
      background: 'inherit',
    },
    '.main-content-footer': {
      background: 'inherit',
    },
    '.list-table-row': {
      color: 'inherit',
    },
    '.list-table-row:hover': {
      background: shadeColor,
    },
    '.list-table-row .list-table-cell-a, .list-table-row .list-table-cell-b': {
      'border-top': border,
    },
    '.list-table-body .list-items': {
      'border-bottom': border,
    },
    '.bread-crumbs a': {
      color: linkColor,
    },
    '.bread-crumbs a:hover': {
      color: linkColorHover,
    },
    '.main-content.loading': {
      background: `${backgroundColor} url(/static/images/loading_spinner.gif) center no-repeat`,
      'background-size': '25px 25px',
    },
    '.list-icons-item': {
      'background-color': shadeColor,
    },
    '.source-gdrive .side-bar-menu a, .source-gphotos .side-bar-menu a': {
      color: linkColor,
    },
    '.source-gdrive .side-bar-menu a, .source-gphotos .side-bar-menu a:hover': {
      color: linkColorHover,
    },
    '.side-bar-menu a': {
      color: linkColor,
    },
    '.side-bar-menu a:hover': {
      color: linkColorHover,
    },
    '.source-gdrive .side-bar-menu .current, .source-gdrive .side-bar-menu a:hover, .source-gphotos .side-bar-menu .current, .source-gphotos .side-bar-menu a:hover':
      {
        color: linkColorHover,
      },
    '.source-vk .side-bar-menu a': {
      color: linkColor,
    },
    '.source-vk .side-bar-menu a:hover': {
      color: linkColorHover,
      background: 'none',
    },
  });
}
