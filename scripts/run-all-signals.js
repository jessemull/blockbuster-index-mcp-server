#!/usr/bin/env node

const { spawn } = require("child_process");

const signals = [
  "amazon",
  "analog",
  "broadband",
  "ecommerce",
  "physical",
  "streaming",
  "walmart",
];

console.log(`Running all signals in parallel:\n${signals.join(", ")}\n`);

const procs = signals.map((name) => {
  console.log(`Starting runner for: ${name}`);

  const tsNodeArgs = [`dev/runners/${name}.dev.ts`];

  const proc = spawn("npx", ["ts-node", ...tsNodeArgs], {
    stdio: "inherit",
    shell: true,
  });

  proc.on("exit", (code) => {
    console.log(`Runner for ${name} exited with code: ${code}`);
  });

  return proc;
});

Promise.all(procs.map(proc => new Promise((resolve) => {
  proc.on("exit", resolve);
}))).then(() => {
  console.log("All signal runners completed...");
  process.exit(0);
});
