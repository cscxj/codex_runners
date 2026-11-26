import { spawn } from "node:child_process";
import { watch } from "node:fs";

let child;
let timer;

async function rebuild() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    child?.kill();
    const build = spawn("pnpm", ["build"], { stdio: "inherit" });
    build.on("exit", (code) => {
      if (code === 0)
        child = spawn("node", ["dist/server.js"], { stdio: "inherit" });
    });
  }, 100);
}

watch("src", { recursive: true }, rebuild);
await rebuild();
