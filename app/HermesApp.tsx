"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";
import { geoGraticule10, geoMercator, geoPath } from "d3-geo";
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
type AdminRegion = {
  type: "Feature";
  properties: { id: string; name: string; type: string; code: string; latitude: number; longitude: number };
  geometry: unknown;
};
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

const territoryLayouts: Record<string, { mainLabel: string; insets: Array<{ code: string; label: string }> }> = {
  US: {
    mainLabel: "Continental United States",
    insets: [
      { code: "AK", label: "Alaska" },
      { code: "HI", label: "Hawaii" },
    ],
  },
  FR: {
    mainLabel: "Metropolitan France",
    insets: [
      { code: "CY", label: "French Guiana" },
      { code: "GP", label: "Guadeloupe" },
      { code: "FF", label: "Martinique" },
      { code: "RE", label: "Réunion" },
      { code: "YT", label: "Mayotte" },
    ],
  },
};

function CountryMap({
  country,
  info,
  visitedCities,
  regions,
  selectedRegionId,
  hoveredRegionId,
  onSelectRegion,
  onHoverRegion,
  onToggleCity,
}: {
  country: AtlasFeature;
  info: CountryInfo;
  visitedCities: Set<string>;
  regions: AdminRegion[];
  selectedRegionId: string | null;
  hoveredRegionId: string | null;
  onSelectRegion: (region: AdminRegion) => void;
  onHoverRegion: (region: AdminRegion | null) => void;
  onToggleCity: (city: string) => void;
}) {
  const territoryLayout = territoryLayouts[info.code];
  const remoteCodes = useMemo(
    () => new Set(territoryLayout?.insets.map((inset) => inset.code) ?? []),
    [territoryLayout],
  );
  const primaryRegions = useMemo(
    () => regions.filter((region) => !remoteCodes.has(region.properties.code)),
    [regions, remoteCodes],
  );
  const mapGeometry = useMemo(
    () => primaryRegions.length
      ? { type: "FeatureCollection", features: primaryRegions }
      : country,
    [country, primaryRegions],
  );
  const projection = useMemo(
    () => geoMercator().fitExtent(
      territoryLayout ? [[42, 54], [625, 452]] : [[52, 42], [848, 452]],
      mapGeometry as never,
    ),
    [mapGeometry, territoryLayout],
  );
  const path = useMemo(() => geoPath(projection), [projection]);
  const selectedRegion = regions.find((region) => region.properties.id === selectedRegionId) ?? null;
  const islandTerritories = useMemo(() => primaryRegions.flatMap((region) => {
    if ((region.geometry as { type?: string }).type !== "MultiPolygon") return [];
    if (!/(island|archipelago|atoll|lakshadweep)/i.test(region.properties.name)) return [];
    const [[x0, y0], [x1, y1]] = path.bounds(region as never);
    const width = Math.max(x1 - x0, 0);
    const height = Math.max(y1 - y0, 0);
    const boundsArea = width * height;
    const coverage = boundsArea ? path.area(region as never) / boundsArea : 1;
    const point = path.centroid(region as never);
    if (boundsArea < 50 || coverage > 0.16 || !point.every(Number.isFinite)) return [];
    return [{ region, point: point as [number, number] }];
  }), [path, primaryRegions]);
  const insetMaps = useMemo(() => {
    if (!territoryLayout) return [];
    const compact = territoryLayout.insets.length > 2;
    return territoryLayout.insets.flatMap((inset, index) => {
      const region = regions.find((candidate) => candidate.properties.code === inset.code);
      if (!region) return [];
      const width = compact ? 108 : 198;
      const height = compact ? 112 : 164;
      const x = compact ? 650 + (index % 2) * 120 : 678;
      const y = compact ? 48 + Math.floor(index / 2) * 130 : 72 + index * 188;
      const insetProjection = geoMercator().fitExtent(
        [[x + 12, y + 28], [x + width - 12, y + height - 12]],
        region as never,
      );
      return [{ ...inset, region, x, y, width, height, projection: insetProjection, path: geoPath(insetProjection) }];
    });
  }, [regions, territoryLayout]);
  const mapTransform = useMemo(() => {
    if (!selectedRegion || remoteCodes.has(selectedRegion.properties.code)) return { x: 0, y: 0, k: 1 };
    const [[x0, y0], [x1, y1]] = path.bounds(selectedRegion as never);
    const width = Math.max(x1 - x0, 1);
    const height = Math.max(y1 - y0, 1);
    const mapWidth = territoryLayout ? 640 : 900;
    const centerX = territoryLayout ? 322 : 450;
    const k = Math.min(2.35, Math.max(1, 0.76 / Math.max(width / mapWidth, height / 500)));
    return { x: centerX - k * ((x0 + x1) / 2), y: 250 - k * ((y0 + y1) / 2), k };
  }, [path, remoteCodes, selectedRegion, territoryLayout]);

  const projectedCities = info.cities
    .filter((city) => !remoteCodes.has(city.stateCode))
    .map((city) => ({ city, point: projection([city.longitude, city.latitude]) }))
    .filter((item): item is { city: CityPlace; point: [number, number] } => Boolean(item.point));

  return (
    <svg className={joinClass("country-map", selectedRegionId && "has-selection")} viewBox="0 0 900 500" role="img" aria-label={`${country.properties.name} map with states and cities`}>
      <defs>
        <filter id="map-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="12" stdDeviation="12" floodColor="#062238" floodOpacity=".18" />
        </filter>
      </defs>
      {territoryLayout && regions.length > 0 && <text className="main-map-label" x="42" y="32">{territoryLayout.mainLabel}</text>}
      <g className="country-map-layer" style={{ transform: `translate(${mapTransform.x}px, ${mapTransform.y}px) scale(${mapTransform.k})` }}>
      <path className="country-shape" d={path(mapGeometry as never) ?? ""} filter="url(#map-shadow)" />
      {primaryRegions.map((region) => {
        const isSelected = selectedRegionId === region.properties.id;
        const isHovered = hoveredRegionId === region.properties.id;
        const isExplored = info.cities.some((city) => city.stateCode === region.properties.code && visitedCities.has(city.name));
        return (
          <path
            key={region.properties.id}
            tabIndex={0}
            aria-label={`${region.properties.name}, ${region.properties.type}`}
            className={joinClass("state-region", isSelected && "selected", isHovered && "hovered", isExplored && "explored")}
            d={path(region as never) ?? ""}
            onMouseEnter={() => onHoverRegion(region)}
            onMouseLeave={() => onHoverRegion(null)}
            onFocus={() => onHoverRegion(region)}
            onBlur={() => onHoverRegion(null)}
            onClick={() => onSelectRegion(region)}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelectRegion(region); }}
          />
        );
      })}
      {islandTerritories.map(({ region, point }) => {
        const isSelected = selectedRegionId === region.properties.id;
        const isHovered = hoveredRegionId === region.properties.id;
        return (
          <g
            key={`${region.properties.id}-island-marker`}
            tabIndex={0}
            role="button"
            aria-label={`${region.properties.name}, island territory`}
            className={joinClass("territory-marker", isSelected && "selected", isHovered && "hovered")}
            transform={`translate(${point[0]} ${point[1]})`}
            onMouseEnter={() => onHoverRegion(region)}
            onMouseLeave={() => onHoverRegion(null)}
            onFocus={() => onHoverRegion(region)}
            onBlur={() => onHoverRegion(null)}
            onClick={() => onSelectRegion(region)}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelectRegion(region); }}
          >
            <circle className="territory-marker-halo" r="8" />
            <circle className="territory-marker-core" r="3" />
            <text x="12" y="3.5">{region.properties.name}</text>
          </g>
        );
      })}
      {projectedCities.map(({ city, point }) => (
        <g key={`${city.stateCode}-${city.name}`} tabIndex={0} role="button" aria-label={`${city.name}${visitedCities.has(city.name) ? ", visited" : ", mark as visited"}`} className={joinClass("city-point", visitedCities.has(city.name) && "visited", selectedRegion?.properties.code === city.stateCode && "in-focus")} transform={`translate(${point[0]} ${point[1]})`} onClick={(event) => { event.stopPropagation(); onToggleCity(city.name); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onToggleCity(city.name); }}>
          <circle r="7" /><circle r="2.5" />
          <text x="11" y="4">{city.name}</text>
        </g>
      ))}
      </g>
      {insetMaps.map((inset) => {
        const isSelected = selectedRegionId === inset.region.properties.id;
        const isHovered = hoveredRegionId === inset.region.properties.id;
        const isExplored = info.cities.some((city) => city.stateCode === inset.code && visitedCities.has(city.name));
        const insetCities = info.cities
          .filter((city) => city.stateCode === inset.code)
          .map((city) => ({ city, point: inset.projection([city.longitude, city.latitude]) }))
          .filter((item): item is { city: CityPlace; point: [number, number] } => Boolean(item.point));
        return (
          <g key={`${inset.code}-inset`} className={joinClass("territory-inset", isSelected && "selected", isHovered && "hovered")}>
            <rect className="territory-inset-frame" x={inset.x} y={inset.y} width={inset.width} height={inset.height} rx="10" />
            <text className="territory-inset-label" x={inset.x + 11} y={inset.y + 17}>{inset.label}</text>
            <path
              tabIndex={0}
              aria-label={`${inset.region.properties.name}, ${inset.region.properties.type}`}
              className={joinClass("state-region inset-region", isSelected && "selected", isHovered && "hovered", isExplored && "explored")}
              d={inset.path(inset.region as never) ?? ""}
              onMouseEnter={() => onHoverRegion(inset.region)}
              onMouseLeave={() => onHoverRegion(null)}
              onFocus={() => onHoverRegion(inset.region)}
              onBlur={() => onHoverRegion(null)}
              onClick={() => onSelectRegion(inset.region)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelectRegion(inset.region); }}
            />
            {insetCities.map(({ city, point }) => (
              <g key={`${inset.code}-${city.name}`} tabIndex={0} role="button" aria-label={`${city.name}${visitedCities.has(city.name) ? ", visited" : ", mark as visited"}`} className={joinClass("city-point inset-city", visitedCities.has(city.name) && "visited", isSelected && "in-focus")} transform={`translate(${point[0]} ${point[1]})`} onClick={(event) => { event.stopPropagation(); onToggleCity(city.name); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onToggleCity(city.name); }}>
                <circle r="6" /><circle r="2" />
                <text x="9" y="3">{city.name}</text>
              </g>
            ))}
          </g>
        );
      })}
      {territoryLayout && regions.length > 0 && <text className="cartography-note" x="876" y="486">Geographic insets · scales vary</text>}
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
  const [regions, setRegions] = useState<AdminRegion[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "visited">("all");
  const [hydrated, setHydrated] = useState(false);
  const [worldTransform, setWorldTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [transitioningCountry, setTransitioningCountry] = useState<string | null>(null);
  const [tooltipPoint, setTooltipPoint] = useState({ x: 50, y: 50 });
  const countryTransitionTimer = useRef<number | null>(null);
  const dragState = useRef<{ pointerId: number; clientX: number; clientY: number; originX: number; originY: number; moved: boolean } | null>(null);
  const suppressCountryClick = useRef(false);

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

  useEffect(() => {
    const countryCode = selectedCountry ? countryData[selectedCountry.properties.name]?.code : null;
    const controller = new AbortController();
    const resetTimer = window.setTimeout(() => {
      setRegions([]);
      setRegionsLoading(Boolean(countryCode));
      setSelectedRegionId(null);
      setHoveredRegionId(null);
    }, 0);
    if (!countryCode) return () => { window.clearTimeout(resetTimer); controller.abort(); };
    fetch(`/admin1/${countryCode}.json`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("No regional map")))
      .then((collection: { features?: AdminRegion[] }) => setRegions(collection.features ?? []))
      .catch((error: Error) => { if (error.name !== "AbortError") setRegions([]); })
      .finally(() => { if (!controller.signal.aborted) setRegionsLoading(false); });
    return () => { window.clearTimeout(resetTimer); controller.abort(); };
  }, [selectedCountry]);

  useEffect(() => () => {
    if (countryTransitionTimer.current) window.clearTimeout(countryTransitionTimer.current);
  }, []);

  const worldProjection = useMemo(
    () => geoMercator().fitExtent([[-12, 2], [1012, 548]], { type: "FeatureCollection", features: countries } as never),
    [],
  );
  const worldPath = useMemo(() => geoPath(worldProjection), [worldProjection]);
  const graticule = useMemo(() => geoGraticule10(), []);
  const exploredPercent = Math.round((visitedCountries.size / countries.length) * 100);
  const cityTotal = Object.values(visitedCities).reduce((sum, items) => sum + items.length, 0);
  const filteredCountries = countries.filter((country) => {
    const name = country.properties.name;
    return name.toLowerCase().includes(query.toLowerCase()) && (filter === "all" || visitedCountries.has(name));
  });
  const hoveredCountry = hovered ? countries.find((country) => country.properties.name === hovered) ?? null : null;

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

  const resetWorldView = () => setWorldTransform({ x: 0, y: 0, k: 1 });

  const zoomWorld = (nextScale: number, anchorX = 500, anchorY = 275) => {
    setWorldTransform((current) => {
      const k = Math.min(5, Math.max(1, nextScale));
      if (k === 1) return { x: 0, y: 0, k: 1 };
      const limitX = 500 * (k - 1);
      const limitY = 275 * (k - 1);
      return {
        x: Math.min(limitX, Math.max(-limitX, anchorX - ((anchorX - current.x) * k) / current.k)),
        y: Math.min(limitY, Math.max(-limitY, anchorY - ((anchorY - current.y) * k) / current.k)),
        k,
      };
    });
  };

  const handleWorldWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const anchorX = ((event.clientX - bounds.left) / bounds.width) * 1000;
    const anchorY = ((event.clientY - bounds.top) / bounds.height) * 550;
    const factor = event.deltaY > 0 ? 0.84 : 1.18;
    zoomWorld(worldTransform.k * factor, anchorX, anchorY);
  };

  const handleWorldPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || worldTransform.k <= 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, originX: worldTransform.x, originY: worldTransform.y, moved: false };
    setIsPanning(true);
  };

  const handleWorldPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const dx = ((event.clientX - drag.clientX) / bounds.width) * 1000;
    const dy = ((event.clientY - drag.clientY) / bounds.height) * 550;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    const limitX = 500 * (worldTransform.k - 1);
    const limitY = 275 * (worldTransform.k - 1);
    setWorldTransform((current) => ({ ...current, x: Math.min(limitX, Math.max(-limitX, drag.originX + dx)), y: Math.min(limitY, Math.max(-limitY, drag.originY + dy)) }));
  };

  const handleWorldPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    suppressCountryClick.current = drag.moved;
    dragState.current = null;
    setIsPanning(false);
    window.setTimeout(() => { suppressCountryClick.current = false; }, 0);
  };

  const updateTooltipPoint = (event: React.MouseEvent<SVGPathElement>) => {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const bounds = svg.getBoundingClientRect();
    setTooltipPoint({ x: ((event.clientX - bounds.left) / bounds.width) * 100, y: ((event.clientY - bounds.top) / bounds.height) * 100 });
  };

  const animateIntoCountry = (country: AtlasFeature) => {
    if (suppressCountryClick.current) return;
    const [[x0, y0], [x1, y1]] = worldPath.bounds(country as never);
    const width = Math.max(x1 - x0, 1);
    const height = Math.max(y1 - y0, 1);
    const k = Math.min(4.4, Math.max(1.35, 0.7 / Math.max(width / 1000, height / 550)));
    setTransitioningCountry(country.properties.name);
    setWorldTransform({ x: 500 - k * ((x0 + x1) / 2), y: 275 - k * ((y0 + y1) / 2), k });
    if (countryTransitionTimer.current) window.clearTimeout(countryTransitionTimer.current);
    countryTransitionTimer.current = window.setTimeout(() => {
      openCountry(country);
      setTransitioningCountry(null);
    }, 520);
  };

  const returnToWorld = () => {
    setSelectedCountry(null);
    setSelectedRegionId(null);
    window.setTimeout(resetWorldView, 0);
  };

  if (selectedCountry) {
    const name = selectedCountry.properties.name;
    const info = countryData[name] ?? { code: "", flag: "🌍", currency: "", latitude: 0, longitude: 0, states: [], cities: [] };
    const selectedVisitedCities = new Set(visitedCities[name] ?? []);
    const selectedRegion = regions.find((region) => region.properties.id === selectedRegionId) ?? null;
    const hoveredRegion = regions.find((region) => region.properties.id === hoveredRegionId) ?? null;
    const activeRegion = hoveredRegion ?? selectedRegion;
    const selectedRegionCities = selectedRegion
      ? info.cities.filter((city) => city.stateCode === selectedRegion.properties.code)
      : info.cities;
    const shownCities = selectedRegion ? selectedRegionCities : info.cities;
    const selectedTerritoryLayout = territoryLayouts[info.code];
    const selectedRemoteCodes = new Set(selectedTerritoryLayout?.insets.map((inset) => inset.code) ?? []);
    const mainRegions = regions.filter((region) => !selectedRemoteCodes.has(region.properties.code));
    const remoteRegions = regions.filter((region) => selectedRemoteCodes.has(region.properties.code));
    return (
      <div className="hermes-app detail-mode">
        <Header onHome={returnToWorld} />
        <main className="country-view">
          <aside className="country-rail">
            <button className="back-button" onClick={returnToWorld}><ArrowLeft size={17} /> Back to world</button>
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
              <div className="section-title-row"><span>States & regions</span><small>{regions.length || info.states.length}</small></div>
              <div className="states-list">
                {regions.length ? <>
                  {mainRegions.map((region) => (
                    <button
                      key={region.properties.id}
                      className={selectedRegionId === region.properties.id ? "selected" : ""}
                      onMouseEnter={() => setHoveredRegionId(region.properties.id)}
                      onMouseLeave={() => setHoveredRegionId(null)}
                      onClick={() => setSelectedRegionId(selectedRegionId === region.properties.id ? null : region.properties.id)}
                    >{region.properties.name}</button>
                  ))}
                  {remoteRegions.length > 0 && <span className="territory-list-heading">Remote territories</span>}
                  {remoteRegions.map((region) => (
                    <button
                      key={region.properties.id}
                      className={joinClass("territory-list-item", selectedRegionId === region.properties.id && "selected")}
                      onMouseEnter={() => setHoveredRegionId(region.properties.id)}
                      onMouseLeave={() => setHoveredRegionId(null)}
                      onClick={() => setSelectedRegionId(selectedRegionId === region.properties.id ? null : region.properties.id)}
                    >{region.properties.name}</button>
                  ))}
                </> : info.states.length ? info.states.map((state) => <span key={`${state.code}-${state.name}`}>{state.name}</span>) : <p>Regional data is being prepared for this territory.</p>}
              </div>
            </div>
          </aside>

          <section className="country-content">
            <div className="country-heading">
              <div><p className="micro-label">EXPLORE {info.code || "THE MAP"}</p><h2>Where have you been?</h2><p>Select cities as you retrace your journey through {name}.</p></div>
              <div className="legend"><span><i className="city-legend visited" /> Visited</span><span><i className="city-legend" /> To explore</span></div>
            </div>
            <div className="country-map-card">
              <CountryMap
                country={selectedCountry}
                info={info}
                visitedCities={selectedVisitedCities}
                regions={regions}
                selectedRegionId={selectedRegionId}
                hoveredRegionId={hoveredRegionId}
                onHoverRegion={(region) => setHoveredRegionId(region?.properties.id ?? null)}
                onSelectRegion={(region) => setSelectedRegionId(selectedRegionId === region.properties.id ? null : region.properties.id)}
                onToggleCity={(city) => toggleCity(name, city)}
              />
              {regionsLoading && <div className="map-loading"><span /> Drawing regional boundaries…</div>}
              {activeRegion && (
                <div className={joinClass("region-inspector", selectedRegion?.properties.id === activeRegion.properties.id && "pinned")}>
                  <span className="region-index">{activeRegion.properties.code || "01"}</span>
                  <div><small>{activeRegion.properties.type}</small><strong>{activeRegion.properties.name}</strong><em>{selectedRegion?.properties.id === activeRegion.properties.id ? "Selected" : "Click to select"}</em></div>
                  {selectedRegion?.properties.id === activeRegion.properties.id && <Check size={17} />}
                </div>
              )}
              {selectedRegion && <button className="reset-country-view" onClick={() => setSelectedRegionId(null)}><RotateCcw size={14} /> Entire country</button>}
              <span className="map-caption"><Compass size={15} /> Hover a region · click to select</span>
            </div>
            <section className="city-section">
              <div className="section-heading-row"><div><p className="micro-label">CITY LOG</p><h2>{selectedRegion ? selectedRegion.properties.name : "Top cities"}</h2></div><span>{selectedRegion ? <button className="clear-region" onClick={() => setSelectedRegionId(null)}>Show all cities</button> : `${selectedVisitedCities.size} of ${info.cities.length} visited`}</span></div>
              <div className="city-grid">
                {shownCities.map((city) => {
                  const isVisited = selectedVisitedCities.has(city.name);
                  return (
                    <button key={`${city.stateCode}-${city.name}`} className={joinClass("city-card", isVisited && "visited")} onClick={() => toggleCity(name, city.name)}>
                      <span className="city-icon"><MapPin size={18} /></span>
                      <span><strong>{city.name}</strong><small>{info.states.find((state) => state.code === city.stateCode)?.name ?? city.stateCode}</small></span>
                      <i>{isVisited ? <Check size={16} /> : <Plus size={16} />}</i>
                    </button>
                  );
                })}
                {selectedRegion && shownCities.length === 0 && <div className="empty-city-state"><MapPin size={19} /><strong>No featured cities yet</strong><span>The territory remains fully selectable on your travel map.</span></div>}
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
          <div className={joinClass("world-map-card", hovered && "has-country-hover", transitioningCountry && "is-entering-country")}>
            <div className="map-card-title"><Globe2 size={15} /><span>Personal world atlas</span><small>{countries.length} destinations</small></div>
            <div className="map-legend"><span><i className="visited" /> Visited</span><span><i /> Not yet</span></div>
            <div className="map-zoom-controls" aria-label="Map zoom controls">
              <button onClick={() => zoomWorld(worldTransform.k * 1.35)} aria-label="Zoom in"><ZoomIn size={16} /></button>
              <button onClick={() => zoomWorld(worldTransform.k / 1.35)} aria-label="Zoom out" disabled={worldTransform.k <= 1}><ZoomOut size={16} /></button>
              <button onClick={resetWorldView} aria-label="Reset map" disabled={worldTransform.k <= 1}><RotateCcw size={15} /></button>
            </div>
            <svg className={joinClass("world-map", isPanning && "is-panning")} viewBox="0 0 1000 550" role="img" aria-label="Interactive world map" onWheel={handleWorldWheel} onPointerDown={handleWorldPointerDown} onPointerMove={handleWorldPointerMove} onPointerUp={handleWorldPointerUp} onPointerCancel={handleWorldPointerUp}>
              <defs>
                <filter id="country-glow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#ed7045" floodOpacity=".48" /></filter>
              </defs>
              <g className={joinClass("world-map-layer", hovered && "has-hover")} style={{ transform: `translate(${worldTransform.x}px, ${worldTransform.y}px) scale(${worldTransform.k})` }}>
              <path className="graticule" d={worldPath(graticule as never) ?? ""} />
              {countries.map((country) => {
                const name = country.properties.name;
                const isVisited = visitedCountries.has(name);
                return <path key={name} tabIndex={0} aria-label={`${name}${isVisited ? ", visited" : ""}`} className={joinClass("map-country", isVisited && "visited", hovered === name && "hovered", transitioningCountry === name && "entering")} d={worldPath(country as never) ?? ""} onMouseEnter={() => setHovered(name)} onMouseMove={updateTooltipPoint} onMouseLeave={() => setHovered(null)} onFocus={() => { setHovered(name); const [x, y] = worldPath.centroid(country as never); setTooltipPoint({ x: x / 10, y: y / 5.5 }); }} onBlur={() => setHovered(null)} onClick={() => animateIntoCountry(country)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") animateIntoCountry(country); }} />;
              })}
              {hoveredCountry && <path className="active-country-halo" d={worldPath(hoveredCountry as never) ?? ""} />}
              </g>
            </svg>
            {hovered && !isPanning && <div className="country-tooltip" style={{ "--tooltip-x": `${tooltipPoint.x}%`, "--tooltip-y": `${tooltipPoint.y}%` } as React.CSSProperties}><span>{countryData[hovered]?.flag ?? "🌍"}</span><div><strong>{hovered}</strong><small>{visitedCountries.has(hovered) ? "Visited · Open atlas" : "Open country atlas"}</small></div><ChevronRight size={16} /></div>}
            <div className="map-instruction"><Compass size={16} /><span>{worldTransform.k > 1 ? "Drag to explore · scroll to zoom" : "Click a country · scroll to zoom"}</span></div>
            <div className="map-scale"><span /><span /><span /><small>EXPLORE</small></div>
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
