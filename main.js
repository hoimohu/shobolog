import { promises as fs } from 'node:fs';
import path from 'node:path';
import * as ais from '@syuilo/aiscript';
import mdread from './src/mdr-custom.mjs';
import { getAllFiles } from './src/fileutil.mjs';
import { generateTableOfContents, getMetadata, getRequiredTags } from './src/mdutil.mjs';
import { writeOutput } from './src/fileutil.mjs';

// 実行するときに日時を表示
console.log(new Date().toLocaleString());

// 作業ディレクトリ
const currentDir = process.cwd();

// AiScriptの実行結果を文字列に変換する関数
function valueToString(v) {
  const output = ais.utils.valToJs(v);
  switch (typeof output) {
    case 'string':
      return output;
    case 'number':
      return output.toString();
    case 'boolean':
      return output ? 'true' : 'false';
    case 'object':
      if (Array.isArray(output)) {
        return '[' + output.map((v) => valueToString(v)).join(', ') + ']';
      } else {
        return '{' + Object.entries(output).map(([k, v]) => `${k}: ${valueToString(v)}`).join(', ') + '}';
      }
    default:
      return ais.utils.valToString(v);
  }
}
// AiScriptパーサー (再利用する)
const parser = new ais.Parser();
// mdreadreに渡す、AiScriptを処理するための関数
async function aiscriptHandler(script) {
  let output = '';
  const interpreter = new ais.Interpreter({}, {
    out: (value) => {
      output += valueToString(value);
    }
  });
  try {
    const ast = parser.parse(script);
    await interpreter.exec(ast);
    return output;
  } catch (error) {
    console.error('Error occurred while running AIScript:', error);
    return '';
  }
}

// ページを生成する
export async function generatePages() {
  // 設定ファイル読み込み
  const setting = JSON.parse(await fs.readFile(path.join(currentDir, 'setting.json'), 'utf-8'));
  // もろもろのパス
  const pagesDir = path.join(currentDir, setting.targetDir.pages);
  const layoutDir = path.join(currentDir, setting.targetDir.layout);
  const varsDir = path.join(currentDir, setting.targetDir.vars);
  const outputDir = path.join(currentDir, setting.targetDir.output);

  // レイアウトのファイルを取得
  const layout = await getAllFiles(layoutDir);
  // 変数ファイルを読み込む
  const varsFile = await getAllFiles(varsDir);

  // 変数を置換する関数
  async function replaceVars(content, vars) {
    return content.replace(/\{\{([^\{\}]+)\}\}/g, (match, varName) => {
      return vars[varName] || '';
    });
  }

  const pageFiles = await getAllFiles(pagesDir);
  const pageSources = {};
  const pageList = [];

  // メタデータを取得し、変数を設定する
  for (const key in pageFiles) {
    const content = pageFiles[key];
    if (key.endsWith('md')) {
      const metadata = {
        ...await getMetadata(content),
        path: ('/' + key.replace(/\\/g, '/').replace(/\.md$/, '.html').replace(/index\.html$/, ''))
      };
      pageList.push({...metadata, content});
      const concatVars = { requiredTags: '', ...setting.var, ...varsFile, ...metadata };
      concatVars.tags = metadata.tags.join(", ");

      // この後の処理のために仮レンダリングする
      const preRenderedContent = await mdread(await replaceVars(concatVars.content, { ...concatVars, pageList: '[]' }), aiscriptHandler);
      concatVars.requiredTags += await getRequiredTags(preRenderedContent);
      concatVars.tableOfContents = await generateTableOfContents(preRenderedContent);
      pageSources[key] = { type: 'md', source: concatVars.content, vars: concatVars };

    } else if (key.match(/(\.htm|\.html)$/)) {
      pageSources[key] = { type: 'html', source: content, vars: concatVars };
    } else {
      pageSources[key] = { type: 'unknown', source: content, vars: concatVars };
    }
  }

  // pageListを最終更新日でソート
  pageList.sort((a, b) => {
    const da = new Date(a.lastUpdate);
    const db = new Date(b.lastUpdate);
    if (da < db) {
      return 1;
    } else if (da == db) {
      return 0;
    } else {
      return -1;
    }
  });

  const pageListVar = ais.AiSON.stringify(pageList);

  // 本番レンダリング
  const output = {};
  for (const key in pageSources) {
    const page = pageSources[key];
    const vars = { ...page.vars, pageList: pageListVar };
    for (const key in vars) {
      if (key.endsWith('.md')) {
        vars[key] = await mdread(await replaceVars(vars[key], vars), aiscriptHandler);
      } else if (key.endsWith('.ais')) {
        vars[key] = await aiscriptHandler(await replaceVars(vars[key], vars));
      }
    }
    const outputPath = path.join(outputDir, (key.replace(/\.md$/, '.html')));
    if (page.type === 'md') {
      vars.content = await mdread(await replaceVars(page.source, vars), aiscriptHandler);
      const layoutPath = (vars.layout || 'default') + '.html';
      output[outputPath] = await replaceVars(layout[layoutPath], vars);
    } else if (page.type === 'html') {
      output[outputPath] = await replaceVars(page.source, vars);
    }
  }

  return output;
}

async function main() {
  await writeOutput(await generatePages());
}

main();
