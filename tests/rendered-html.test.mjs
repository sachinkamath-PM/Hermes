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
  const [page, app, styles, atlas, indiaRegions, usRegions, franceRegions] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/HermesApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
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
  assert.match(app, /tooltip-left/);
  assert.match(app, /tooltip-right/);
  assert.doesNotMatch(app, /country-glow|map-shadow/);
  assert.match(app, /Search countries, cities or regions/);
  assert.match(app, /Add any city or place/);
  assert.match(app, /regionSearchIndex/);
  assert.match(app, /First Footprint/);
  assert.match(app, /Atlas Elite/);
  assert.match(app, /AchievementPanel/);
  assert.match(app, /explorerXp/);
  assert.match(app, /Travel journal/);
  assert.match(app, /Add a memory/);
  assert.match(app, /JournalEntry/);
  assert.match(app, /journalEntries/);
  assert.match(app, /Trip planner/);
  assert.match(app, /Create trip/);
  assert.match(app, /Complete trip & update atlas/);
  assert.match(app, /TripDestination/);
  assert.match(app, /Explorer passport/);
  assert.match(app, /Your travel signature/);
  assert.match(app, /Download backup/);
  assert.match(app, /Restore backup/);
  assert.match(app, /Share journey/);
  assert.match(app, /MY NEXT MILESTONE/);
  assert.match(app, /restoreAtlas/);
  assert.match(app, /navigator\.share/);
  assert.match(app, /closeDesktopMenu/);
  assert.match(styles, /\.menu-button,.mobile-menu\{display:none!important\}/);
  assert.match(styles, /@media\(max-width:920px\)/);
  assert.match(app, /new Blob/);
  assert.match(app, /hermes-atlas-/);
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
