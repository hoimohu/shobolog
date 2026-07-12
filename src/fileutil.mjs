import { promises as fs } from "node:fs";
import path from "node:path";

// CRLFをLFにする関数
async function unifyLF(str) {
  return str.replace(/\r\n/g, '\n');
}

// ファイルを読み込んで、相対パスをkeyにしてObjectに詰めて返す関数
export async function getAllFiles(base) {
  const res = {};
  async function getAllFilesRec(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile()) {
        res[path.relative(base, fullPath)] =  await unifyLF(await fs.readFile(fullPath, "utf-8"));
      } else if (entry.isDirectory()) {
        await getAllFilesRec(fullPath);
      }
    }
  }

  await getAllFilesRec(base);

  return res;
}

// パスをkeyにしたObjectをもとにファイルを書き出す関数
export async function writeOutput(output) {
  for (const key in output) {
    const dir = path.dirname(key);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(key, output[key], "utf-8");
  }
}
