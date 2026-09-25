// TabMax - Lightweight, Safe Markdown Parser (zero dependencies, CSP compliant)

export function renderMarkdown(md) {
  if (!md) return '';

  let html = escapeHtml(md);

  // Fenced Code blocks
  html = html.replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const langBadge = lang ? `<span class="md-code-lang">${lang}</span>` : '';
    return `<div class="md-code-wrapper">${langBadge}<pre class="md-code-block"><code>${code.trim()}</code></pre></div>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');

  // Headings
  html = html.replace(/^###### (.*$)/gim, '<h6 class="md-h6">$1</h6>');
  html = html.replace(/^##### (.*$)/gim, '<h5 class="md-h5">$1</h5>');
  html = html.replace(/^#### (.*$)/gim, '<h4 class="md-h4">$1</h4>');
  html = html.replace(/^### (.*$)/gim, '<h3 class="md-h3">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="md-h2">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="md-h1">$1</h1>');

  // Horizontal rules
  html = html.replace(/^(?:---|\*\*\*|___)\s*$/gim, '<hr class="md-hr"/>');

  // Blockquotes (including multi-line / nested)
  html = html.replace(/^\>\> (.*$)/gim, '<blockquote class="md-blockquote md-nested-quote">$1</blockquote>');
  html = html.replace(/^\> (.*$)/gim, '<blockquote class="md-blockquote">$1</blockquote>');

  // Task lists
  html = html.replace(/^- \[x\] (.*$)/gim, '<div class="md-task-item"><input type="checkbox" checked disabled/> <span class="md-task-done">$1</span></div>');
  html = html.replace(/^- \[ \] (.*$)/gim, '<div class="md-task-item"><input type="checkbox" disabled/> <span>$1</span></div>');

  // Numbered lists
  html = html.replace(/^\d+\.\s+(.*$)/gim, '<li class="md-ol-li">$1</li>');

  // Bullet lists
  html = html.replace(/^[\*\-]\s+(.*$)/gim, '<li class="md-li">$1</li>');

  // Bold & Italic (triple asterisk)
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  html = html.replace(/==([^=]+)==/g, '<mark class="md-highlight">$1</mark>');

  // Images ![alt](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img class="md-img" src="$2" alt="$1" loading="lazy" onerror="this.style.display=\'none\'"/>');

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="md-link" href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Simple Markdown Tables (basic parser)
  html = parseSimpleTables(html);

  // Line breaks
  html = html.replace(/\n/g, '<br/>');

  return html;
}

function parseSimpleTables(text) {
  return text.replace(/((?:\|[^\n]+\|\n?)+)/g, (match) => {
    const rows = match.trim().split('\n');
    if (rows.length < 2) return match;

    let tableHtml = '<div class="md-table-wrap"><table class="md-table">';
    let isHeader = true;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i].trim();
      // Skip delimiter row like | --- | --- |
      if (/^\|[\s\-:]+(\|[\s\-:]+)+\|$/.test(row)) {
        isHeader = false;
        continue;
      }
      const cells = row.split('|').slice(1, -1);
      const tag = isHeader ? 'th' : 'td';
      tableHtml += '<tr>';
      cells.forEach(c => {
        tableHtml += `<${tag}>${c.trim()}</${tag}>`;
      });
      tableHtml += '</tr>';
    }
    tableHtml += '</table></div>';
    return tableHtml;
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
