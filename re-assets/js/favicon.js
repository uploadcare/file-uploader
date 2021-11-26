const link = document.createElement('link');
link.rel = 'icon';
const icon = function () {
  let icons = ['🟡', '🟢', '🔴', '🔵', '🟣'];
  return icons[Math.round(Math.random() * (icons.length - 1))];
};
let svg = function () {
  return /*svg*/ `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <text x="0" y="80" font-size="90">${unescape(encodeURIComponent(icon()))}</text>
</svg>`;
};
document.head.appendChild(link);

window.setInterval(() => {
  link.href = `data:image/svg+xml;base64,${btoa(svg())}`;
}, 1000);
