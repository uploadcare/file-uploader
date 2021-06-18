const hlChars = [
  '=',
  '#',
  '$',
  '|',
  '{',
  '}',
  `'`,
  '`',
  `:`,
  `.`,
  `,`,
  `(`,
  `)`,
  `[`,
  `]`,
  '&lt;&sol;',
  '&lt;',
  '&gt;',
  '&semi;',
  '&quot;',
];

export function highlight(src) {
  src = src
    .replace(/;/g, '&semi;') // must be on a first place
    .replace(/\//g, '&sol;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  
  hlChars.forEach((char) => {
    src = src.split(char).join(`<span class="hl">${char}</span>`);
  });

  src = src
    .split('&sol;*').join('<span class="comment">&sol;*')
    .split('*&sol;').join('*&sol;</span>')
    .split('&sol;&sol; ').map((subStr, idx) => {
      return idx ? subStr.replace('\n', '</span>\n') : subStr;
    }).join('<span class="comment">&sol;&sol; ');
  return src;
};
