// Builds a styled, printable HTML version of USER_GUIDE.md.
// Usage: npm run docs
//
// Supports the small Markdown subset used by the guide: headings, paragraphs,
// fenced code blocks, tables, blockquotes, flat lists, rules and inline
// bold / italic / code / links.

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const sourcePath = path.join(root, 'USER_GUIDE.md');
const outputPath = path.join(root, 'docs', 'user-guide.html');
const markdown = fs.readFileSync(sourcePath, 'utf8').replace(/\r\n/g, '\n');
const updated = fs.statSync(sourcePath).mtime;

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inline(value) {
  const code = [];
  let text = escapeHtml(value).replace(/`([^`]+)`/g, (_match, snippet) => {
    code.push(snippet);
    return `\u0000${code.length - 1}\u0000`;
  });

  text = text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2">$1</a>');

  return text.replace(/\u0000(\d+)\u0000/g, (_match, index) => `<code>${code[Number(index)]}</code>`);
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/`|\*|\[|\]|\(|\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function renderList(items, ordered) {
  const tag = ordered ? 'ol' : 'ul';
  const body = items
    .map((item) => {
      const childOrdered = item.children.length ? item.children[0].ordered : false;
      const children = item.children.length
        ? renderList(
            item.children.map((child) => ({ text: child.text, ordered: child.ordered, children: [] })),
            childOrdered,
          )
        : '';
      return `<li>${inline(item.text)}${children}</li>`;
    })
    .join('');
  return `<${tag}>${body}</${tag}>`;
}

const lines = markdown.split('\n');
const out = [];
const toc = [];
let index = 0;

while (index < lines.length) {
  const line = lines[index];

  if (!line.trim()) {
    index += 1;
    continue;
  }

  // Fenced code block
  if (line.startsWith('```')) {
    const language = line.slice(3).trim();
    const body = [];
    index += 1;
    while (index < lines.length && !lines[index].startsWith('```')) {
      body.push(lines[index]);
      index += 1;
    }
    index += 1;
    out.push(
      `<pre class="code"><code${language ? ` data-language="${escapeHtml(language)}"` : ''}>${escapeHtml(
        body.join('\n'),
      )}</code></pre>`,
    );
    continue;
  }

  // Horizontal rule
  if (/^---+\s*$/.test(line)) {
    out.push('<hr />');
    index += 1;
    continue;
  }

  // Heading
  const heading = /^(#{1,4})\s+(.*)$/.exec(line);
  if (heading) {
    const level = heading[1].length;
    const text = heading[2].trim();
    const id = `sec-${slug(text)}`;
    if (level === 2) toc.push({ id, text });
    out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
    index += 1;
    continue;
  }

  // Table
  if (line.trim().startsWith('|')) {
    const rows = [];
    while (index < lines.length && lines[index].trim().startsWith('|')) {
      rows.push(lines[index].trim());
      index += 1;
    }
    const cells = (row) =>
      row
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim());
    const header = cells(rows[0]);
    const body = rows
      .slice(1)
      .filter((row) => !/^\|?[\s:|-]+\|?$/.test(row))
      .map(cells);
    const head = `<thead><tr>${header.map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr></thead>`;
    const rowsHtml = body
      .map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`)
      .join('');
    out.push(`<table>${head}<tbody>${rowsHtml}</tbody></table>`);
    continue;
  }

  // Blockquote
  if (line.startsWith('>')) {
    const body = [];
    while (index < lines.length && lines[index].startsWith('>')) {
      body.push(lines[index].replace(/^>\s?/, ''));
      index += 1;
    }
    out.push(`<blockquote>${inline(body.join(' '))}</blockquote>`);
    continue;
  }

  // Lists (supports one nesting level for sub-bullets under a numbered step)
  const listMatch = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(line);
  if (listMatch) {
    const items = [];
    let listType = null;
    while (index < lines.length) {
      const match = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(lines[index]);
      if (!match) break;
      const indent = match[1].length;
      const ordered = /^\d/.test(match[2]);
      const text = match[3];
      if (indent === 0) {
        if (listType === null) listType = ordered ? 'ol' : 'ul';
        items.push({ text, ordered, children: [] });
      } else if (items.length) {
        items[items.length - 1].children.push({ text, ordered });
      }
      index += 1;
    }
    out.push(renderList(items, listType === 'ol'));
    continue;
  }

  // Paragraph
  const paragraph = [];
  while (
    index < lines.length &&
    lines[index].trim() &&
    !lines[index].startsWith('#') &&
    !lines[index].startsWith('>') &&
    !lines[index].startsWith('```') &&
    !lines[index].trim().startsWith('|') &&
    !/^\s*[-*]\s+/.test(lines[index]) &&
    !/^\s*\d+\.\s+/.test(lines[index]) &&
    !/^---+\s*$/.test(lines[index])
  ) {
    paragraph.push(lines[index].trim());
    index += 1;
  }
  out.push(`<p>${inline(paragraph.join(' '))}</p>`);
}

const content = out.join('\n');
const tocHtml = toc
  .map((entry) => `<li><a href="#${entry.id}">${inline(entry.text)}</a></li>`)
  .join('\n');

const html = `<!doctype html>
<html lang="hi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Meridian — First-Time User Guide</title>
<style>
  :root {
    --ink: #1f2430;
    --muted: #5b6475;
    --line: #dfe4ec;
    --soft: #f6f8fb;
    --brand: #4f46e5;
    --brand-soft: #eef2ff;
    --amber-soft: #fff8e6;
    --amber-line: #d99a00;
  }

  * { box-sizing: border-box; }

  html { scroll-behavior: smooth; }

  body {
    margin: 0;
    background: #eef1f6;
    color: var(--ink);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 16px;
    line-height: 1.65;
  }

  .sheet {
    max-width: 940px;
    margin: 32px auto;
    padding: 56px 64px 64px;
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 18px 60px rgba(25, 34, 52, 0.12);
  }

  header.doc-head {
    display: flex;
    align-items: flex-start;
    gap: 18px;
    padding-bottom: 22px;
    border-bottom: 3px solid var(--brand);
    margin-bottom: 8px;
  }

  .mark {
    flex: 0 0 auto;
    width: 46px;
    height: 46px;
    border-radius: 12px;
    background: var(--brand);
    color: #fff;
    display: grid;
    place-items: center;
    font-size: 22px;
    font-weight: 700;
  }

  .doc-head h1 {
    margin: 0;
    font-size: 30px;
    line-height: 1.2;
    letter-spacing: -0.02em;
  }

  .doc-head p {
    margin: 6px 0 0;
    color: var(--muted);
    font-size: 14px;
  }

  .print-bar {
    display: flex;
    justify-content: flex-end;
    margin: 18px 0 0;
  }

  .print-bar button {
    border: 0;
    border-radius: 8px;
    background: var(--brand);
    color: #fff;
    padding: 9px 16px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .print-bar button:hover { background: #4338ca; }

  nav.toc {
    margin: 26px 0 34px;
    padding: 20px 24px;
    background: var(--soft);
    border: 1px solid var(--line);
    border-radius: 12px;
  }

  nav.toc h2 {
    margin: 0 0 10px;
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
  }

  nav.toc ol {
    margin: 0;
    padding-left: 20px;
    columns: 2;
    column-gap: 32px;
  }

  nav.toc li {
    margin: 4px 0;
    font-size: 14px;
    break-inside: avoid;
  }

  nav.toc a {
    color: var(--ink);
    text-decoration: none;
    border-bottom: 1px solid transparent;
  }

  nav.toc a:hover { border-bottom-color: var(--brand); }

  main h1 { display: none; }

  main h2 {
    margin: 42px 0 14px;
    padding-top: 26px;
    font-size: 24px;
    line-height: 1.3;
    letter-spacing: -0.01em;
    border-top: 1px solid var(--line);
  }

  main h3 {
    margin: 28px 0 10px;
    font-size: 18px;
    color: #2c3444;
  }

  main h4 { margin: 22px 0 8px; font-size: 16px; }

  p { margin: 0 0 14px; }

  a { color: var(--brand); }

  strong { color: #151a24; }

  code {
    background: var(--soft);
    border: 1px solid var(--line);
    border-radius: 5px;
    padding: 1px 5px;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
    font-size: 0.88em;
  }

  pre.code {
    margin: 18px 0;
    padding: 18px 20px;
    overflow-x: auto;
    background: #1f2430;
    color: #e8ecf4;
    border-radius: 10px;
    font-size: 13.5px;
    line-height: 1.55;
  }

  pre.code code {
    background: none;
    border: 0;
    padding: 0;
    color: inherit;
    font-size: inherit;
  }

  blockquote {
    margin: 20px 0;
    padding: 14px 18px;
    background: var(--amber-soft);
    border-left: 4px solid var(--amber-line);
    border-radius: 0 8px 8px 0;
    color: #4a3b14;
  }

  blockquote p { margin: 0; }

  table {
    width: 100%;
    margin: 18px 0 22px;
    border-collapse: collapse;
    font-size: 14.5px;
  }

  th, td {
    padding: 9px 12px;
    border: 1px solid var(--line);
    text-align: left;
    vertical-align: top;
  }

  th {
    background: var(--soft);
    font-weight: 600;
    white-space: nowrap;
  }

  tbody tr:nth-child(even) { background: #fbfcfe; }

  ul, ol { margin: 0 0 16px; padding-left: 24px; }

  li { margin: 5px 0; }

  hr {
    border: 0;
    border-top: 1px solid var(--line);
    margin: 34px 0;
  }

  footer.doc-foot {
    margin-top: 46px;
    padding-top: 16px;
    border-top: 1px solid var(--line);
    color: var(--muted);
    font-size: 12.5px;
    display: flex;
    justify-content: space-between;
    gap: 16px;
  }

  @media (max-width: 720px) {
    .sheet { margin: 0; border-radius: 0; padding: 28px 20px 40px; }
    nav.toc ol { columns: 1; }
    .doc-head h1 { font-size: 24px; }
    th { white-space: normal; }
  }

  @media print {
    @page { size: A4; margin: 16mm 14mm; }
    body { background: #fff; font-size: 11pt; }
    .sheet { margin: 0; padding: 0; box-shadow: none; border-radius: 0; max-width: none; }
    .print-bar { display: none; }
    nav.toc { break-after: page; }
    main h2 { break-after: avoid; }
    main h3 { break-after: avoid; }
    table, tr, blockquote, pre.code { break-inside: avoid; }
    a { color: var(--ink); text-decoration: none; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <header class="doc-head">
      <div class="mark">M</div>
      <div>
        <h1>Meridian — First-Time User Guide</h1>
        <p>Kaam kaise aage badhta hai, kaun kya kar sakta hai, aur pehle din kya karein.</p>
      </div>
    </header>

    <div class="print-bar">
      <button type="button" onclick="window.print()">Print / Save as PDF</button>
    </div>

    <nav class="toc">
      <h2>Contents</h2>
      <ol>
${tocHtml}
      </ol>
    </nav>

    <main>
${content}
    </main>

    <footer class="doc-foot">
      <span>Meridian · First-Time User Guide</span>
      <span>Updated ${updated.toISOString().slice(0, 10)}</span>
    </footer>
  </div>
</body>
</html>
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, html, 'utf8');
console.log(`Wrote ${path.relative(root, outputPath)} (${(html.length / 1024).toFixed(1)} KB)`);
