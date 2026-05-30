const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");
const { bake } = require("./bake-render-svg.js");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const vendor = path.join(dist, "vendor");
const fonts = path.join(dist, "fonts");
const srcDist = path.join(dist, "src");

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

try {
  bake();
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(vendor, { recursive: true });
  fs.mkdirSync(fonts, { recursive: true });
  fs.mkdirSync(srcDist, { recursive: true });

  copyFile(path.join(root, "index.html"), path.join(dist, "index.html"));

  // Copy plain JS files as-is (no JSX transform needed)
  copyFile(path.join(root, "src", "pure.js"), path.join(srcDist, "pure.js"));
  copyFile(path.join(root, "src", "midi-cc-map.js"), path.join(srcDist, "midi-cc-map.js"));
  copyFile(path.join(root, "src", "render-svg-uri.js"), path.join(srcDist, "render-svg-uri.js"));

  // Compile each JSX source file to plain JS (no runtime Babel needed)
  const srcFiles = ["shared", "transport", "variant-phosphor", "firmware-updater", "midi-reference", "user-manual", "app"];
  for (const name of srcFiles) {
    const input = path.join(root, "src", `${name}.jsx`);
    const output = path.join(srcDist, `${name}.js`);
    const result = esbuild.transformSync(fs.readFileSync(input, "utf8"), {
      loader: "jsx",
      jsxFactory: "React.createElement",
      jsxFragment: "React.Fragment",
    });
    fs.writeFileSync(output, result.code);
  }

  copyFile(path.join(root, "node_modules/react/umd/react.production.min.js"),
    path.join(vendor, "react.production.min.js"));
  copyFile(path.join(root, "node_modules/react-dom/umd/react-dom.production.min.js"),
    path.join(vendor, "react-dom.production.min.js"));

  [
    ["@fontsource/inter/files/inter-latin-400-normal.woff2", "inter-latin-400-normal.woff2"],
    ["@fontsource/inter/files/inter-latin-600-normal.woff2", "inter-latin-600-normal.woff2"],
    ["@fontsource/inter/files/inter-latin-700-normal.woff2", "inter-latin-700-normal.woff2"],
    ["@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2", "jetbrains-mono-latin-400-normal.woff2"],
    ["@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2", "jetbrains-mono-latin-500-normal.woff2"],
    ["@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2", "jetbrains-mono-latin-700-normal.woff2"],
    ["@fontsource/dm-serif-display/files/dm-serif-display-latin-400-normal.woff2", "dm-serif-display-latin-400-normal.woff2"],
  ].forEach(([from, to]) => {
    copyFile(path.join(root, "node_modules", from), path.join(fonts, to));
  });

  console.log(`Built ${dist}`);
} catch (err) {
  console.error(`Build failed: ${err.message}`);
  process.exit(1);
}
