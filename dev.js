import { exec } from 'node:child_process';
import * as fs from 'node:fs';
import path from 'node:path';

let timeout = null;
function reserve() {
  if (timeout === null) {
    timeout = setTimeout(() => {
      exec('npm run build', (err, stdout, stderr) => {
        if (err) {
          console.error('[watch]error', stderr);
          return;
        }
        console.log(stdout);
      });
      timeout = null;
    }, 1000);
  }
}

fs.watch(path.join(process.cwd(), 'pages'), { recursive: true }, () => {
  reserve();
});
fs.watch(path.join(process.cwd(), 'layout'), { recursive: true }, () => {
  reserve();
});
