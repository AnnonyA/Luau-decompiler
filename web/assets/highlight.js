// Highlight text nodes only. Uploaded source never becomes HTML.
const tokens = /(--\[\[[\s\S]*?\]\]|--[^\n]*|\[\[[\s\S]*?\]\]|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|\b(?:and|break|continue|do|else|elseif|end|export|false|for|function|if|in|local|nil|not|or|repeat|return|then|true|type|until|while)\b|\b(?:game|print|pairs|ipairs|require|string|table|math|tostring|tonumber)\b|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g;
export function renderCode(code, lines, source, highlight = true) {
  lines.textContent = Array.from({length: Math.min(source.split('\n').length,10000)}, (_,i)=>i+1).join('\n');
  code.replaceChildren();
  if (!highlight || source.length > 200000) { code.textContent = source; return; }
  let at = 0;
  const fragment = document.createDocumentFragment();
  for (const match of source.matchAll(tokens)) {
    fragment.append(document.createTextNode(source.slice(at, match.index)));
    const span = document.createElement('span'), value = match[0];
    span.className = 'tok-' + (value.startsWith('--') ? 'comment' : /^["'\[]/.test(value) ? 'string' : /^\d/.test(value) ? 'number' : /^(game|print|pairs|ipairs|require|string|table|math|tostring|tonumber)$/.test(value) ? 'builtin' : 'keyword');
    span.textContent = value; fragment.append(span); at = match.index + value.length;
  }
  fragment.append(document.createTextNode(source.slice(at))); code.append(fragment);
}
