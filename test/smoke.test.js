import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("smoke test: build output contains required files", () => {
  const distDir = path.resolve(process.cwd(), "dist");
  assert.ok(fs.existsSync(distDir), "dist directory should exist");

  const indexPath = path.join(distDir, "index.html");
  assert.ok(fs.existsSync(indexPath), "dist/index.html should exist");

  const pkgPath = path.resolve(process.cwd(), "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

  const htmlContent = fs.readFileSync(indexPath, "utf-8");
  assert.ok(htmlContent.includes('id="root"'), "index.html should have #root mounting point");
  assert.ok(
    htmlContent.includes(`Trellis Kanban Board v${pkg.version}`),
    `index.html should have app title with version (expected v${pkg.version})`
  );

  const assetsDir = path.join(distDir, "assets");
  assert.ok(fs.existsSync(assetsDir), "dist/assets directory should exist");

  const assets = fs.readdirSync(assetsDir);
  const hasJs = assets.some((f) => f.endsWith(".js"));
  const hasCss = assets.some((f) => f.endsWith(".css"));

  const mainJs = assets.find((f) => f.startsWith("index-") && f.endsWith(".js"));
  assert.ok(mainJs, "main index js bundle should exist");
  const jsContent = fs.readFileSync(path.join(assetsDir, mainJs), "utf-8");
  assert.ok(jsContent.includes("Planning / Backlog"), "bundle should contain Planning / Backlog column");
  assert.ok(jsContent.includes("In Progress"), "bundle should contain In Progress column");
  assert.ok(jsContent.includes("Verification / Review"), "bundle should contain Verification / Review column");
  assert.ok(jsContent.includes("Implement task"), "bundle should support Implement task copy prompt");
  assert.ok(jsContent.includes("Check task"), "bundle should support Check task copy prompt");
  assert.ok(
    jsContent.includes("Kho bài học tránh bẫy") || jsContent.includes("Pitfalls"),
    "bundle should include DeepSeek Pitfalls Dossier view"
  );
  assert.ok(
    jsContent.includes("Knowledge Graph"),
    "bundle should include Knowledge Graph view"
  );
  assert.ok(
    jsContent.includes("Timeline"),
    "bundle should include Evolution Timeline view"
  );
  assert.ok(
    jsContent.includes("trellis_task_detail_width"),
    "bundle should include resizable task detail drawer width persistence"
  );
});
