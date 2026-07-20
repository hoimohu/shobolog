// Markdownファイルのメタデータを読み取る関数
export async function getMetadata(md) {
  const res = {
    tags: [],
    content: '',
    date: 0,
    lastUpdate: 0,
  };

  let start = false;
  const spl = md.split('\n');

  for (let i = 0; i < spl.length; i++) {
    const line = spl[i];
    if (!start && line.trim() === '---') {
      start = true;
      continue;
    } else if (start && line.trim() === '---') {
      res.content = spl.slice(i + 1).join('\n');
      break;
    } else {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        if (match[1] === 'tags') {
          while (++i < spl.length && spl[i].startsWith('-') && spl[i].trim() !== '---') {
            const tagMatch = spl[i].match(/-\s+(.+)/);
            if (tagMatch) {
              res.tags.push(tagMatch[1]);
            }
          }
          i--;
        } else {
          res[match[1]] = match[2];
        }
      }
    }
  }
  if (res.lastUpdate === 0 && res.date !== 0) {
    res.lastUpdate = res.date;
  } else if (res.date === 0 && res.lastUpdate !== 0) {
    res.date = res.lastUpdate;
  }

  return res;
}

// 必要なタグを返す関数
export async function getRequiredTags(content) {
  let res = '';

  // AiScript
  if (content.match(/<ai-script>/)) {
    res += '<script src="/src/aiscript-element.js"></script>';
  }
  // katex
  if (content.match(/class="katex/)) {
    if (res !== '') {
      res += '\n';
    }
    res += '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.47/dist/katex.min.css" integrity="sha384-nH0MfJ44wi1dd7w6jinlyBgljjS8EJAh2JBoRad8a3VDw2K69vfaaqm4WnR+gXtA" crossorigin="anonymous">';
  }
  // code
  if (content.match(/<pre/)) {
    if (res !== '') {
      res += '\n';
    }
    res += `<style>
@media (prefers-color-scheme: dark) {
  .shiki,
  .shiki span {
    color: var(--shiki-dark) !important;
    background-color: var(--shiki-dark-bg) !important;
  }
}</style>`;
  }
  if (content.match(/<code>/)) {
    if (res !== '') {
      res += '\n';
    }
    res += `<style>
@import url('https://fonts.googleapis.com/css2?family=Google+Sans+Code:ital,wght,MONO@0,300..800,1;1,300..800,1&display=swap');
code {
font-family: "Google Sans Code", monospace;
font-optical-sizing: auto;
font-weight:300;
font-style: normal;
font-variation-settings: "MONO" 1;
}</style>`;
  }

  return res;
}

// 目次の生成
export async function generateTableOfContents(content) {
  const tableOfContents = {
    type: 'object',
    depth: 0,
    children: [],
    parent: null
  };
  let prevObj = tableOfContents;
  for (let i = 0; i < content.length - 8; i++) {
    if (content[i] === '<' && content[i + 1] === 'h' && content[i + 2].match(/\d/)) {
      const slice = content.slice(i);
      if (slice.match(/^<h\d id="[^"]*">/)) {
        const currentDepth = Number(slice.match(/^<h(\d)/)[1]);
        if (prevObj.depth < currentDepth) {
          while (prevObj.depth < currentDepth) {
            const childObj = {
              type: 'object',
              depth: prevObj.depth + 1,
              children: [],
              parent: prevObj
            };
            prevObj.children.push(childObj);
            prevObj = childObj;
          }
        } else if (prevObj.depth > currentDepth) {
          while (prevObj.depth > currentDepth) {
            prevObj = prevObj.parent;
          }
        }
        prevObj.children.push({
          type: 'text',
          level: slice.match(/^<h(\d)/)[1],
          href: slice.match(/^<h\d id="([^"]*)">/)[1],
          text: decodeURIComponent(slice.match(/^<h\d id="([^"]*)">/)[1].replace(/^\d+-/, ''))
        });
      }
    }
  }

  // 階層構造を<ul>に直す
  let tableOfContentsItems = await (async function decodeTableOfContentsRec(obj) {
    if (obj.type === 'object') {
      if (obj.depth === 0) {
        if (obj.children.length === 0) {
          return '';
        } else {
          return `<div class="toc-list">${(await Promise.all(obj.children.map(async (child) => await decodeTableOfContentsRec(child)))).join('')}</div>`;
        }
      } else {
        return (await Promise.all(obj.children.map(async (child) => await decodeTableOfContentsRec(child)))).join('');
      }
    } else if(obj.type === 'text') {
      return `<a href="#${obj.href}"><div class="toc-item toc-item-${obj.level}">${obj.text}</div></a>`;
    } else {
      return '';
    }
  })(tableOfContents);

  return tableOfContentsItems;
}