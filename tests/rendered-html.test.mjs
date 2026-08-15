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
  const [page, app, atlas, indiaRegions, usRegions, franceRegions] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/HermesApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/country-data.json", import.meta.url), "utf8"),
    readFile(new URL("../public/admin1/IN.json", import.meta.url), "utf8"),
    readFile(new URL("../public/admin1/US.json", import.meta.url), "utf8"),
    readFile(new URL("../public/admin1/FR.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /<HermesApp \/>/);
  assert.match(app, /world-atlas\/countries-110m\.json/);
  assert.match(app, /localStorage\.setItem/);
  assert.match(app, /state-region/);
  assert.match(app, /onSelectRegion/);
  assert.match(app, /FeatureCollection/);
  assert.match(app, /territory-marker/);
  assert.match(app, /Continental United States/);
  assert.match(app, /Metropolitan France/);
  assert.match(app, /Geographic insets/);
  assert.match(app, /state-selection-outline/);
  assert.doesNotMatch(app, /country-glow|map-shadow/);
  assert.match(app, /Search countries, cities or regions/);
  assert.match(app, /Add any city or place/);
  assert.match(app, /regionSearchIndex/);
  assert.match(app, /const addPlace/);
  assert.match(app, /new Set\(current\)\.add\(countryName\)/);
  assert.ok(Object.keys(JSON.parse(atlas)).length >= 175);
  const indiaFeatures = JSON.parse(indiaRegions).features;
  assert.ok(indiaFeatures.length >= 30);
  assert.ok(indiaFeatures.some((region) => region.properties.name === "Lakshadweep"));
  assert.ok(indiaFeatures.some((region) => region.properties.name === "Andaman and Nicobar Islands"));
  const usFeatures = JSON.parse(usRegions).features;
  assert.ok(usFeatures.some((region) => region.properties.code === "AK"));
  assert.ok(usFeatures.some((region) => region.properties.code === "HI"));
  const franceFeatures = JSON.parse(franceRegions).features;
  for (const code of ["CY", "GP", "FF", "RE", "YT"]) {
    assert.ok(franceFeatures.some((region) => region.properties.code === code));
  }
  await assert.rejects(access(new URL("../app/_sites-preview", templateRoot)));
});
