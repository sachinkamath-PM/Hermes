import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders Hermes product metadata and application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Hermes — Your world, remembered<\/title>/i);
  assert.match(html, /Hermes/);
  assert.match(html, /Interactive world map/i);
  assert.match(html, /Choose a country/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("ships the complete atlas data and removes starter preview code", async () => {
  const [page, app, atlas] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/HermesApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/country-data.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /<HermesApp \/>/);
  assert.match(app, /world-atlas\/countries-110m\.json/);
  assert.match(app, /localStorage\.setItem/);
  assert.ok(Object.keys(JSON.parse(atlas)).length >= 175);
  await assert.rejects(access(new URL("../app/_sites-preview", templateRoot)));
});
