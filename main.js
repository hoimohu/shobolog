import { promises as fs } from "fs";
import path from "path";
import * as ais from "@syuilo/aiscript";
import mdread from "./mdr-custom.mjs";

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
      dirObj.files[entry.name] = await converter(fileContent, entry.name);
    } else if (entry.isDirectory()) {
      dirObj.dirs.push(await getAllFiles(fullPath, converter));
    }
  }
  return dirObj;
}

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

async function main() {
  const layout = await getAllFiles(layoutDir, async (content) => content.replace(/\n|\r\n|\r/g, '\n'));
  const pages = await getAllFiles(pagesDir, async (content, name) => {
    if (name.endsWith(".md")) {
      const metadata = {
        tags: [],
        content: ""
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

      const metadataVars = metadata;
      metadataVars.tags = metadata.tags.join(", ");
      metadataVars.content = await mdread(mainContent, aiscriptHandler);
      let requiredSourceTags = '';
      if (metadataVars.content.match(/<ai-script>/)) {
        requiredSourceTags += '<script src="/src/aiscript-element.js"></script>';
      }
      if (metadataVars.content.match(/class="katex/)) {
        if (requiredSourceTags !== '') {
          requiredSourceTags += '\n';
        }
        requiredSourceTags += '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.47/dist/katex.min.css" integrity="sha384-nH0MfJ44wi1dd7w6jinlyBgljjS8EJAh2JBoRad8a3VDw2K69vfaaqm4WnR+gXtA" crossorigin="anonymous">';
      }
      if (metadataVars.content.match(/<pre/)) {
        if (requiredSourceTags !== '') {
          requiredSourceTags += '\n';
        }
        requiredSourceTags += `<style>
@media (prefers-color-scheme: dark) {
  .shiki,
  .shiki span {
    color: var(--shiki-dark) !important;
    background-color: var(--shiki-dark-bg) !important;
  }
}</style>`;
      }
      if (metadataVars.content.match(/<code>/)) {
        if (requiredSourceTags !== '') {
          requiredSourceTags += '\n';
        }
        requiredSourceTags += `<style>@import url('https://fonts.googleapis.com/css2?family=Google+Sans+Code:ital,wght,MONO@0,300..800,1;1,300..800,1&display=swap');code{font-family:"Google Sans Code",monospace;font-optical-sizing:auto;font-weight:400;font-style:normal;font-variation-settings:"MONO" 1;}</style>`;
      }
      const concatVars = { ...setting.var, ...metadataVars, requiredSourceTags };
      const layoutPath = (concatVars.layout || "default") + '.html';

      const html = await replaceVars(getLayout(layoutPath, layout), concatVars);
      return html;
    } else {
      return await replaceVars(content, setting.var);
    }
  });

  await writeOutput(pages);
}

main();
