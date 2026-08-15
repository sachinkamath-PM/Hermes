"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Award,
  BookOpen,
  CalendarDays,
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
  Star,
  Trash2,
  Users,
  Wallet,
  ListChecks,
  Route,
  Trophy,
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
type Achievement = { title: string; description: string; icon: string; progress: number; target: number; xp: number };
type JournalStatus = "visited" | "planned" | "dreaming";
type JournalEntry = { id: string; country: string; place: string; date: string; status: JournalStatus; rating: number; note: string; createdAt: number };
type TripDestination = { id: string; country: string; place: string };
type ItineraryItem = { id: string; date: string; time: string; title: string };
type ChecklistItem = { id: string; text: string; done: boolean };
type Trip = { id: string; title: string; startDate: string; endDate: string; budget: string; travellers: number; status: "planning" | "upcoming" | "completed"; destinations: TripDestination[]; itinerary: ItineraryItem[]; checklist: ChecklistItem[]; createdAt: number };

const atlas = feature(
  world as never,
  (world as unknown as { objects: { countries: unknown } }).objects.countries as never,
) as unknown as { features: AtlasFeature[] };

const countries = atlas.features.filter((country) => country.properties.name !== "Antarctica");
const countryNames = countries.map((country) => country.properties.name).sort((a, b) => a.localeCompare(b));
const countryData = countryDataJson as Record<string, CountryInfo>;
const citySearchIndex = Object.entries(countryData).flatMap(([countryName, info]) =>
  info.cities.map((city) => ({ countryName, city })),
);
const regionSearchIndex = Object.entries(countryData).flatMap(([countryName, info]) =>
  info.states.map((region) => ({ countryName, region })),
);
const STORAGE_KEY = "hermes_travel_atlas_v1";
const initialVisited = ["India", "France", "Japan", "United States of America"];
const initialCities: Record<string, string[]> = {
  India: ["Delhi", "Mumbai"],
  France: ["Paris"],
  Japan: ["Tokyo", "Kyoto"],
  "United States of America": ["New York City", "San Francisco"],
};

function joinClass(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function currentTimestamp() { return new Date().getTime(); }
function createLocalId() { return globalThis.crypto?.randomUUID?.() ?? `${new Date().getTime()}-${Math.random()}`; }

function HermesMark() {
  return (
    <span className="hermes-mark" aria-hidden="true">
      <i /><b /><em />
    </span>
  );
}

function AchievementPanel({ achievements, level, rank, xp, xpIntoLevel, onClose }: { achievements: Achievement[]; level: number; rank: string; xp: number; xpIntoLevel: number; onClose: () => void }) {
  const unlocked = achievements.filter((achievement) => achievement.progress >= achievement.target).length;
  return (
    <div className="achievement-backdrop">
      <section className="achievement-panel" role="dialog" aria-modal="true" aria-labelledby="achievement-title">
        <button className="achievement-close" onClick={onClose} aria-label="Close achievements"><X size={18} /></button>
        <div className="achievement-hero">
          <div className="level-medallion"><span>LVL</span><strong>{level}</strong></div>
          <div>
            <p className="micro-label">YOUR EXPLORER PROFILE</p>
            <h2 id="achievement-title">{rank}</h2>
            <p>Every country and place moves your journey forward.</p>
          </div>
          <div className="xp-total"><Sparkles size={16} /><strong>{xp.toLocaleString()}</strong><span>total XP</span></div>
        </div>
        <div className="level-progress-block">
          <div><strong>Level {level}</strong><span>{xpIntoLevel} / 500 XP</span></div>
          <div className="level-progress-track"><i style={{ width: `${(xpIntoLevel / 500) * 100}%` }} /></div>
          <small>{500 - xpIntoLevel} XP until level {level + 1}</small>
        </div>
        <div className="achievement-summary"><span><Trophy size={17} /><strong>{unlocked}</strong> unlocked</span><span><Award size={17} /><strong>{achievements.length - unlocked}</strong> in progress</span></div>
        <div className="achievement-grid">
          {achievements.map((achievement) => {
            const isUnlocked = achievement.progress >= achievement.target;
            const progress = Math.min(100, (achievement.progress / achievement.target) * 100);
            return <article key={achievement.title} className={joinClass("achievement-card", isUnlocked && "unlocked")}>
              <div className="achievement-icon">{achievement.icon}</div>
              <div className="achievement-copy"><small>{isUnlocked ? "UNLOCKED" : `+${achievement.xp} XP`}</small><strong>{achievement.title}</strong><p>{achievement.description}</p></div>
              {isUnlocked ? <span className="achievement-check"><Check size={15} /></span> : <span className="achievement-count">{Math.min(achievement.progress, achievement.target)}/{achievement.target}</span>}
              <div className="achievement-card-track"><i style={{ width: `${progress}%` }} /></div>
            </article>;
          })}
        </div>
      </section>
    </div>
  );
}

function JournalPanel({ entries, defaultCountry, onSave, onDelete, onClose }: { entries: JournalEntry[]; defaultCountry: string; onSave: (entry: Omit<JournalEntry, "id" | "createdAt">) => void; onDelete: (id: string) => void; onClose: () => void }) {
  const [status, setStatus] = useState<JournalStatus>("visited");
  const [country, setCountry] = useState(defaultCountry);
  const [place, setPlace] = useState("");
  const [date, setDate] = useState("");
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState<"all" | JournalStatus>("all");
  const visibleEntries = entries
    .filter((entry) => filter === "all" || entry.status === filter)
    .sort((a, b) => (b.date || "0000").localeCompare(a.date || "0000") || b.createdAt - a.createdAt);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!country || !place.trim()) return;
    onSave({ country, place: place.trim(), date, status, rating, note: note.trim() });
    setPlace(""); setDate(""); setRating(0); setNote("");
  };
  return (
    <div className="journal-backdrop">
      <section className="journal-panel" role="dialog" aria-modal="true" aria-labelledby="journal-title">
        <button className="journal-close" onClick={onClose} aria-label="Close travel journal"><X size={18} /></button>
        <header className="journal-header">
          <span className="journal-mark"><BookOpen size={25} /></span>
          <div><p className="micro-label">YOUR TRAVEL STORY</p><h2 id="journal-title">Travel journal</h2><p>Keep the details that a map alone cannot remember.</p></div>
          <div className="journal-count"><strong>{entries.length}</strong><span>{entries.length === 1 ? "entry" : "entries"}</span></div>
        </header>
        <div className="journal-layout">
          <form className="memory-form" onSubmit={submit}>
            <div className="memory-form-heading"><div><small>NEW ENTRY</small><h3>Add a memory</h3></div><Sparkles size={18} /></div>
            <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as JournalStatus)}><option value="visited">Visited</option><option value="planned">Planned</option><option value="dreaming">Dreaming</option></select></label>
            <label><span>Country</span><select value={country} onChange={(event) => setCountry(event.target.value)}>{countryNames.map((name) => <option key={name}>{name}</option>)}</select></label>
            <label><span>City or place</span><input value={place} onChange={(event) => setPlace(event.target.value)} placeholder="e.g. Ubud, Bali" required /></label>
            <label><span>{status === "visited" ? "Date visited" : "Target date"}</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <fieldset><legend>Rating</legend><div className="rating-picker">{[1,2,3,4,5].map((value) => <button key={value} type="button" className={rating >= value ? "selected" : ""} onClick={() => setRating(rating === value ? 0 : value)} aria-label={`${value} star rating`}><Star size={18} fill={rating >= value ? "currentColor" : "none"} /></button>)}</div></fieldset>
            <label><span>Memory or note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="What made this place memorable?" rows={4} /></label>
            <button className="save-memory" type="submit" disabled={!place.trim()}><BookOpen size={16} /> Save to journal</button>
            <p className="memory-save-note">Saved privately on this device.</p>
          </form>
          <div className="timeline-column">
            <div className="timeline-toolbar"><div><small>JOURNEY TIMELINE</small><h3>Your places, in order</h3></div><div>{(["all","visited","planned","dreaming"] as const).map((value) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value}</button>)}</div></div>
            {visibleEntries.length ? <div className="journal-timeline">{visibleEntries.map((entry) => <article key={entry.id} className={`timeline-entry ${entry.status}`}>
              <span className="timeline-dot"><MapPin size={15} /></span>
              <div className="timeline-card">
                <div className="timeline-meta"><span>{entry.status}</span><time>{entry.date ? new Date(`${entry.date}T00:00:00`).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"}) : "Date open"}</time></div>
                <h4>{entry.place}</h4><p className="timeline-country">{countryData[entry.country]?.flag ?? "🌍"} {entry.country}</p>
                {entry.rating > 0 && <div className="timeline-rating">{Array.from({length:entry.rating},(_,index) => <Star key={index} size={12} fill="currentColor" />)}</div>}
                {entry.note && <p className="timeline-note">“{entry.note}”</p>}
                <button className="delete-memory" onClick={() => onDelete(entry.id)} aria-label={`Delete ${entry.place} journal entry`}><Trash2 size={14} /></button>
              </div>
            </article>)}</div> : <div className="journal-empty"><span>✈️</span><strong>{entries.length ? "No entries in this view" : "Your story starts with one place"}</strong><p>{entries.length ? "Choose another status to see more of your journey." : "Add a memory, a future plan, or somewhere you dream of visiting."}</p></div>}
          </div>
        </div>
      </section>
    </div>
  );
}

function TripPanel({ trips, defaultCountry, onCreate, onUpdate, onDelete, onComplete, onClose }: { trips: Trip[]; defaultCountry: string; onCreate: (trip: Trip) => void; onUpdate: (trip: Trip) => void; onDelete: (id: string) => void; onComplete: (id: string) => void; onClose: () => void }) {
  const [activeId, setActiveId] = useState<string | null>(trips[0]?.id ?? null);
  const [creating, setCreating] = useState(trips.length === 0);
  const [title, setTitle] = useState(""); const [startDate, setStartDate] = useState(""); const [endDate, setEndDate] = useState(""); const [budget, setBudget] = useState(""); const [travellers, setTravellers] = useState(1);
  const [routeCountry, setRouteCountry] = useState(defaultCountry); const [routePlace, setRoutePlace] = useState(""); const [routeDraft, setRouteDraft] = useState<TripDestination[]>([]);
  const [planDate, setPlanDate] = useState(""); const [planTime, setPlanTime] = useState(""); const [planTitle, setPlanTitle] = useState(""); const [checkText, setCheckText] = useState("");
  const selectedTrip = trips.find((trip) => trip.id === activeId) ?? null;
  const activeTrip = selectedTrip ? { ...selectedTrip, itinerary: [...selectedTrip.itinerary] } : null;
  const [openedAt] = useState(currentTimestamp);
  const addRouteStop = () => { if (!routePlace.trim()) return; setRouteDraft((current) => [...current, { id: createLocalId(), country: routeCountry, place: routePlace.trim() }]); setRoutePlace(""); };
  const createTrip = (event: React.FormEvent) => {
    event.preventDefault(); if (!title.trim() || !routeDraft.length) return;
    const id = createLocalId(); onCreate({ id, title: title.trim(), startDate, endDate, budget, travellers, status: startDate ? "upcoming" : "planning", destinations: routeDraft, itinerary: [], checklist: [], createdAt: currentTimestamp() });
    setActiveId(id); setCreating(false); setTitle(""); setStartDate(""); setEndDate(""); setBudget(""); setTravellers(1); setRouteDraft([]);
  };
  const addItinerary = () => { if (!activeTrip || !planTitle.trim()) return; onUpdate({ ...activeTrip, itinerary: [...activeTrip.itinerary, { id: createLocalId(), date: planDate, time: planTime, title: planTitle.trim() }] }); setPlanTitle(""); setPlanTime(""); };
  const addChecklist = () => { if (!activeTrip || !checkText.trim()) return; onUpdate({ ...activeTrip, checklist: [...activeTrip.checklist, { id: createLocalId(), text: checkText.trim(), done: false }] }); setCheckText(""); };
  const countdown = activeTrip?.startDate ? Math.ceil((new Date(`${activeTrip.startDate}T00:00:00`).getTime() - openedAt) / 86400000) : null;
  return <div className="trip-backdrop"><section className="trip-panel" role="dialog" aria-modal="true" aria-labelledby="trip-title">
    <button className="trip-close" onClick={onClose} aria-label="Close trip planner"><X size={18} /></button>
    <header className="trip-header"><span><Plane size={25} /></span><div><p className="micro-label">FROM DREAM TO DEPARTURE</p><h2 id="trip-title">Trip planner</h2><p>Build the route, organize each day, and travel ready.</p></div><button onClick={() => { setCreating(true); setActiveId(null); }}><Plus size={15} /> New trip</button></header>
    <div className="trip-layout"><aside className="trip-list"><div className="trip-list-title"><span>MY TRIPS</span><small>{trips.length}</small></div>{trips.length ? trips.map((trip) => <button key={trip.id} className={activeId === trip.id && !creating ? "active" : ""} onClick={() => { setActiveId(trip.id); setCreating(false); }}><span>{trip.status === "completed" ? "✓" : "✈"}</span><span><strong>{trip.title}</strong><small>{trip.destinations.length} stops · {trip.startDate || "Dates open"}</small></span><ChevronRight size={14} /></button>) : <div className="no-trips"><span>🧳</span><strong>No trips yet</strong><p>Your next adventure starts here.</p></div>}</aside>
      <main className="trip-workspace">{creating ? <form className="create-trip-form" onSubmit={createTrip}><div className="trip-form-intro"><p className="micro-label">NEW ADVENTURE</p><h3>Where are you going?</h3><p>Start with the essentials. You can shape each day afterwards.</p></div><div className="trip-form-grid"><label className="wide"><span>Trip name</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Summer in Japan" required /></label><label><span>Start date</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label><span>End date</span><input type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label><label><span>Budget</span><input value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="e.g. ₹1,50,000" /></label><label><span>Travellers</span><input type="number" min="1" max="50" value={travellers} onChange={(event) => setTravellers(Number(event.target.value))} /></label></div><div className="route-builder"><div><small>ROUTE</small><strong>Add every stop</strong></div><div className="route-fields"><select value={routeCountry} onChange={(event) => setRouteCountry(event.target.value)}>{countryNames.map((name) => <option key={name}>{name}</option>)}</select><input value={routePlace} onChange={(event) => setRoutePlace(event.target.value)} placeholder="City or place" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addRouteStop(); } }} /><button type="button" onClick={addRouteStop}><Plus size={15} /> Add</button></div>{routeDraft.length > 0 && <div className="route-draft">{routeDraft.map((stop,index) => <span key={stop.id}><b>{index + 1}</b>{stop.place}, {stop.country}<button type="button" onClick={() => setRouteDraft((current) => current.filter((item) => item.id !== stop.id))}><X size={12} /></button></span>)}</div>}</div><button className="create-trip-button" type="submit" disabled={!title.trim() || !routeDraft.length}><Plane size={16} /> Create trip</button></form> : activeTrip ? <div className="trip-detail"><div className="trip-detail-hero"><div><span className={`trip-status ${activeTrip.status}`}>{activeTrip.status}</span><h3>{activeTrip.title}</h3><p>{activeTrip.destinations.map((destination) => destination.place).join(" → ")}</p></div><div className="trip-countdown"><strong>{activeTrip.status === "completed" ? "Done" : countdown === null ? "—" : countdown > 0 ? countdown : "Now"}</strong><span>{activeTrip.status === "completed" ? "completed" : countdown && countdown > 0 ? "days to go" : "trip timing"}</span></div></div><div className="trip-facts"><span><CalendarDays size={16} /><b>{activeTrip.startDate || "Open dates"}</b><small>{activeTrip.endDate ? `to ${activeTrip.endDate}` : "Flexible"}</small></span><span><Users size={16} /><b>{activeTrip.travellers}</b><small>travellers</small></span><span><Wallet size={16} /><b>{activeTrip.budget || "Open"}</b><small>budget</small></span><span><Route size={16} /><b>{activeTrip.destinations.length}</b><small>stops</small></span></div><div className="trip-route"><p className="trip-section-label">YOUR ROUTE</p><div>{activeTrip.destinations.map((stop,index) => <span key={stop.id}><i>{index + 1}</i><strong>{stop.place}</strong><small>{countryData[stop.country]?.flag ?? "🌍"} {stop.country}</small></span>)}</div></div><div className="planner-columns"><section><div className="planner-title"><div><ListChecks size={17} /><span><strong>Itinerary</strong><small>{activeTrip.itinerary.length} plans</small></span></div></div><div className="inline-plan-form"><input type="date" value={planDate} onChange={(event) => setPlanDate(event.target.value)} /><input type="time" value={planTime} onChange={(event) => setPlanTime(event.target.value)} /><input value={planTitle} onChange={(event) => setPlanTitle(event.target.value)} placeholder="Activity, stay or transport" onKeyDown={(event) => { if (event.key === "Enter") addItinerary(); }} /><button onClick={addItinerary}><Plus size={15} /></button></div><div className="itinerary-list">{activeTrip.itinerary.length ? activeTrip.itinerary.sort((a,b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).map((item,index) => <article key={item.id}><span>{index + 1}</span><div><strong>{item.title}</strong><small>{item.date || "Any day"} {item.time}</small></div><button onClick={() => onUpdate({ ...activeTrip, itinerary: activeTrip.itinerary.filter((entry) => entry.id !== item.id) })}><Trash2 size={13} /></button></article>) : <p className="planner-empty">Add the first moment to your itinerary.</p>}</div></section><section><div className="planner-title"><div><Check size={17} /><span><strong>Checklist</strong><small>{activeTrip.checklist.filter((item) => item.done).length}/{activeTrip.checklist.length} ready</small></span></div></div><div className="check-add"><input value={checkText} onChange={(event) => setCheckText(event.target.value)} placeholder="Passport, tickets, insurance…" onKeyDown={(event) => { if (event.key === "Enter") addChecklist(); }} /><button onClick={addChecklist}><Plus size={15} /></button></div><div className="check-list">{activeTrip.checklist.length ? activeTrip.checklist.map((item) => <label key={item.id} className={item.done ? "done" : ""}><input type="checkbox" checked={item.done} onChange={() => onUpdate({ ...activeTrip, checklist: activeTrip.checklist.map((entry) => entry.id === item.id ? { ...entry, done: !entry.done } : entry) })} /><span>{item.text}</span><button onClick={() => onUpdate({ ...activeTrip, checklist: activeTrip.checklist.filter((entry) => entry.id !== item.id) })}><X size={12} /></button></label>) : <p className="planner-empty">Add what you need before departure.</p>}</div></section></div><div className="trip-actions">{activeTrip.status !== "completed" && <button className="complete-trip" onClick={() => onComplete(activeTrip.id)}><Check size={15} /> Complete trip & update atlas</button>}<button className="delete-trip" onClick={() => { onDelete(activeTrip.id); setActiveId(null); setCreating(true); }}><Trash2 size={14} /> Delete trip</button></div></div> : null}</main></div>
  </section></div>;
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
      {territoryLayout && regions.length > 0 && <text className="main-map-label" x="42" y="32">{territoryLayout.mainLabel}</text>}
      <g className="country-map-layer" style={{ transform: `translate(${mapTransform.x}px, ${mapTransform.y}px) scale(${mapTransform.k})` }}>
      <path className="country-shape" d={path(mapGeometry as never) ?? ""} />
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
      {selectedRegion && !remoteCodes.has(selectedRegion.properties.code) && <path className="state-selection-outline" d={path(selectedRegion as never) ?? ""} />}
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
            {isSelected && <path className="state-selection-outline inset-selection-outline" d={inset.path(inset.region as never) ?? ""} />}
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
  const [manualCityName, setManualCityName] = useState("");
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [tripsOpen, setTripsOpen] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
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
  const pendingRegionCode = useRef<string | null>(null);
  const dragState = useRef<{ pointerId: number; clientX: number; clientY: number; originX: number; originY: number; moved: boolean } | null>(null);
  const suppressCountryClick = useRef(false);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as { countries?: string[]; cities?: Record<string, string[]>; journal?: JournalEntry[]; trips?: Trip[] };
          if (Array.isArray(parsed.countries)) setVisitedCountries(new Set(parsed.countries));
          if (parsed.cities && typeof parsed.cities === "object") setVisitedCities(parsed.cities);
          if (Array.isArray(parsed.journal)) setJournalEntries(parsed.journal);
          if (Array.isArray(parsed.trips)) setTrips(parsed.trips);
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ countries: [...visitedCountries], cities: visitedCities, journal: journalEntries, trips }));
  }, [hydrated, visitedCountries, visitedCities, journalEntries, trips]);

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
      .then((collection: { features?: AdminRegion[] }) => {
        const nextRegions = collection.features ?? [];
        setRegions(nextRegions);
        if (pendingRegionCode.current) {
          const match = nextRegions.find((region) => region.properties.code === pendingRegionCode.current);
          if (match) setSelectedRegionId(match.properties.id);
          pendingRegionCode.current = null;
        }
      })
      .catch((error: Error) => { if (error.name !== "AbortError") setRegions([]); })
      .finally(() => { if (!controller.signal.aborted) setRegionsLoading(false); });
    return () => { window.clearTimeout(resetTimer); controller.abort(); };
  }, [selectedCountry]);

  useEffect(() => () => {
    if (countryTransitionTimer.current) window.clearTimeout(countryTransitionTimer.current);
  }, []);

  useEffect(() => {
    if (!achievementsOpen && !journalOpen && !tripsOpen) return;
    const closePanels = (event: KeyboardEvent) => { if (event.key === "Escape") { setAchievementsOpen(false); setJournalOpen(false); setTripsOpen(false); } };
    window.addEventListener("keydown", closePanels);
    return () => window.removeEventListener("keydown", closePanels);
  }, [achievementsOpen, journalOpen, tripsOpen]);

  const worldProjection = useMemo(
    () => geoMercator().fitExtent([[-12, 2], [1012, 548]], { type: "FeatureCollection", features: countries } as never),
    [],
  );
  const worldPath = useMemo(() => geoPath(worldProjection), [worldProjection]);
  const graticule = useMemo(() => geoGraticule10(), []);
  const exploredPercent = Math.round((visitedCountries.size / countries.length) * 100);
  const cityTotal = Object.values(visitedCities).reduce((sum, items) => sum + items.length, 0);
  const explorerXp = visitedCountries.size * 100 + cityTotal * 25;
  const explorerLevel = Math.floor(explorerXp / 500) + 1;
  const xpIntoLevel = explorerXp % 500;
  const explorerRank = explorerLevel >= 8 ? "Atlas Legend" : explorerLevel >= 5 ? "Globe Trotter" : explorerLevel >= 3 ? "Trailblazer" : "Curious Wanderer";
  const achievements: Achievement[] = [
    { title: "First Footprint", description: "Mark your first country as visited.", icon: "👣", progress: visitedCountries.size, target: 1, xp: 100 },
    { title: "Border Crosser", description: "Explore five different countries.", icon: "🧭", progress: visitedCountries.size, target: 5, xp: 250 },
    { title: "Globe Trotter", description: "Build a map spanning ten countries.", icon: "🌍", progress: visitedCountries.size, target: 10, xp: 500 },
    { title: "City Collector", description: "Pin ten cities and places to your atlas.", icon: "📍", progress: cityTotal, target: 10, xp: 250 },
    { title: "Urban Nomad", description: "Remember twenty-five cities and places.", icon: "🏙️", progress: cityTotal, target: 25, xp: 500 },
    { title: "Atlas Elite", description: "Reach twenty-five countries explored.", icon: "🏆", progress: visitedCountries.size, target: 25, xp: 1000 },
  ];
  const unlockedAchievementCount = achievements.filter((achievement) => achievement.progress >= achievement.target).length;
  const achievementOverlay = achievementsOpen ? <AchievementPanel achievements={achievements} level={explorerLevel} rank={explorerRank} xp={explorerXp} xpIntoLevel={xpIntoLevel} onClose={() => setAchievementsOpen(false)} /> : null;
  const saveJournalEntry = (entry: Omit<JournalEntry, "id" | "createdAt">) => {
    const nextEntry: JournalEntry = { ...entry, id: createLocalId(), createdAt: currentTimestamp() };
    setJournalEntries((current) => [nextEntry, ...current]);
    if (entry.status === "visited") {
      setVisitedCountries((current) => new Set(current).add(entry.country));
      setVisitedCities((current) => {
        const next = new Set(current[entry.country] ?? []); next.add(entry.place);
        return { ...current, [entry.country]: [...next] };
      });
    }
  };
  const journalOverlay = journalOpen ? <JournalPanel entries={journalEntries} defaultCountry={selectedCountry?.properties.name ?? [...visitedCountries][0] ?? countryNames[0]} onSave={saveJournalEntry} onDelete={(id) => setJournalEntries((current) => current.filter((entry) => entry.id !== id))} onClose={() => setJournalOpen(false)} /> : null;
  const completeTrip = (id: string) => {
    const trip = trips.find((candidate) => candidate.id === id); if (!trip) return;
    setTrips((current) => current.map((candidate) => candidate.id === id ? { ...candidate, status: "completed" } : candidate));
    setVisitedCountries((current) => { const next = new Set(current); trip.destinations.forEach((stop) => next.add(stop.country)); return next; });
    setVisitedCities((current) => { const next = { ...current }; trip.destinations.forEach((stop) => { const places = new Set(next[stop.country] ?? []); places.add(stop.place); next[stop.country] = [...places]; }); return next; });
    setJournalEntries((current) => [...trip.destinations.map((stop, index) => ({ id: createLocalId(), country: stop.country, place: stop.place, date: trip.endDate || trip.startDate, status: "visited" as const, rating: 0, note: `Completed as part of ${trip.title}.`, createdAt: currentTimestamp() + index })), ...current]);
  };
  const tripOverlay = tripsOpen ? <TripPanel trips={trips} defaultCountry={selectedCountry?.properties.name ?? [...visitedCountries][0] ?? countryNames[0]} onCreate={(trip) => setTrips((current) => [trip, ...current])} onUpdate={(trip) => setTrips((current) => current.map((candidate) => candidate.id === trip.id ? trip : candidate))} onDelete={(id) => setTrips((current) => current.filter((trip) => trip.id !== id))} onComplete={completeTrip} onClose={() => setTripsOpen(false)} /> : null;
  const nextTrip = trips.filter((trip) => trip.status !== "completed").sort((a,b) => (a.startDate || "9999").localeCompare(b.startDate || "9999"))[0];
  const normalizedQuery = query.trim().toLowerCase();
  const placeResults = normalizedQuery ? [
    ...countries
      .filter((country) => country.properties.name.toLowerCase().includes(normalizedQuery))
      .map((country) => ({ kind: "country" as const, country })),
    ...citySearchIndex
      .filter(({ city, countryName }) => city.name.toLowerCase().includes(normalizedQuery) || `${city.name} ${countryName}`.toLowerCase().includes(normalizedQuery))
      .map((place) => ({ kind: "city" as const, ...place })),
    ...regionSearchIndex
      .filter(({ region, countryName }) => region.name.toLowerCase().includes(normalizedQuery) || `${region.name} ${countryName}`.toLowerCase().includes(normalizedQuery))
      .map((place) => ({ kind: "region" as const, ...place })),
  ].sort((a, b) => {
    const aName = a.kind === "country" ? a.country.properties.name : a.kind === "city" ? a.city.name : a.region.name;
    const bName = b.kind === "country" ? b.country.properties.name : b.kind === "city" ? b.city.name : b.region.name;
    const aStarts = aName.toLowerCase().startsWith(normalizedQuery) ? 0 : 1;
    const bStarts = bName.toLowerCase().startsWith(normalizedQuery) ? 0 : 1;
    return aStarts - bStarts || aName.localeCompare(bName);
  }).slice(0, 8) : [];
  const hoveredCountry = hovered ? countries.find((country) => country.properties.name === hovered) ?? null : null;
  const transitioningCountryFeature = transitioningCountry
    ? countries.find((country) => country.properties.name === transitioningCountry) ?? null
    : null;
  const emphasizedCountry = transitioningCountryFeature ?? hoveredCountry;

  const toggleCountry = (name: string) => {
    setVisitedCountries((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const toggleCity = (country: string, city: string) => {
    const isAdding = !(visitedCities[country] ?? []).includes(city);
    setVisitedCities((current) => {
      const next = new Set(current[country] ?? []);
      if (next.has(city)) next.delete(city); else next.add(city);
      return { ...current, [country]: [...next] };
    });
    if (isAdding) {
      setVisitedCountries((current) => new Set(current).add(country));
    }
  };

  const openCountry = (country: AtlasFeature) => {
    setSelectedCountry(country);
    setSearchOpen(false);
    setQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const addPlace = (countryName: string, cityName: string) => {
    const country = countries.find((candidate) => candidate.properties.name === countryName);
    if (!country) return;
    setVisitedCountries((current) => new Set(current).add(countryName));
    setVisitedCities((current) => {
      const next = new Set(current[countryName] ?? []);
      next.add(cityName);
      return { ...current, [countryName]: [...next] };
    });
    openCountry(country);
  };

  const openRegion = (countryName: string, regionCode: string) => {
    const country = countries.find((candidate) => candidate.properties.name === countryName);
    if (!country) return;
    setRegions([]);
    pendingRegionCode.current = regionCode;
    openCountry(country);
  };

  const addManualCity = (countryName: string) => {
    const cityName = manualCityName.trim();
    if (!cityName) return;
    setVisitedCountries((current) => new Set(current).add(countryName));
    setVisitedCities((current) => {
      const existing = current[countryName] ?? [];
      if (existing.some((city) => city.toLowerCase() === cityName.toLowerCase())) return current;
      return { ...current, [countryName]: [...existing, cityName] };
    });
    setManualCityName("");
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
    const featuredCityNames = new Set(info.cities.map((city) => city.name));
    const manuallyAddedCities = [...selectedVisitedCities].filter((city) => !featuredCityNames.has(city));
    const countryCityTotal = featuredCityNames.size + manuallyAddedCities.length;
    const selectedTerritoryLayout = territoryLayouts[info.code];
    const selectedRemoteCodes = new Set(selectedTerritoryLayout?.insets.map((inset) => inset.code) ?? []);
    const mainRegions = regions.filter((region) => !selectedRemoteCodes.has(region.properties.code));
    const remoteRegions = regions.filter((region) => selectedRemoteCodes.has(region.properties.code));
    return (
      <div className="hermes-app detail-mode">
        <Header onHome={returnToWorld} onAchievements={() => { setJournalOpen(false); setTripsOpen(false); setAchievementsOpen(true); }} onJournal={() => { setAchievementsOpen(false); setTripsOpen(false); setJournalOpen(true); }} onTrips={() => { setAchievementsOpen(false); setJournalOpen(false); setTripsOpen(true); }} achievementsActive={achievementsOpen} journalActive={journalOpen} tripsActive={tripsOpen} />
        <main className="country-view">
          <aside className="country-rail">
            <button className="back-button" onClick={returnToWorld}><ArrowLeft size={17} /> Back to world</button>
            <div className="country-identity">
              <span className="country-flag">{info.flag}</span>
              <p className="micro-label">COUNTRY ATLAS</p>
              <h1>{name}</h1>
              <p>{info.states.length || "Regional"} states & regions · {countryCityTotal} cities & places</p>
            </div>
            <button className={joinClass("visited-country-button", visitedCountries.has(name) && "is-visited")} onClick={() => toggleCountry(name)}>
              {visitedCountries.has(name) ? <><Check size={18} /> Visited country</> : <><Plus size={18} /> Mark as visited</>}
            </button>
            <div className="country-stats">
              <div><span>City progress</span><strong>{selectedVisitedCities.size}<small> / {countryCityTotal}</small></strong></div>
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
              <div className="country-heading-actions"><button className="add-memory-button" onClick={() => setJournalOpen(true)}><BookOpen size={15} /> Add memory</button><div className="legend"><span><i className="city-legend visited" /> Visited</span><span><i className="city-legend" /> To explore</span></div></div>
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
              <div className="section-heading-row"><div><p className="micro-label">CITY LOG</p><h2>{selectedRegion ? selectedRegion.properties.name : "Cities & places"}</h2></div><span>{selectedRegion ? <button className="clear-region" onClick={() => setSelectedRegionId(null)}>Show all cities</button> : `${selectedVisitedCities.size} of ${countryCityTotal} visited`}</span></div>
              <form className="quick-place-add" onSubmit={(event) => { event.preventDefault(); addManualCity(name); }}>
                <span><MapPin size={18} /></span>
                <input value={manualCityName} onChange={(event) => setManualCityName(event.target.value)} placeholder={`Add any city or place in ${name}`} aria-label={`Add a city or place in ${name}`} />
                <button type="submit" disabled={!manualCityName.trim()}><Plus size={16} /> Add place</button>
              </form>
              {manuallyAddedCities.length > 0 && <div className="manual-place-list">
                <span>Your added places</span>
                <div>{manuallyAddedCities.map((city) => <button key={city} onClick={() => toggleCity(name, city)}><MapPin size={13} /> {city}<X size={13} /></button>)}</div>
              </div>}
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
        {achievementOverlay}
        {journalOverlay}
        {tripOverlay}
      </div>
    );
  }

  return (
    <div className="hermes-app">
      <Header onAchievements={() => { setJournalOpen(false); setTripsOpen(false); setAchievementsOpen(true); }} onJournal={() => { setAchievementsOpen(false); setTripsOpen(false); setJournalOpen(true); }} onTrips={() => { setAchievementsOpen(false); setJournalOpen(false); setTripsOpen(true); }} achievementsActive={achievementsOpen} journalActive={journalOpen} tripsActive={tripsOpen} />
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
          <button className="explorer-level-card" onClick={() => setAchievementsOpen(true)}>
            <span className="explorer-level-number">{explorerLevel}</span>
            <span><small>{explorerRank}</small><strong>{explorerXp.toLocaleString()} XP</strong><i><b style={{ width: `${(xpIntoLevel / 500) * 100}%` }} /></i></span>
            <em>{unlockedAchievementCount}<Trophy size={13} /></em>
          </button>
          <button className="journal-quick-card" onClick={() => setJournalOpen(true)}><span><BookOpen size={18} /></span><span><small>TRAVEL JOURNAL</small><strong>{journalEntries.length ? `${journalEntries.length} memories & plans` : "Start your timeline"}</strong></span><ChevronRight size={16} /></button>
          <button className="trip-quick-card" onClick={() => setTripsOpen(true)}><span><Plane size={18} /></span><span><small>NEXT ADVENTURE</small><strong>{nextTrip ? nextTrip.title : "Plan a new trip"}</strong></span><ChevronRight size={16} /></button>
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
              <input value={query} onFocus={() => setSearchOpen(true)} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} placeholder="Search countries, cities or regions" aria-label="Find a country, city or region" />
              {query && <button aria-label="Clear search" onClick={() => setQuery("")}><X size={16} /></button>}
              {searchOpen && query && <div className="search-results">
                {placeResults.map((result) => result.kind === "country" ? (
                  <button key={`country-${result.country.id}`} onClick={() => openCountry(result.country)}>
                    <span>{countryData[result.country.properties.name]?.flag ?? "🌍"}</span>
                    <span><strong>{result.country.properties.name}</strong><small>Open country atlas</small></span>
                    {visitedCountries.has(result.country.properties.name) && <Check size={15} />}
                  </button>
                ) : result.kind === "city" ? (
                  <button key={`city-${result.countryName}-${result.city.stateCode}-${result.city.name}`} onClick={() => addPlace(result.countryName, result.city.name)}>
                    <span className="place-result-pin"><MapPin size={15} /></span>
                    <span><strong>{result.city.name}</strong><small>{countryData[result.countryName]?.flag ?? "🌍"} {result.countryName} · Add place</small></span>
                    {(visitedCities[result.countryName] ?? []).includes(result.city.name) && <Check size={15} />}
                  </button>
                ) : (
                  <button key={`region-${result.countryName}-${result.region.code}-${result.region.name}`} onClick={() => openRegion(result.countryName, result.region.code)}>
                    <span className="place-result-pin"><Compass size={15} /></span>
                    <span><strong>{result.region.name}</strong><small>{countryData[result.countryName]?.flag ?? "🌍"} {result.countryName} · Open region</small></span>
                    <ChevronRight size={15} />
                  </button>
                ))}
                {!placeResults.length && <p>No matching country, city or region found.</p>}
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
              <g className={joinClass("world-map-layer", hovered && "has-hover")} style={{ transform: `translate(${worldTransform.x}px, ${worldTransform.y}px) scale(${worldTransform.k})` }}>
              <path className="graticule" d={worldPath(graticule as never) ?? ""} />
              {countries.map((country) => {
                const name = country.properties.name;
                const isVisited = visitedCountries.has(name);
                return <path key={name} tabIndex={0} aria-label={`${name}${isVisited ? ", visited" : ""}`} className={joinClass("map-country", isVisited && "visited", hovered === name && "hovered", transitioningCountry === name && "entering")} d={worldPath(country as never) ?? ""} onMouseEnter={() => setHovered(name)} onMouseMove={updateTooltipPoint} onMouseLeave={() => setHovered(null)} onFocus={() => { setHovered(name); const [x, y] = worldPath.centroid(country as never); setTooltipPoint({ x: x / 10, y: y / 5.5 }); }} onBlur={() => setHovered(null)} onClick={() => animateIntoCountry(country)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") animateIntoCountry(country); }} />;
              })}
              {emphasizedCountry && <>
                <path className={joinClass("active-country-halo", transitioningCountry && "entering")} d={worldPath(emphasizedCountry as never) ?? ""} />
                <path className="active-country-edge" d={worldPath(emphasizedCountry as never) ?? ""} />
              </>}
              </g>
            </svg>
            {hovered && !isPanning && <div className="country-tooltip" style={{ "--tooltip-x": `${tooltipPoint.x}%`, "--tooltip-y": `${tooltipPoint.y}%` } as React.CSSProperties}><span>{countryData[hovered]?.flag ?? "🌍"}</span><div><strong>{hovered}</strong><small>{visitedCountries.has(hovered) ? "Visited · Open atlas" : "Open country atlas"}</small></div><ChevronRight size={16} /></div>}
            <div className="map-instruction"><Compass size={16} /><span>{worldTransform.k > 1 ? "Drag to explore · scroll to zoom" : "Click a country · scroll to zoom"}</span></div>
            <div className="map-scale"><span /><span /><span /><small>EXPLORE</small></div>
          </div>
        </section>
      </main>
      {achievementOverlay}
      {journalOverlay}
      {tripOverlay}
    </div>
  );
}

function Header({ onHome, onAchievements, onJournal, onTrips, achievementsActive = false, journalActive = false, tripsActive = false }: { onHome?: () => void; onAchievements?: () => void; onJournal?: () => void; onTrips?: () => void; achievementsActive?: boolean; journalActive?: boolean; tripsActive?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = (handler?: () => void) => {
    handler?.();
    setMenuOpen(false);
  };
  return (
    <header className="hermes-header">
      <button className="brand-button" onClick={onHome} aria-label="Hermes home"><HermesMark /><span><strong>Hermes</strong><small>by BuildQuick</small></span></button>
      <nav aria-label="Primary navigation"><button className={!achievementsActive && !journalActive && !tripsActive ? "active" : ""} onClick={onHome}><Earth size={17} /> World map</button><button className={journalActive ? "active" : ""} onClick={onJournal}><BookOpen size={17} /> Journal</button><button className={achievementsActive ? "active" : ""} onClick={onAchievements}><Trophy size={17} /> Achievements</button><button className={tripsActive ? "active" : ""} onClick={onTrips}><Plane size={17} /> Trips</button></nav>
      <div className="header-actions"><button className="menu-button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="hermes-menu" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={19} /> : <Menu size={19} />}</button><span className="profile-avatar">SK</span></div>
      {menuOpen && <nav className="mobile-menu" id="hermes-menu" aria-label="Hermes menu"><button className={!achievementsActive && !journalActive && !tripsActive ? "active" : ""} onClick={() => navigate(onHome)}><Earth size={17} /> World map</button><button className={journalActive ? "active" : ""} onClick={() => navigate(onJournal)}><BookOpen size={17} /> Journal</button><button className={achievementsActive ? "active" : ""} onClick={() => navigate(onAchievements)}><Trophy size={17} /> Achievements</button><button className={tripsActive ? "active" : ""} onClick={() => navigate(onTrips)}><Plane size={17} /> Trips</button></nav>}
    </header>
  );
}
