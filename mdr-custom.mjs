/**
 * mdreader - Markdown to HTML converter
 * @author hoimohu
 * @version 3.0.0
 * @license MIT
 */

/*
MIT License

Copyright (c) 2026 hoimohu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// import
import katex from "katex";
import "katex/contrib/mhchem";
import { codeToHtml } from "shiki";

/**
 * 連続するマーカーの個数を数える
 * @param {string} md 対象の文字列
 * @param {number} start 開始位置
 * @param {string} marker マーカー文字
 * @return {number} マーカーの個数
 */
function countMarkers(md, start, marker) {
  let count = 0;
  for (let i = start; i < md.length && md[i] === marker; i++) {
    count++;
  }
  return count;
}

/**
 * 指定された位置から連続するマーカーの個数を数える（最大2個まで）
 * @param {string} md 対象の文字列
 * @param {number} start 開始位置
 * @param {string} marker マーカー文字
 * @return {number} マーカーの個数（最大2）
 */
function countMarkersLimited(md, start, marker) {
  return Math.min(countMarkers(md, start, marker), 3);
}

/**
 * 指定されたマーカーの閉じ位置を探する
 * @param {string} md 対象の文字列
 * @param {number} start 検索開始位置
 * @param {string} marker マーカー文字
 * @param {number} count 必要なマーカーの個数
 * @return {number} 閉じマーカーの開始位置、見つからない場合は-1
 */
function findClosingMarker(md, start, marker, count) {
  for (let i = start; i < md.length; i++) {
    if (md[i] === marker) {
      const markerCount = countMarkers(md, i, marker);
      if (markerCount >= count) {
        return i;
      }
      // マーカーをスキップ
      i += markerCount - 1;
    }
  }
  return -1;
}

/**
 * インライン要素をパースする
 * @param {string} md markdownの文字列
 * @return {Array} 子要素の配列
 */
function inlineParser(md) {
  const children = [];
  let i = 0;

  while (i < md.length) {
    const char = md[i];

    if (char === "\\" && i + 1 < md.length) {
      // エスケープ処理
      children.push({
        "type": "text",
        "content": md[i + 1].replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
      });
      i += 2;
      continue;
    } else if (char === "`") {
      // インラインコード
      const endIdx = md.indexOf("`", i + 1);
      if (endIdx !== -1) {
        children.push({
          "type": "code",
          "content": md.slice(i + 1, endIdx)
        });
        i = endIdx + 1;
        continue;
      }
    } else if (char === "*" || (char === "_" && (i === 0 || md[i - 1] === " "))) {
      // strong または em
      const markerCount = countMarkersLimited(md, i, char);

      if (markerCount === 3) {
        // strong and em: *** ... *** or ___ ... ___
        const closeIdx = findClosingMarker(md, i + 3, char, 3);
        if (closeIdx !== -1) {
          children.push({
            "type": "strong",
            "children": [{
              "type": "em",
              "children": inlineParser(md.slice(i + 3, closeIdx))
            }]
          });
          i = closeIdx + 3;
          continue;
        }
      } else if (markerCount === 2) {
        // strong: ** ... ** or __ ... __
        const closeIdx = findClosingMarker(md, i + 2, char, 2);
        if (closeIdx !== -1) {
          children.push({
            "type": "strong",
            "children": inlineParser(md.slice(i + 2, closeIdx))
          });
          i = closeIdx + 2;
          continue;
        }
      } else if (markerCount === 1) {
        // em: * ... * or _ ... _
        const closeIdx = findClosingMarker(md, i + 1, char, 1);
        if (closeIdx !== -1) {
          children.push({
            "type": "em",
            "children": inlineParser(md.slice(i + 1, closeIdx))
          });
          i = closeIdx + 1;
          continue;
        }
      }
    } else if (char === "[") {
      // リンク: [text](url "title")
      let closeTextIdx = md.indexOf("]", i + 1);
      if (closeTextIdx !== -1 && md[closeTextIdx + 1] === "(") {
        if (md.slice(i + 1).match(/^.*!\[.*\]\(.*\).*\]\(.*\)/)) {
          // リンク中に画像がある場合はリンクの子要素にする
          let depth = 0;
          for (let j = i + 1; j + 2 < md.length; j++) {
            if (md.substring(j, j + 2) === "![") depth++;
            if (md.substring(j, j + 2) === "](") depth--;
            if (md[j] === "]" && depth < 0) {
              closeTextIdx = j;
              break;
            }
          }
        }
        const closeParenthesisIdx = md.indexOf(")", closeTextIdx + 2);
        const nextSpaceIdx = md.indexOf(" ", closeTextIdx + 2);
        let title = null;
        let closeUrlIdx = closeParenthesisIdx;
        if (nextSpaceIdx !== -1 && nextSpaceIdx < closeParenthesisIdx && md.slice(nextSpaceIdx + 1).match(/^\s*".*"/)) {
          // タイトルがある場合はURLの終了位置をスペースにする
          closeUrlIdx = nextSpaceIdx;
          title = md.slice(nextSpaceIdx + 2, md.indexOf('"', nextSpaceIdx + 2)).trim();
        }
        if (closeParenthesisIdx !== -1) {
          const linkText = md.slice(i + 1, closeTextIdx);
          const linkUrl = md.slice(closeTextIdx + 2, closeUrlIdx);
          children.push({
            "type": "link",
            "url": linkUrl,
            "title": title,
            "children": inlineParser(linkText)
          });
          i = closeParenthesisIdx + 1;
          continue;
        }
      } else if (md[closeTextIdx + 1] === "[") {
        // 参照リンク: [text][id]
        const closeTextIdx = md.indexOf("]", i + 1);
        if (closeTextIdx !== -1 && md[closeTextIdx + 1] === "[") {
          const closeIdIdx = md.indexOf("]", closeTextIdx + 2);
          if (closeIdIdx !== -1) {
            const linkText = md.slice(i + 1, closeTextIdx);
            const linkId = md.slice(closeTextIdx + 2, closeIdIdx);
            children.push({
              "type": "referenceLink",
              "id": linkId,
              "children": inlineParser(linkText)
            });
            i = closeIdIdx + 1;
            continue;
          }
        }
      } else if (md[i + 1] === "^") {
        // 脚注: [^id]
        const closeTextIdx = md.indexOf("]", i + 1);
        if (closeTextIdx !== -1 && md[i + 1] === "^") {
          const footnoteId = md.slice(i + 2, closeTextIdx);
          children.push({
            "type": "footnote",
            "id": footnoteId
          });
          i = closeTextIdx + 1;
          continue;
        }
      }
    } else if (char === "<") {
      // 自動リンク: <url> または <email>
      const closeIdx = md.indexOf(">", i + 1);
      if (closeIdx !== -1) {
        const content = md.slice(i + 1, closeIdx);
        if (content.match(/^[a-zA-Z]+:\/\//)) {
          // URL
          children.push({
            "type": "link",
            "url": content,
            "children": [{
              "type": "text",
              "content": content
            }]
          });
        } else if (content.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
          // Email
          children.push({
            "type": "link",
            "url": `mailto:${content}`,
            "children": [{
              "type": "text",
              "content": content
            }]
          });
        } else {
          // その他はエスケープして表示
          children.push({
            "type": "text",
            "content": `<${content}>`
          });
        }
        i = closeIdx + 1;
        continue;
      }
    } else if (char === "!") {
      // 画像: ![alt](url "title")
      if (i + 1 < md.length && md[i + 1] === "[") {
        const closeAltIdx = md.indexOf("]", i + 2);
        if (closeAltIdx !== -1 && md[closeAltIdx + 1] === "(") {
          const closeParenthesisIdx = md.indexOf(")", closeAltIdx + 2);
          const nextSpaceIdx = md.indexOf(" ", closeAltIdx + 2);
          let closeUrlIdx = closeParenthesisIdx;
          let title = null;
          if (nextSpaceIdx !== -1 && nextSpaceIdx < closeParenthesisIdx && md.slice(nextSpaceIdx + 1).match(/^\s*".*"/)) {
            // タイトルがある場合はURLの終了位置をスペースにする
            closeUrlIdx = nextSpaceIdx;
            title = md.slice(nextSpaceIdx + 2, md.indexOf('"', nextSpaceIdx + 2)).trim();
          }
          if (closeParenthesisIdx !== -1) {
            const altText = md.slice(i + 2, closeAltIdx);
            const imageUrl = md.slice(closeAltIdx + 2, closeUrlIdx);
            children.push({
              "type": "image",
              "url": imageUrl,
              "alt": altText,
              "title": title
            });
            i = closeParenthesisIdx + 1;
            continue;
          }
        }
      }
    } else if (char === "$") {
      // インライン数式: $...$
      const closeIdx = md.indexOf("$", i + 1);
      if (closeIdx !== -1) {
        children.push({
          "type": "math",
          "content": md.slice(i + 1, closeIdx)
        });
        i = closeIdx + 1;
        continue;
      }
    } else if (char === "~") {
      // 打ち消し線 または 下付き文字: ~~...~~ または ~...~
      const markerCount = countMarkersLimited(md, i, char);

      if (markerCount === 2) {
        // 打ち消し線: ~~...~~
        const closeIdx = findClosingMarker(md, i + 2, char, 2);
        if (closeIdx !== -1) {
          children.push({
            "type": "deleted",
            "children": inlineParser(md.slice(i + 2, closeIdx))
          });
          i = closeIdx + 2;
          continue;
        }
      } else if (markerCount === 1) {
        // 下付き文字: ~...~
        const closeIdx = findClosingMarker(md, i + 1, char, 1);
        if (closeIdx !== -1) {
          children.push({
            "type": "subscript",
            "children": inlineParser(md.slice(i + 1, closeIdx))
          });
          i = closeIdx + 1;
          continue;
        }
      }
    } else if (char === "^") {
      // 上付き文字: ^...^
      const closeIdx = md.indexOf("^", i + 1);
      if (closeIdx !== -1) {
        children.push({
          "type": "superscript",
          "children": inlineParser(md.slice(i + 1, closeIdx))
        });
        i = closeIdx + 1;
        continue;
      }
    } else if (char === "=") {
      // ハイライト: ==...==
      const closeIdx = findClosingMarker(md, i + 2, char, 2);
      if (closeIdx !== -1) {
        children.push({
          "type": "highlight",
          "children": inlineParser(md.slice(i + 2, closeIdx))
        });
        i = closeIdx + 2;
        continue;
      }
    }


    // 通常テキスト
    if (children.length > 0 && children[children.length - 1].type === "text") {
      children[children.length - 1].content += char;
    } else {
      children.push({
        "type": "text",
        "content": char
      });
    }
    i++;
  }

  if (children.length > 0 && children[children.length - 1].type === "text" && children[children.length - 1].content.match(/\s\s+$/)) {
    children[children.length - 1].content = children[children.length - 1].content.replace(/\s\s+$/, " ");
    children.push({
      "type": "lineBreak"
    });
  }

  return children;
}

/**
 * テーブル行をセルに分解する
 * @param {string} line テーブル行文字列
 * @returns {string[]} セル文字列の配列
 */
function splitTableLine(line) {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  return trimmed.replace(/\\\\/g, "&#92;").replace(/\\\|/g, "&#124;").split("|").map(cell => cell.trim());
}

/**
 * 区切り行がテーブル区切りとして妥当か判定する
 * @param {string} line 区切り行文字列
 * @returns {boolean}
 */
function isTableDividerLine(line) {
  const cells = splitTableLine(line);
  if (cells.length < 1) return false;
  return cells.every(cell => /^:?-{3,}:?$/.test(cell));
}

/**
 * 区切り行トークンから整列情報を取得する
 * @param {string[]} cells 区切りセル文字列
 * @returns {Array<string>} left/center/right/""
 */
function parseTableAlign(cells) {
  return cells.map(cell => {
    const t = cell.trim();
    const left = t.startsWith(":");
    const right = t.endsWith(":");
    if (left && right) return "center";
    if (left) return "left";
    if (right) return "right";
    return "";
  });
}

/**
 * ブロック要素をパースする
 * @param {string} md markdownの文字列
 * @return {Array} 子要素の配列
 */
function blockParser(md) {
  const children = [];

  const lines = (md + "\n").split("\n");

  let paragraphEnded = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/^#+\s/)) {
      const level = line.match(/^#+/)[0].length;
      if (level <= 6) {
        children.push({
          "type": "heading",
          "level": level,
          "children": inlineParser(line.slice(level + 1).trimStart())
        });
      } else {
        children.push({
          "type": "paragraph",
          "children": inlineParser(line.trimStart())
        });
      }
    } else if (line.includes("|") && i + 1 < lines.length && isTableDividerLine(lines[i + 1])) {
      const tableLines = [line];
      // 次行は必ずテーブル区切り行
      tableLines.push(lines[i + 1]);
      i += 2;
      while (i < lines.length && lines[i].trim() !== "" && lines[i].includes("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      i--;

      const headerCells = splitTableLine(tableLines[0]).map(c => inlineParser(c));
      const align = parseTableAlign(splitTableLine(tableLines[1]));
      const rows = tableLines.slice(2).map(row => splitTableLine(row).map(c => inlineParser(c)));

      children.push({
        "type": "table",
        "align": align,
        "header": headerCells,
        "rows": rows
      });
    } else if (line.match(/^(  |\t)*(-|\*|\+|\d+\.)\s/)) {
      let indentLevel = 0;
      let tmpLine = line;
      while (tmpLine.match(/^(  |\t)/)) {
        indentLevel++;
        tmpLine = tmpLine.replace(/^(  |\t)/, "");
      }
      const listType = line.trimStart().match(/^[-\*\+]/) ? "unordered" : "ordered";
      let currentList = null;
      for (let j = children.length - 1; j >= 0; j--) {
        if (children[j].type === "list") {
          let listCandidate = null;
          function listSearch(list) {
            if (list.indentLevel === indentLevel && list.ordered === (listType === "ordered")) {
              return list;
            } else if (list.indentLevel < indentLevel && (listCandidate === null || listCandidate.indentLevel < list.indentLevel)) {
              listCandidate = list;
            }
            if (list.items.length > 0) {
              const lastItem = list.items[list.items.length - 1];
              if (lastItem.children.length > 0) {
                for (let k = lastItem.children.length - 1; k >= 0; k--) {
                  const child = lastItem.children[k];
                  if (child.type === "list") {
                    const found = listSearch(child);
                    if (found !== null) return found;
                    break;
                  }
                }
              }
            }
            return null;
          }
          let tmpList = listSearch(children[j]);
          if (tmpList === null) {
            if (listCandidate !== null) {
              tmpList = listCandidate;
            } else {
              continue;
            }
          }
          if (tmpList.indentLevel === indentLevel && tmpList.ordered === (listType === "ordered")) {
            currentList = tmpList;
            break;
          } else if (tmpList.indentLevel < indentLevel) {
            currentList = {
              "type": "list",
              "ordered": listType === "ordered",
              "indentLevel": indentLevel,
              "items": []
            };
            tmpList.items[tmpList.items.length - 1].children.push(currentList);
            break;
          } else if (tmpList.indentLevel > indentLevel) {
            continue;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      if (currentList === null) {
        children.push({
          "type": "list",
          "ordered": listType === "ordered",
          "indentLevel": indentLevel,
          "items": []
        });
        currentList = children[children.length - 1];
      }
      if (line.trimStart().match(/^(-|\*|\+)\s\[[ xX]\]/)) {
        // チェックリスト: - [ ] task または - [x] task
        const checked = line.replace(/^(-|\*|\+)\s\[/, "")[0].toLowerCase() === "x";
        currentList.items.push({
          "type": "checkListItem",
          "checked": checked,
          "children": inlineParser(line.trimStart().replace(/^(-|\*|\+|\d+\.)\s/, "").trimStart())
        });
      } else {
        currentList.items.push({
          "type": "listItem",
          "children": inlineParser(line.trimStart().replace(/^(-|\*|\+|\d+\.)\s/, "").trimStart())
        });
      }
    } else if (line.startsWith(">")) {
      let blockQuoteBuffer = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        blockQuoteBuffer.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      children.push({
        "type": "blockQuote",
        "children": blockParser(blockQuoteBuffer.join("\n"))
      });
      i--;
    } else if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const codeBlockBuffer = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeBlockBuffer.push(lines[i]);
        i++;
      }
      children.push({
        "type": "codeBlock",
        "language": language,
        "content": codeBlockBuffer.join("\n")
      });
    } else if (line.startsWith("    ") || line.startsWith("\t")) {
      const codeBlockBuffer = [];
      while (i < lines.length && (lines[i].startsWith("    ") || lines[i].startsWith("\t"))) {
        codeBlockBuffer.push(lines[i].replace(/^(    |\t)/, ""));
        i++;
      }
      children.push({
        "type": "codeBlock",
        "language": "",
        "content": codeBlockBuffer.join("\n")
      });
      i--;
    } else if (line.startsWith("$$")) {
      const mathBlockBuffer = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("$$")) {
        mathBlockBuffer.push(lines[i]);
        i++;
      }
      children.push({
        "type": "mathBlock",
        "content": mathBlockBuffer.join("\n")
      });
    } else if (line.startsWith(":::note")) {
      const noteType = line.slice(7).trim();
      const noteBuffer = [];
      i++;
      while (i < lines.length && !lines[i].startsWith(":::")) {
        noteBuffer.push(lines[i]);
        i++;
      }
      children.push({
        "type": "note",
        "noteType": noteType,
        "children": blockParser(noteBuffer.join("\n"))
      });
    } else if (line.startsWith(":::aiscript")) {
      const scriptType = line.slice(11).trim();
      const codeBlockBuffer = [];
      i++;
      while (i < lines.length && !lines[i].startsWith(":::")) {
        codeBlockBuffer.push(lines[i]);
        i++;
      }
      children.push({
        "type": "aiscript",
        "scriptType": scriptType,
        "content": codeBlockBuffer.join("\n")
      });
    } else if (line.match(/^(---+|___+|\*\*\*+)$/)) {
      children.push({
        "type": "thematicBreak"
      });
    } else if (line.match(/^(==+|--+)$/)) {
      // Setextスタイルの見出し: ==... または --...
      if (children.length > 0 && children[children.length - 1].type === "paragraph") {
        const level = line[0] === "=" ? 1 : 2;
        children[children.length - 1] = {
          "type": "heading",
          "level": level,
          "children": children[children.length - 1].children
        };
      }
    } else if (line.match(/^\s*\[.*\]:\s/)) {
      // 参照定義または脚注定義
      const closeIdIdx = line.indexOf("]");
      if (closeIdIdx !== -1 && line[closeIdIdx + 1] === ":") {
        if (line[1] === "^") {
          // 脚注定義: [^id]: footnote
          const id = line.slice(2, closeIdIdx);
          const footnote = line.slice(closeIdIdx + 2).trim();
          children.push({
            "type": "footnoteDefinition",
            "id": id,
            "footnote": footnote
          });
          continue;
        } else {
          // 参照定義: [id]: url "title"
          const id = line.slice(1, closeIdIdx);
          let url = line.slice(closeIdIdx + 2).trim().match(/^\S+/)[0];
          if (url != null && url.match(/^<.*>$/)) {
            url = url.slice(1, -1);
          }
          const titleMatch = line.slice(closeIdIdx + 2).trim().match(/^\S+\s+"(.*)"$/);
          const title = titleMatch ? titleMatch[1] : "";
          children.push({
            "type": "referenceDefinition",
            "id": id,
            "url": url,
            "title": title
          });
        }
      }

    } else if (line.trim() === "") {
      if (children.length > 0 && children[children.length - 1].type === "paragraph") {
        paragraphEnded = true;
      }
    } else {
      if (children.length > 0 && children[children.length - 1].type === "paragraph" && !paragraphEnded) {
        children[children.length - 1].children.push(...inlineParser(line.trimStart()));
      } else {
        children.push({
          "type": "paragraph",
          "children": inlineParser(line.trimStart())
        });
        paragraphEnded = false;
      }
    }
  }

  return children;
}

/**
 * 改行を統一する
 * @param {string} md markdownの文字列
 * @returns {string} 改行が統一された文字列
 */
function lineBreakUnifier(md) {
  return md.replace(/\r\n|\r/g, "\n");
}

/**
 * 構文木から参照定義と脚註を検索する
 * @param {object} tree 構文木
 * @returns {object} 参照定義と脚註のマップ
 */
function findReferenceAndFootnotes(tree) {
  // 参照定義と脚註を検索する
  const referenceMap = {};
  const footnoteMap = {};
  function traverse(node) {
    if (node.type === "referenceDefinition") {
      referenceMap[node.id] = node;
    } else if (node.type === "footnoteDefinition") {
      footnoteMap[node.id] = node;
    }
    if (node.children) {
      node.children.forEach(traverse);
    }
  }
  traverse(tree);
  return { referenceMap, footnoteMap };
}

async function treeToText(node, aiscriptHandler) {
  let text = "";
  if (node.type === "text") {
    text += node.content;
  } else if (node.type === "lineBreak") {
    text += "\n";
  } else if (node.type === "em") {
    text += (await Promise.all(node.children.map(async (child) => await treeToText(child, aiscriptHandler)))).join("");
  } else if (node.type === "strong") {
    text += (await Promise.all(node.children.map(async (child) => await treeToText(child, aiscriptHandler)))).join("");
  } else if (node.type === "link") {
    text += (await Promise.all(node.children.map(async (child) => await treeToText(child, aiscriptHandler)))).join("");
  } else if (node.type === "image") {
    text += node.alt;
  } else if (node.type === "code") {
    text += node.content;
  } else if (node.type === "heading") {
    text += (await Promise.all(node.children.map(async (child) => await treeToText(child, aiscriptHandler)))).join("") + "\n";
  } else if (node.type === "paragraph") {
    text += (await Promise.all(node.children.map(async (child) => await treeToText(child, aiscriptHandler)))).join("") + "\n";
  } else if (node.type === "list") {
    text += (await Promise.all(node.items.map(async (item) => (await Promise.all(item.children.map(async (child) => await treeToText(child, aiscriptHandler)))).join("")))).join("") + "\n";
  } else if (node.type === "blockQuote") {
    html += (await Promise.all(node.children.map(async (child) => await treeToText(child, aiscriptHandler)))).join("") + "\n";
  } else if (node.type === "codeBlock") {
    html += node.content + "\n";
  } else if (node.type === "math") {
    text += node.content;
  } else if (node.type === "mathBlock") {
    text += node.content + "\n";
  } else if (node.type === "deleted") {
    text += (await Promise.all(node.children.map(async (child) => await treeToText(child, aiscriptHandler)))).join("");
  } else if (node.type === "subscript") {
    text += (await Promise.all(node.children.map(async (child) => await treeToText(child, aiscriptHandler)))).join("");
  } else if (node.type === "superscript") {
    text += (await Promise.all(node.children.map(async (child) => await treeToText(child, aiscriptHandler)))).join("");
  } else if (node.type === "highlight") {
    text += (await Promise.all(node.children.map(async (child) => await treeToText(child, aiscriptHandler)))).join("");
  } else if (node.type === "table") {
    text += `${(await Promise.all(node.header.map(
      async (cell, i) => `${(await Promise.all(cell.map(
        async (child) => await treeToText(child, aiscriptHandler)
      ))).join("")
        }\n`))).join("")
      }${(await Promise.all(node.rows.map(
        async (row) => `${(await Promise.all(row.map(
          async (cell, i) => `${(await Promise.all(cell.map(
            async (child) => await treeToText(child, aiscriptHandler)
          ))).join("")
            }`
        ))).join("")
          }\n`
      ))).join("")}`;
  } else if (node.type === "note") {
    text += (await Promise.all(node.children.map(async (child) => await treeToText(child, aiscriptHandler)))).join("");
  } else if (node.type === "aiscript") {
    if (node.scriptType === "dynamic") {
      text += node.content;
    } else {
      const result = aiscriptHandler ? await aiscriptHandler(node.content) : "";
      const tree = {
        "type": "root",
        "children": blockParser(result)
      };
      text += await treeToText(tree, aiscriptHandler);
    }
  } else if (node.type === "thematicBreak") {
    text += "\n";
  } else if (node.type === "root") {
    text += (await Promise.all(node.children.map(async (child) => await treeToText(child, aiscriptHandler)))).join("");
  }

  return text;
}

/**
 * 構文木をHTMLに変換する
 * @param {object} node 構文木
 * @param {object} referenceMap 参照定義のマップ
 * @param {object} footnoteMap 脚註のマップ
 * @param {function} aiscriptHandler aiscriptの処理関数
 * @param {Generator} counter カウントアップするジェネレーター
 * @returns {string} HTMLの文字列
 */
async function treeToHTML(node, referenceMap = {}, footnoteMap = {}, aiscriptHandler, counter) {
  let html = "";
  if (node.type === "text") {
    html += node.content;
  } else if (node.type === "lineBreak") {
    html += "<br>";
  } else if (node.type === "em") {
    html += `<em>${(await Promise.all(node.children.map(async (child) => await treeToHTML(child, referenceMap, footnoteMap, aiscriptHandler, counter)))).join("")}</em>`;
  } else if (node.type === "strong") {
    html += `<strong>${(await Promise.all(node.children.map(async (child) => await treeToHTML(child, referenceMap, footnoteMap, aiscriptHandler, counter)))).join("")}</strong>`;
  } else if (node.type === "link") {
    const titleAttr = node.title ? ` title="${node.title.replace(/"/g, "&quot;")}"` : "";
    html += `<a href="${node.url.replace(/"/g, "%22")}"${titleAttr}${node.url.match(/^http/) ? ' target="_blank"' : ""}>${(await Promise.all(node.children.map(async (child) => await treeToHTML(child, referenceMap, footnoteMap, aiscriptHandler, counter)))).join("")}</a>`;
  } else if (node.type === "image") {
    const titleAttr = node.title ? ` title="${node.title.replace(/"/g, "&quot;")}"` : "";
    html += `<img src="${node.url.replace(/"/g, "&quot;")}" alt="${node.alt.replace(/"/g, "&quot;")}"${titleAttr}>`;
  } else if (node.type === "code") {
    html += `<code>${node.content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code>`;
  } else if (node.type === "heading") {
    html += `<h${node.level} id="${counter.next().value}-${encodeURIComponent((await treeToText(node, aiscriptHandler)).trim())}">${(await Promise.all(node.children.map(async (child) => await treeToHTML(child, referenceMap, footnoteMap, aiscriptHandler, counter)))).join("")}</h${node.level}>`;
  } else if (node.type === "paragraph") {
    html += `<p>${(await Promise.all(node.children.map(async (child) => await treeToHTML(child, referenceMap, footnoteMap, aiscriptHandler, counter)))).join("")}</p>`;
  } else if (node.type === "list") {
    const tag = node.ordered ? "ol" : "ul";
    html += `<${tag}>${(await Promise.all(node.items.map(async (item) => `<li>${item.type === "checkListItem" ? `<input type="checkbox" disabled ${item.checked ? "checked" : ""}> ` : ""}${(await Promise.all(item.children.map(async (child) => await treeToHTML(child, referenceMap, footnoteMap, aiscriptHandler, counter)))).join("")}</li>`))).join("")}</${tag}>`;
  } else if (node.type === "blockQuote") {
    html += `<blockquote>${(await Promise.all(node.children.map(async (child) => await treeToHTML(child, referenceMap, footnoteMap, aiscriptHandler, counter)))).join("")}</blockquote>`;
  } else if (node.type === "codeBlock") {
    html += await codeToHtml(node.content, { lang: node.language, themes: { light: "ayu-light", dark: "ayu-dark" } });
  } else if (node.type === "math") {
    console.log("inline:" + node.content);
    html += await katex.renderToString(node.content, {
      displayMode: false
    });
  } else if (node.type === "mathBlock") {
    console.log("block:" + node.content);
    html += await katex.renderToString(node.content, {
      displayMode: true
    });
  } else if (node.type === "deleted") {
    html += `<del>${(await Promise.all(node.children.map(async (child) => await treeToHTML(child, referenceMap, footnoteMap, aiscriptHandler, counter)))).join("")}</del>`;
  } else if (node.type === "subscript") {
    html += `<sub>${(await Promise.all(node.children.map(async (child) => await treeToHTML(child, referenceMap, footnoteMap, aiscriptHandler, counter)))).join("")}</sub>`;
  } else if (node.type === "superscript") {
    html += `<sup>${(await Promise.all(node.children.map(async (child) => await treeToHTML(child, referenceMap, footnoteMap, aiscriptHandler, counter)))).join("")}</sup>`;
  } else if (node.type === "highlight") {
    html += `<mark>${(await Promise.all(node.children.map(async (child) => await treeToHTML(child, referenceMap, footnoteMap, aiscriptHandler, counter)))).join("")}</mark>`;
  } else if (node.type === "table") {
    html += `<table><thead><tr>${(await Promise.all(node.header.map(
      async (cell, i) => `<th style="text-align:${node.align[i]}">${(await Promise.all(cell.map(
        async (child) => await treeToHTML(child, referenceMap, footnoteMap, aiscriptHandler, counter)
      ))).join("")
        }</th>`))).join("")
      }</tr></thead><tbody>${(await Promise.all(node.rows.map(
        async (row) => `<tr>${(await Promise.all(row.map(
          async (cell, i) => `<td style="text-align:${node.align[i]}">${(await Promise.all(cell.map(
            async (child) => await treeToHTML(child, referenceMap, footnoteMap, aiscriptHandler, counter)
          ))).join("")
            }</td>`
        ))).join("")
          }</tr>`
      ))).join("")}</tbody></table>`;
  } else if (node.type === "note") {
    html += `<div class="note ${node.noteType}">${(await Promise.all(node.children.map(async (child) => await treeToHTML(child, referenceMap, footnoteMap, aiscriptHandler, counter)))).join("")}</div>`;
  } else if (node.type === "aiscript") {
    if (node.scriptType === "dynamic") {
      html += `<ai-script>${node.content}</ai-script>`;
    } else {
      const result = aiscriptHandler ? await aiscriptHandler(node.content) : "";
      const tree = {
        "type": "root",
        "children": blockParser(result)
      };
      const newHtml = await treeToHTML(tree, referenceMap, footnoteMap, aiscriptHandler, counter);
      html += newHtml;
    }
  } else if (node.type === "thematicBreak") {
    html += `<hr>`;
  } else if (node.type === "footnote") {
    const footnoteContent = footnoteMap[node.id] ? footnoteMap[node.id].footnote : "";
    html += `<sup class="footnote"><a href="#footnote-${node.id}">[${node.id}]</a></sup>`;
  } else if (node.type === "referenceLink") {
    const reference = Object.hasOwn(referenceMap, node.id) ? referenceMap[node.id] : null;
    const url = reference !== null ? reference.url : "#";
    const title = (reference !== null && reference.title ? ` title="${reference.title.replace(/"/g, "&quot;")}"` : "");
    html += `<a href="${url.replace(/"/g, "&quot;")}"${title}>${(await Promise.all(node.children.map(async (child) => await treeToHTML(child, referenceMap, footnoteMap, aiscriptHandler, counter)))).join("")}</a>`;
  } else if (node.type === "root") {
    html += (await Promise.all(node.children.map(async (child) => await treeToHTML(child, referenceMap, footnoteMap, aiscriptHandler, counter)))).join("");
  }

  return html;
}

/**
 * カウントアップするジェネレーター
 * @yields {number} カウント
 */
function* countGenerator() {
  let count = 0;
  while (true) {
    yield count++;
  }
}

/**
 * markdownの文字列をHTMLに変換する
 * @param {string} md markdownの文字列
 * @param {function} aiscriptHandler aiscriptの処理関数
 * @returns {string} HTMLの文字列
 */
async function mdread(md, aiscriptHandler = null) {
  const tree = {
    "type": "root",
    "children": blockParser(lineBreakUnifier(md))
  };

  const { referenceMap, footnoteMap } = findReferenceAndFootnotes(tree);
  let html = await treeToHTML(tree, referenceMap, footnoteMap, aiscriptHandler, countGenerator());

  if (Object.keys(footnoteMap).length > 0) {
    html += '<div class="footnotes">';
    Object.keys(footnoteMap).forEach(id => {
      html += `<div id="footnote-${id}" class="footnote-content">[${id}]: ${footnoteMap[id].footnote}</div>`;
    });
    html += '</div>';
  }

  return html;
}

export default mdread;