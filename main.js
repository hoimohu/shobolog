import { promises as fs } from "node:fs";
import path from "node:path";
import * as ais from "@syuilo/aiscript";
import mdread from "./mdr-custom.mjs";

console.log(new Date().toLocaleString());

const currentDir = process.cwd();

const setting = JSON.parse(await fs.readFile(path.join(currentDir, "setting.json"), "utf-8"));

const pagesDir = path.join(currentDir, setting.targetDir.pages);
const layoutDir = path.join(currentDir, setting.targetDir.layout);
const outputDir = path.join(currentDir, setting.targetDir.output);

async function getAllFiles(dir, converter) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const dirObj = {
    name: path.basename(dir),
    dirs: [],
    files: {}
  };
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile()) {
      const fileContent = await fs.readFile(fullPath, "utf-8");
      dirObj.files[entry.name] = await converter(fileContent, fullPath);
    } else if (entry.isDirectory()) {
      dirObj.dirs.push(await getAllFiles(fullPath, converter));
    }
  }
  return dirObj;
}

const layout = await getAllFiles(layoutDir, async (content) => content.replace(/\n|\r\n|\r/g, '\n'));

async function replaceVars(content, vars) {
  return content.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return vars[varName] || "";
  });
}

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

const parser = new ais.Parser();

async function aiscriptHandler(script) {
  let output = "";
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
    console.error("Error occurred while running AIScript:", error);
    return "";
  }
}

function getLayout(path, directory) {
  const spl = path.split("/");
  if (spl.length > 1) {
    return getLayout(spl.slice(1).join("/"), directory.dirs.find(dir => dir.name === spl[0]));
  } else {
    return directory.files[path] || "";
  }
}

async function writeOutput(dir, basePath = "") {
  if (basePath !== "") {
    await fs.mkdir(path.join(outputDir, basePath), { recursive: true });
  }
  for (const fileName in dir.files) {
    await fs.writeFile(path.join(outputDir, basePath, fileName.replace(/\.md$/, ".html")), dir.files[fileName], "utf-8");
  }
  for (const subDir of dir.dirs) {
    await writeOutput(subDir, path.join(basePath, subDir.name));
  }
}

async function prerender(dir, basePath = "") {
  const dirObj = {
    name: path.basename(basePath),
    dirs: [],
    files: {}
  };
  for (const fileName in dir.files) {
    const file = dir.files[fileName];
    const vars = { ...setting.var, ...file.vars };
    if (file.type === 'md') {
      // md
      vars.content = await mdread(await replaceVars(file.source, vars), aiscriptHandler);
      const layoutPath = (vars.layout || "default") + '.html';
      dirObj.files[fileName] = await replaceVars(getLayout(layoutPath, layout), vars);
    } else if (file.type === 'html') {
      // html
      dirObj.files[fileName] = await replaceVars(file.source, vars);
    }
  }
  for (const subDir of dir.dirs) {
    dirObj.dirs.push(await prerender(subDir, path.join(basePath, subDir.name)));
  }
  return dirObj;
}

async function main() {
  const pageList = [];

  const pages = await getAllFiles(pagesDir, async (content, fullPath) => {
    if (fullPath.endsWith(".md")) {
      const metadata = {
        tags: [],
        content: "",
        date: 0,
        lastUpdate: 0,
        path: '/' + path.relative(pagesDir, fullPath).replace(/\\/g, '/').replace(/\.md$/, '.html').replace(/index\.html$/, '')
      };
      let start = false;
      let mainContent = content.replace(/\n|\r\n|\r/g, '\n');
      const spl = mainContent.split('\n');
      for (let i = 0; i < spl.length; i++) {
        const line = spl[i];
        if (!start && line.trim() === "---") {
          start = true;
          continue;
        } else if (start && line.trim() === "---") {
          mainContent = spl.slice(i + 1).join("\n");
          break;
        } else {
          const match = line.match(/^([^:]+):\s*(\S*)$/);
          if (match) {
            if (match[1] === "tags") {
              while (++i < spl.length && spl[i].startsWith("-") && spl[i].trim() !== "---") {
                const tagMatch = spl[i].match(/-\s+(.+)/);
                if (tagMatch) {
                  metadata[match[1]].push(tagMatch[1]);
                }
              }
              i--;
            } else {
              metadata[match[1]] = match[2];
            }
          }
        }
      }

      if (metadata.lastUpdate === 0 && metadata.date !== 0) {
        metadata.lastUpdate = metadata.date;
      } else if (metadata.date === 0 && metadata.lastUpdate !== 0) {
        metadata.date = metadata.lastUpdate;
      }

      const metadataVars = metadata;
      metadataVars.tags = metadata.tags.join(", ");

      const concatVars = { ...metadataVars };
      const preContent = await mdread(await replaceVars(mainContent, concatVars), aiscriptHandler);

      concatVars.requiredSourceTags = '';
      if (preContent.match(/<ai-script>/)) {
        concatVars.requiredSourceTags += '<script src="/src/aiscript-element.js"></script>';
      }
      if (preContent.match(/class="katex/)) {
        if (concatVars.requiredSourceTags !== '') {
          concatVars.requiredSourceTags += '\n';
        }
        concatVars.requiredSourceTags += '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.47/dist/katex.min.css" integrity="sha384-nH0MfJ44wi1dd7w6jinlyBgljjS8EJAh2JBoRad8a3VDw2K69vfaaqm4WnR+gXtA" crossorigin="anonymous">';
      }
      if (preContent.match(/<pre/)) {
        if (concatVars.requiredSourceTags !== '') {
          concatVars.requiredSourceTags += '\n';
        }
        concatVars.requiredSourceTags += `<style>
@media (prefers-color-scheme: dark) {
  .shiki,
  .shiki span {
    color: var(--shiki-dark) !important;
    background-color: var(--shiki-dark-bg) !important;
  }
}</style>`;
      }
      if (preContent.match(/<code>/)) {
        if (concatVars.requiredSourceTags !== '') {
          concatVars.requiredSourceTags += '\n';
        }
        concatVars.requiredSourceTags += `<style>
@import url('https://fonts.googleapis.com/css2?family=Google+Sans+Code:ital,wght,MONO@0,300..800,1;1,300..800,1&display=swap');
code {
font-family: "Google Sans Code", monospace;
font-optical-sizing: auto;
font-weight:400;
font-style: normal;
font-variation-settings: "MONO" 1;
}</style>`;
      }

      let tocItems = '';
      for (let i = 0; i < preContent.length - 8; i++) {
        if (preContent[i] === '<' && preContent[i + 1] === 'h' && preContent[i + 2].match(/\d/)) {
          const slice = preContent.slice(i);
          if (slice.match(/^<h\d id="[^"]*">/)) {
            tocItems += `<li class="toc-item-${slice.match(/^<h(\d)/)[1]}"><a href="#${slice.match(/^<h\d id="([^"]*)">/)[1]}">${decodeURIComponent(slice.match(/^<h\d id="([^"]*)">/)[1].replace(/^\d+-/, ''))}</a></li>`;
          }
        }
      }

      concatVars.tableOfContents = (tocItems !== '' ? '<ul>' + tocItems + '</ul>' : '');

      pageList.push(concatVars);

      return { type: 'md', source: mainContent, vars: concatVars };
    } else {
      return { type: 'html', source: content, vars: {} };
    }
  });

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

  setting.var.pageList = ais.AiSON.stringify(pageList);

  const output = await prerender(pages);

  await writeOutput(output);
}

main();
