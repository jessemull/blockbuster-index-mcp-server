#!/usr/bin/env node

const { spawn } = require('child_process');

const name = process.argv[2];

if (!name) {
  console.error('Please provide a signal name!');
  process.exit(1);
}

const tsNodeArgs = [`dev/runners/${name}.dev.ts`];

console.log(`Running ts-node for ${name}...\n`);

const proc = spawn('npx', ['ts-node', ...tsNodeArgs], {
  stdio: 'inherit',
  shell: true,
});

proc.on('exit', (code) => {
  console.log(`Process exited with code: ${code}`);
});
