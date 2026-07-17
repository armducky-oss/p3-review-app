import { build } from "esbuild";

await build({
  entryPoints: ["src/main.jsx"],
  bundle: true,
  loader: { ".jsx": "jsx" },
  jsx: "automatic",
  format: "iife",
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
  outfile: "www/app.js",
});

console.log("web bundle built -> www/app.js");
