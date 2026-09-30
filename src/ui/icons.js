// Иконки интерфейса: простые SVG в сетке 16×16, рисуются «currentColor».
const P = (d, extra = '') => `<path d="${d}" ${extra}/>`;
const svg = (body) => `<svg class="ico" viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  shield: svg(P('M3 2h10v7l-2 3-3 2-3-2-2-3z') + P('M5 4h6v4l-1.5 2.4L8 11.6 6.5 10.4 5 8z', 'fill="#000" opacity=".28"')),
  flame: svg(P('M8 1c1 3 4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 2-4 0 1 1 2 1 2 1-2 1-4 1-6z') + P('M8 8c1 1 2 2 2 3a2 2 0 0 1-4 0c0-1 1-2 2-3z', 'fill="#fff" opacity=".5"')),
  moon: svg(P('M9 1a7 7 0 1 0 6 10A6 6 0 0 1 9 1z')),
  bolt: svg(P('M9 1 3 9h4l-1 6 7-9H9z')),
  trash: svg(P('M5 1h6v2h4v2H1V3h4z') + P('M3 6h10l-1 9H4z') + P('M6 8h1v5H6zm3 0h1v5H9z', 'fill="#000" opacity=".3"')),
  lock: svg(P('M4 7V5a4 4 0 0 1 8 0v2h1v8H3V7zm2 0h4V5a2 2 0 0 0-4 0z')),
  cpu: svg(P('M4 4h8v8H4z') + P('M6 6h4v4H6z', 'fill="#000" opacity=".35"') + P('M6 1h1v3H6zm3 0h1v3H9zM6 12h1v3H6zm3 0h1v3H9zM1 6h3v1H1zm0 3h3v1H1zm11-3h3v1h-3zm0 3h3v1h-3z')),
  ram: svg(P('M1 4h14v7H1z') + P('M3 6h2v3H3zm4 0h2v3H7zm4 0h2v3h-2z', 'fill="#000" opacity=".35"') + P('M2 11h1v2H2zm3 0h1v2H5zm3 0h1v2H8zm3 0h1v2h-1z')),
  disk: svg(P('M2 2h10l2 2v10H2z') + P('M4 2h6v4H4z', 'fill="#000" opacity=".3"') + P('M4 9h8v5H4z', 'fill="#000" opacity=".25"')),
  net: svg(P('M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 2c1 1 2 3 2 5s-1 4-2 5c-1-1-2-3-2-5s1-4 2-5z', 'fill-rule="evenodd"')),
  heart: svg(P('M2 3h4l2 2 2-2h4v5l-6 6-6-6z')),
  sword: svg(P('M13 1h2v2L7 11l-2-2zM3 10l3 3-2 2-1-1-1-1 1-1z')),
  folder: svg(P('M1 3h5l2 2h7v9H1z')),
  file: svg(P('M3 1h7l3 3v11H3z') + P('M10 1v3h3z', 'fill="#000" opacity=".3"')),
  zip: svg(P('M3 1h7l3 3v11H3z') + P('M7 2h2v1H7zm0 2h2v1H7zm0 2h2v1H7zm0 2h2v3H7z', 'fill="#000" opacity=".45"')),
  gear: svg(P('M7 1h2l1 2 2 1 2-1 1 2-1 2 0 2 1 2-1 2-2-1-2 1-1 2H7l-1-2-2-1-2 1-1-2 1-2V7L1 5l1-2 2 1 2-1zM8 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z', 'fill-rule="evenodd"')),
  star: svg(P('M8 1l2 5h5l-4 3 2 6-5-4-5 4 2-6-4-3h5z')),
  cursor: svg(P('M3 1v12l3-3 2 5 2-1-2-5h4z')),
  key: svg(P('M2 6a3 3 0 1 1 6 1l7 6v2h-3v-1h-1v-1h-1l-2-2a3 3 0 0 1-6-5zm2 0a1 1 0 1 0 2 0 1 1 0 0 0-2 0z', 'fill-rule="evenodd"')),
  coin: svg(P('M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-1 3h2v1h2v2H9v2h2v2H9v1H7v-1H5V9h2V7H5V5h2z', 'fill-rule="evenodd"')),
  skull: svg(P('M3 2h10v8l-2 1v3H5v-3l-2-1z') + P('M5 6h2v2H5zm4 0h2v2H9z', 'fill="#000" opacity=".6"')),
  eye: svg(P('M1 8c2-4 4-5 7-5s5 1 7 5c-2 4-4 5-7 5s-5-1-7-5zm7-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z', 'fill-rule="evenodd"')),
  dash: svg(P('M1 6h6v4H1zm7-1h3v6H8zm4-2h3v10h-3z')),
  link: svg(P('M2 6h5v1H3v2h4v1H2zm7 0h5v4H9V9h4V7H9z')),
  jump: svg(P('M8 1l5 6h-3v4H6V7H3zM3 13h10v2H3z')),
  win: svg(P('M1 2h14v12H1z') + P('M2 5h12v8H2z', 'fill="#000" opacity=".35"') + P('M11 3h2v1h-2z', 'fill="#000" opacity=".55"')),
  check: svg(P('M2 8l2-2 3 3 5-5 2 2-7 7z')),
  cross: svg(P('M3 2l5 5 5-5 1 1-5 5 5 5-1 1-5-5-5 5-1-1 5-5-5-5z')),
  arrow: svg(P('M2 7h8V4l5 4-5 4V9H2z')),
  code: svg(P('M5 3 1 8l4 5 1-1-3-4 3-4zm6 0-1 1 3 4-3 4 1 1 4-5z')),
  clock: svg(P('M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-1 3h2v4l3 2-1 1-4-3z', 'fill-rule="evenodd"')),
  book: svg(P('M2 2h5l1 1 1-1h5v11H9l-1 1-1-1H2z')),
  pack: svg(P('M2 5h12v10H2z') + P('M4 1h8l2 4H2z', 'fill="#000" opacity=".3"')),
  plus: svg(P('M7 2h2v5h5v2H9v5H7V9H2V7h5z')),
};

export const icon = (name) => ICONS[name] || ICONS.file;
