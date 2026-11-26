import { readFile, writeFile } from "node:fs/promises";
import { build } from "esbuild";

const appBuild = await build({
  entryPoints: ["src/app/main.tsx"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  write: false,
  outdir: ".build-app",
  loader: { ".css": "css" },
});
const script = appBuild.outputFiles
  .find((file) => file.path.endsWith(".js"))
  ?.text.replace(/<\/script/gi, "<\\/script");
const style = appBuild.outputFiles.find((file) =>
  file.path.endsWith(".css"),
)?.text;
if (!script || !style)
  throw new Error("App build did not produce JavaScript and CSS.");

const template = await readFile("src/app/index.html", "utf8");
const html = stripTrailingWhitespace(
  template
    .replace("</head>", `<style>${style}</style></head>`)
    .replace("</body>", `<script type="module">${script}</script></body>`),
);

const serverBuild = await build({
  entryPoints: ["src/server/index.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  minify: true,
  outfile: "dist/server.js",
  write: false,
});
const serverScript = serverBuild.outputFiles[0]?.text;
if (!serverScript) throw new Error("Server build did not produce JavaScript.");
await writeFile(
  "dist/server.js",
  stripTrailingWhitespace(serverScript),
  "utf8",
);
await writeFile("dist/app.html", html, "utf8");

function stripTrailingWhitespace(value) {
  return `${value
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trimEnd()}\n`;
}
