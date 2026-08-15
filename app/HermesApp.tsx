"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Compass,
  Earth,
  Globe2,
  MapPin,
  Menu,
  Plane,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { geoGraticule10, geoMercator, geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import world from "world-atlas/countries-110m.json";
import countryDataJson from "./country-data.json";

type AtlasFeature = {
  id: string;
  type: "Feature";
  properties: { name: string };
  geometry: unknown;
};

type Place = { name: string; latitude: number; longitude: number };
type StatePlace = Place & { code: string };
type CityPlace = Place & { stateCode: string };
type CountryInfo = {
  code: string;
  flag: string;
  currency: string;
  latitude: number;
  longitude: number;
  states: StatePlace[];
  cities: CityPlace[];
};

const atlas = feature(
  world as never,
  (world as unknown as { objects: { countries: unknown } }).objects.countries as never,
) as unknown as { features: AtlasFeature[] };

const countries = atlas.features.filter((country) => country.properties.name !== "Antarctica");
const countryData = countryDataJson as Record<string, CountryInfo>;
const STORAGE_KEY = "hermes_travel_atlas_v1";
const initialVisited = ["India", "France", "Japan", "United States of America"];
const initialCities: Record<string, string[]> = {
  India: ["Delhi", "Mumbai"],
  France: ["Paris"],
  Japan: ["Tokyo", "Kyoto"],
  "United States of America": ["New York City", "San Francisco"],
};

function joinClass(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function HermesMark() {
  return (
    <span className="hermes-mark" aria-hidden="true">
      <i /><b /><em />
    </span>
  );
}

function CountryMap({
  country,
  info,
  visitedCities,
}: {
  country: AtlasFeature;
  info: CountryInfo;
  visitedCities: Set<string>;
}) {
  const projection = useMemo(
    () => geoMercator().fitExtent([[64, 52], [836, 442]], country as never),
    [country],
  );
  const path = useMemo(() => geoPath(projection), [projection]);

  const projectedStates = info.states
    .map((state) => ({ state, point: projection([state.longitude, state.latitude]) }))
    .filter((item): item is { state: StatePlace; point: [number, number] } => Boolean(item.point));
  const projectedCities = info.cities
    .map((city) => ({ city, point: projection([city.longitude, city.latitude]) }))
    .filter((item): item is { city: CityPlace; point: [number, number] } => Boolean(item.point));

  return (
    <svg className="country-map" viewBox="0 0 900 500" role="img" aria-label={`${country.properties.name} map with states and cities`}>
      <defs>
        <filter id="map-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="12" stdDeviation="12" floodColor="#062238" floodOpacity=".18" />
        </filter>
      </defs>
      <path className="country-shape" d={path(country as never) ?? ""} filter="url(#map-shadow)" />
      {projectedStates.map(({ state, point }, index) => (
        <g key={`${state.code}-${state.name}`} className="state-point" transform={`translate(${point[0]} ${point[1]})`}>
          <circle r={index < 12 ? 3 : 2} />
          {index < 10 && <text x="7" y="3">{state.name}</text>}
        </g>
      ))}
      {projectedCities.map(({ city, point }) => (
        <g key={`${city.stateCode}-${city.name}`} className={joinClass("city-point", visitedCities.has(city.name) && "visited")} transform={`translate(${point[0]} ${point[1]})`}>
          <circle r="7" /><circle r="2.5" />
          <text x="11" y="4">{city.name}</text>
        </g>
      ))}
    </svg>
  );
}

export default function HermesApp() {
  const [selectedCountry, setSelectedCountry] = useState<AtlasFeature | null>(null);
  const [visitedCountries, setVisitedCountries] = useState<Set<string>>(new Set(initialVisited));
  const [visitedCities, setVisitedCities] = useState<Record<string, string[]>>(initialCities);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "visited">("all");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as { countries?: string[]; cities?: Record<string, string[]> };
          if (Array.isArray(parsed.countries)) setVisitedCountries(new Set(parsed.countries));
          if (parsed.cities && typeof parsed.cities === "object") setVisitedCities(parsed.cities);
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ countries: [...visitedCountries], cities: visitedCities }));
  }, [hydrated, visitedCountries, visitedCities]);

  const worldProjection = useMemo(() => geoNaturalEarth1().fitExtent([[25, 24], [975, 476]], { type: "Sphere" } as never), []);
  const worldPath = useMemo(() => geoPath(worldProjection), [worldProjection]);
  const graticule = useMemo(() => geoGraticule10(), []);
  const exploredPercent = Math.round((visitedCountries.size / countries.length) * 100);
  const cityTotal = Object.values(visitedCities).reduce((sum, items) => sum + items.length, 0);
  const filteredCountries = countries.filter((country) => {
    const name = country.properties.name;
    return name.toLowerCase().includes(query.toLowerCase()) && (filter === "all" || visitedCountries.has(name));
  });

  const toggleCountry = (name: string) => {
    setVisitedCountries((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const toggleCity = (country: string, city: string) => {
    setVisitedCities((current) => {
      const next = new Set(current[country] ?? []);
      if (next.has(city)) next.delete(city); else next.add(city);
      return { ...current, [country]: [...next] };
    });
  };

  const openCountry = (country: AtlasFeature) => {
    setSelectedCountry(country);
    setSearchOpen(false);
    setQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (selectedCountry) {
    const name = selectedCountry.properties.name;
    const info = countryData[name] ?? { code: "", flag: "🌍", currency: "", latitude: 0, longitude: 0, states: [], cities: [] };
    const selectedVisitedCities = new Set(visitedCities[name] ?? []);
    return (
      <div className="hermes-app detail-mode">
        <Header onHome={() => setSelectedCountry(null)} />
        <main className="country-view">
          <aside className="country-rail">
            <button className="back-button" onClick={() => setSelectedCountry(null)}><ArrowLeft size={17} /> Back to world</button>
            <div className="country-identity">
              <span className="country-flag">{info.flag}</span>
              <p className="micro-label">COUNTRY ATLAS</p>
              <h1>{name}</h1>
              <p>{info.states.length || "Regional"} states & regions · {info.cities.length} featured cities</p>
            </div>
            <button className={joinClass("visited-country-button", visitedCountries.has(name) && "is-visited")} onClick={() => toggleCountry(name)}>
              {visitedCountries.has(name) ? <><Check size={18} /> Visited country</> : <><Plus size={18} /> Mark as visited</>}
            </button>
            <div className="country-stats">
              <div><span>City progress</span><strong>{selectedVisitedCities.size}<small> / {info.cities.length}</small></strong></div>
              <div><span>Currency</span><strong>{info.currency || "—"}</strong></div>
            </div>
            <div className="states-panel">
              <div className="section-title-row"><span>States & regions</span><small>{info.states.length}</small></div>
              <div className="states-list">
                {info.states.length ? info.states.map((state) => <span key={`${state.code}-${state.name}`}>{state.name}</span>) : <p>Regional data is being prepared for this territory.</p>}
              </div>
            </div>
          </aside>

          <section className="country-content">
            <div className="country-heading">
              <div><p className="micro-label">EXPLORE {info.code || "THE MAP"}</p><h2>Where have you been?</h2><p>Select cities as you retrace your journey through {name}.</p></div>
              <div className="legend"><span><i className="city-legend visited" /> Visited</span><span><i className="city-legend" /> To explore</span></div>
            </div>
            <div className="country-map-card">
              <CountryMap country={selectedCountry} info={info} visitedCities={selectedVisitedCities} />
              <span className="map-caption"><Compass size={15} /> State markers and featured city pins</span>
            </div>
            <section className="city-section">
              <div className="section-heading-row"><div><p className="micro-label">CITY LOG</p><h2>Top cities</h2></div><span>{selectedVisitedCities.size} of {info.cities.length} visited</span></div>
              <div className="city-grid">
                {info.cities.map((city) => {
                  const isVisited = selectedVisitedCities.has(city.name);
                  return (
                    <button key={`${city.stateCode}-${city.name}`} className={joinClass("city-card", isVisited && "visited")} onClick={() => toggleCity(name, city.name)}>
                      <span className="city-icon"><MapPin size={18} /></span>
                      <span><strong>{city.name}</strong><small>{info.states.find((state) => state.code === city.stateCode)?.name ?? city.stateCode}</small></span>
                      <i>{isVisited ? <Check size={16} /> : <Plus size={16} />}</i>
                    </button>
                  );
                })}
              </div>
            </section>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="hermes-app">
      <Header />
      <main className="atlas-layout">
        <aside className="journey-panel">
          <p className="micro-label">YOUR TRAVEL ATLAS</p>
          <h1>The world,<br />your story.</h1>
          <p className="journey-copy">Pin every place you’ve been and watch your personal map come alive.</p>
          <div className="progress-block">
            <div className="progress-orbit" style={{ "--progress": `${Math.max(exploredPercent, 1) * 3.6}deg` } as React.CSSProperties}>
              <div><strong>{exploredPercent}%</strong><span>explored</span></div>
            </div>
            <div className="progress-copy"><strong>{visitedCountries.size}</strong><span>countries visited</span><small>{countries.length - visitedCountries.size} left to discover</small></div>
          </div>
          <div className="mini-stats"><div><Plane size={17} /><span><strong>{cityTotal}</strong> cities</span></div><div><Globe2 size={17} /><span><strong>5</strong> continents</span></div></div>
          <div className="recent-section">
            <div className="section-title-row"><span>Recent pins</span><button onClick={() => setFilter(filter === "all" ? "visited" : "all")}>{filter === "all" ? "Visited only" : "Show all"}</button></div>
            <div className="recent-list">
              {[...visitedCountries].slice(-4).reverse().map((name) => (
                <button key={name} onClick={() => openCountry(countries.find((country) => country.properties.name === name)!)}>
                  <span>{countryData[name]?.flag ?? "🌍"}</span><span><strong>{name}</strong><small>{(visitedCities[name] ?? []).length} cities pinned</small></span><ChevronRight size={16} />
                </button>
              ))}
            </div>
          </div>
          <div className="journey-note"><Sparkles size={18} /><p><strong>Your atlas lives here.</strong><br />Changes save automatically on this device.</p></div>
        </aside>

        <section className="world-stage">
          <div className="atlas-toolbar">
            <div><p className="micro-label">INTERACTIVE WORLD MAP</p><h2>Choose a country</h2></div>
            <div className="search-wrap">
              <Search size={18} />
              <input value={query} onFocus={() => setSearchOpen(true)} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} placeholder="Search 176 countries" aria-label="Search countries" />
              {query && <button aria-label="Clear search" onClick={() => setQuery("")}><X size={16} /></button>}
              {searchOpen && query && <div className="search-results">
                {filteredCountries.slice(0, 8).map((country) => <button key={country.id} onClick={() => openCountry(country)}><span>{countryData[country.properties.name]?.flag ?? "🌍"}</span><span>{country.properties.name}</span>{visitedCountries.has(country.properties.name) && <Check size={15} />}</button>)}
                {!filteredCountries.length && <p>No country found.</p>}
              </div>}
            </div>
          </div>
          <div className="world-map-card">
            <div className="map-legend"><span><i className="visited" /> Visited</span><span><i /> Not yet</span></div>
            <svg className="world-map" viewBox="0 0 1000 500" role="img" aria-label="Interactive world map">
              <path className="ocean-sphere" d={worldPath({ type: "Sphere" } as never) ?? ""} />
              <path className="graticule" d={worldPath(graticule as never) ?? ""} />
              {countries.map((country) => {
                const name = country.properties.name;
                const isVisited = visitedCountries.has(name);
                return <path key={name} tabIndex={0} aria-label={`${name}${isVisited ? ", visited" : ""}`} className={joinClass("map-country", isVisited && "visited", hovered === name && "hovered")} d={worldPath(country as never) ?? ""} onMouseEnter={() => setHovered(name)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(name)} onBlur={() => setHovered(null)} onClick={() => openCountry(country)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") openCountry(country); }} />;
              })}
            </svg>
            {hovered && <div className="country-tooltip"><span>{countryData[hovered]?.flag ?? "🌍"}</span><div><strong>{hovered}</strong><small>{visitedCountries.has(hovered) ? "Visited · Open atlas" : "Open country atlas"}</small></div><ChevronRight size={16} /></div>}
            <div className="map-instruction"><Compass size={16} /><span>Click any country to open its map</span></div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Header({ onHome }: { onHome?: () => void }) {
  return (
    <header className="hermes-header">
      <button className="brand-button" onClick={onHome} aria-label="Hermes home"><HermesMark /><span><strong>Hermes</strong><small>by BuildQuick</small></span></button>
      <nav aria-label="Primary navigation"><button className="active"><Earth size={17} /> World map</button><button><MapPin size={17} /> My places</button><button><Plane size={17} /> Trips</button></nav>
      <div className="header-actions"><button className="menu-button" aria-label="Open menu"><Menu size={19} /></button><span className="profile-avatar">SK</span></div>
    </header>
  );
}
