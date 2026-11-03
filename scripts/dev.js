import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const children = [
  spawn(npm, ['--workspace', 'server', 'run', 'dev'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  }),
  spawn(npm, ['--workspace', 'web', 'run', 'dev'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  }),
];

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(code);
}

for (const child of children) {
  child.on('exit', (code) => {
    if (!shuttingDown) shutdown(code ?? 0);
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
