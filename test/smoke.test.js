import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("smoke test: build output contains required files", () => {
  const distDir = path.resolve(process.cwd(), "dist");
  assert.ok(fs.existsSync(distDir), "dist directory should exist");

  const indexPath = path.join(distDir, "index.html");
  assert.ok(fs.existsSync(indexPath), "dist/index.html should exist");

  const htmlContent = fs.readFileSync(indexPath, "utf-8");
  assert.ok(htmlContent.includes('id="root"'), "index.html should have #root mounting point");
  assert.ok(htmlContent.includes("Trellis Kanban Board"), "index.html should have app title");

  const assetsDir = path.join(distDir, "assets");
  assert.ok(fs.existsSync(assetsDir), "dist/assets directory should exist");

  const assets = fs.readdirSync(assetsDir);
  const hasJs = assets.some((f) => f.endsWith(".js"));
  const hasCss = assets.some((f) => f.endsWith(".css"));

  assert.ok(hasJs, "assets directory should contain bundled JS");
  assert.ok(hasCss, "assets directory should contain bundled CSS");
});
