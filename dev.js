import { exec } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { watch } from 'node:fs';
import path from 'node:path';
import { generatePages } from './main.js';
import { writeOutput } from './src/fileutil.mjs';

const currentDir = process.cwd();

let prevOutput = {};
async function updateFiles() {
  console.log('Update: ' + new Date().toLocaleString());
  const newPages = await generatePages();
  const updatePages = {};
  for (const key in newPages) {
    const content = newPages[key];
    if (!Object.hasOwn(prevOutput, key) || prevOutput[key] !== content) {
      updatePages[key] = content;
      console.log('Change: ' + key);
    }
  }
  prevOutput = newPages;

  writeOutput(updatePages);
}

let timeout = null;
let executeTime = 0;
function reserve() {
  const now = Date.now();
  if (timeout === null) {
    timeout = setTimeout(() => {
      timeout = null;
      if (executeTime <= Date.now()) {
        updateFiles();
      } else {
        reserve();
      }
    }, 1000);
  } else {
    executeTime = now + 900;
  }
}

let pagesDir = '';
let pagesWatcher = null;
let layoutDir = '';
let layoutWatcher = null;
let varsDir = '';
let varsWatcher = null;

async function setWatcher() {
  console.log('Set watcher: ' + new Date().toLocaleString());
  const setting = JSON.parse(await fs.readFile(path.join(currentDir, 'setting.json'), 'utf-8'));

  const newPagesDir = path.join(currentDir, setting.targetDir.pages);
  const newLayoutDir = path.join(currentDir, setting.targetDir.layout);
  const newVarsDir = path.join(currentDir, setting.targetDir.vars);
  const newOutputDir = path.join(currentDir, setting.targetDir.output);

  if (pagesDir !== newPagesDir) {
    if (pagesWatcher != null) {
      pagesWatcher.close();
    }
    pagesDir = newPagesDir;
    pagesWatcher = watch(newPagesDir, { recursive: true }, reserve);
  }
  if (layoutDir !== newLayoutDir) {
    if (layoutWatcher != null) {
      layoutWatcher.close();
    }
    layoutDir = newLayoutDir;
    layoutWatcher = watch(newLayoutDir, { recursive: true }, reserve);
  }
  if (varsDir !== newVarsDir) {
    if (varsWatcher != null) {
      varsWatcher.close();
    }
    varsDir = newVarsDir;
    varsWatcher = watch(newVarsDir, { recursive: true }, reserve);
  }

  reserve();
}

watch(path.join(currentDir, 'setting.json'), {}, setWatcher);
setWatcher();