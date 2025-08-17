// app/fiddles-directions/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl, { Map, LngLatLike } from 'mapbox-gl';
import * as turf from '@turf/turf';
import 'mapbox-gl/dist/mapbox-gl.css';
import PlaylistGrid from "@/components/PlaylistGrid";
import { EventsFloatingButton } from "@/components/UpcomingEvents";
import BrowserDebugInfo from "@/components/BrowserDebugInfo";
import { createPortal } from "react-dom";

mapboxgl.accessToken =
  import.meta.env.VITE_MAPBOX_TOKEN ||
  'pk.eyJ1Ijoicm1vdWhhd2VqZ3JlbWVhIiwiYSI6ImNtZTM2MW80bTAyNGUyanB6NXdkeXg2MW0ifQ.lprSRRWEUAmh3uiKRjp2PA';

const DAY_LABELS_FR = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
// mini composant réutilisable
function RowPills({ items, icon }: { items: string[]; icon: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => { if (ref.current) setOverflow(ref.current.scrollWidth > ref.current.clientWidth); };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [items, expanded]);

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={ref}
        style={{
          whiteSpace: expanded ? 'normal' : 'nowrap',
          overflow: 'hidden',
          paddingRight: 28
        }}
      >
        {items.map((x, i) => (
          <span key={i} className="kpsule-pill">{icon} {x}</span>
        ))}
      </div>

      {!expanded && overflow && (
        <button
          onClick={() => setExpanded(true)}
          className="kpsule-pill"
          style={{
            position: 'absolute', right: 0, top: 0, height: 24, lineHeight: '24px',
            padding: '0 8px'
          }}
          aria-label="Afficher tout"
          title="Afficher tout"
        >
          +
        </button>
      )}
    </div>
  );
}
function normalizeWeek(week: string[] = []) {
  if (!Array.isArray(week) || week.length !== 7) return week || [];
  // Si le 1er élément commence par Mon/Lun → tableau Monday-first → on met Sunday en tête
  const first = (week[0] || '').toLowerCase();
  const mondayFirst = /^mon|^lun/.test(first);
  return mondayFirst ? [week[6], ...week.slice(0, 6)] : week;
}

function stripDayPrefix(line = '') {
  return line.replace(
    /^\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat|dimanche|lundi|mardi|mercredi|jeudi|vendredi|samedi|dim|lun|mar|mer|jeu|ven|sam)\s*:?\s*/i,
    ''
  );
}

type Bar = {
  bar_id: string;
  id?: string;
  name?: string;
  description?: string;
  description_fr?: string;
  music?: string[];        // normalisé
  music_fr?: string[];     // normalisé
  tags?: string[];         // normalisé
  tags_fr?: string[];      // normalisé
  price?: string | number;
  url?: string;
  phone?: string;
  rating?: number;
  rating_count?: number;
  weekday_text?: string[]; // normalisé
  lat: number;
  lng: number;
};


type SearchResult = {
  bar_id: string;
  match_term: string;
};

const API = 'https://kpsule.app/api';
const log = (...a:any[]) => console.log("[Directions]", ...a);
const warn = (...a:any[]) => console.warn("[Directions][WARN]", ...a);
const err = (...a:any[]) => console.error("[Directions][ERROR]", ...a);
log("Boot, VITE_MAPBOX_TOKEN present?", !!import.meta.env.VITE_MAPBOX_TOKEN);

window.addEventListener("error", (e) => err("window.onerror:", e.error || e.message));
window.addEventListener("unhandledrejection", (e:any) => err("unhandledrejection:", e.reason));




function parseList(v?: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string') as string[];
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === 'string');
    } catch {
      return v.split(',').map((s) => s.trim());
    }
  }
  return [];
}


function getTodayIdxFor(week: string[] | undefined) {
  const js = new Date().getDay(); // 0=Sun..6=Sat
  if (!Array.isArray(week) || week.length === 0) return js;
  const first = (week[0] || '').toLowerCase();
  const mondayFirst = first.startsWith('mon') || first.startsWith('lun'); // en/fr
  return mondayFirst ? (js + 6) % 7 : js; // passe en 0=lun..6=dim si besoin
}



function iconColorFor(bar: Bar): string {
  const tags = (parseList(bar.tags_fr).length ? parseList(bar.tags_fr) : parseList(bar.tags)).map((t) => t.toLowerCase());
  const music = (parseList(bar.music_fr).length ? parseList(bar.music_fr) : parseList(bar.music))
    .join(' ')
    .toLowerCase();
  if (tags.some((t) => ['karaoke', 'lounge'].includes(t))) return '#EF4444'; // rouge
  if (music.includes('jazz')) return '#3B82F6'; // bleu
  if (music.includes('rock')) return '#EF4444'; // rouge
  return '#22C55E'; // vert
}

export default function FiddlesDirections() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const meMarkerRef = useRef<mapboxgl.Marker | null>(null); // ⬅️ tout en haut du composant

  const [start, setStart] = useState<[number, number]>([-73.5673, 45.5017]); // centre MTL (fallback)
  const [durationText, setDurationText] = useState('—');
  const [distanceText, setDistanceText] = useState('—');
  const [etaText, setEtaText] = useState('—');

  const [bars, setBars] = useState<Bar[]>([]);
  const [selected, setSelected] = useState<Bar | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [searchType, setSearchType] = useState<'item' | 'music' | 'ambiance'>('ambiance');
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedBar, setSelectedBar] = useState<Bar | null>(null);
  const [nowText, setNowText] = useState(
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
  useEffect(() => {
    const iv = setInterval(() => {
      setNowText(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 30000);
    return () => clearInterval(iv);
  }, []);
  function toggleFullscreen() {
    setIsFullscreen((v) => {
      const next = !v;
      // Redimensionner la carte après le reflow
      requestAnimationFrame(() => setTimeout(() => mapRef.current?.resize(), 0));
      return next;
    });
  }

  type WeatherNow = {
    temp: number;              // °C
    wind: number;              // km/h
    code: number;              // weathercode
    isDay?: boolean;
    rh?: number;               // % (optionnel via hourly)
    appTemp?: number;          // °C ressentie
    uv?: number;               // indice UV
    ppop?: number;             // % prob. précip.
  };
  const [weather, setWeather] = useState<WeatherNow | null>(null);

  function weatherIcon(code: number, isNight = false) {
    const n = isNight;
    if ([0].includes(code)) return n ? "🌙" : "☀️";                           
    if ([1,2].includes(code)) return n ? "🌤️" : "⛅";                         
    if ([3].includes(code)) return "☁️";                                      
    if ([45,48].includes(code)) return "🌫️";                                  
    if ([51,53,55].includes(code)) return "🌦️";                               
    if ([61,63,65].includes(code)) return "🌧️";                               
    if ([66,67].includes(code)) return "🌧️❄️";                                
    if ([71,73,75,77].includes(code)) return "❄️";                            
    if ([80,81,82].includes(code)) return "🌧️🌧️";                             
    if ([95].includes(code)) return "⛈️";                                     
    if ([96,99].includes(code)) return "⛈️✨";                                
    return "🌡️";
  }

  function setMarkerOutline(marker: mapboxgl.Marker, color?: string) {
    const el = marker.getElement() as HTMLElement;
    if (color) {
      el.style.filter = `drop-shadow(0 0 0 2px ${color}) drop-shadow(0 0 8px ${color})`;
    } else {
      el.style.filter = '';
    }
  }



  // Modals
  const [modalItems, setModalItems] = useState<any[]>([]);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [playlistModal, setPlaylistModal] = useState<any[]>([]);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

  /* ⬇️ Nouveau : modal pleine page + onglets */
  const [showBarModalFS, setShowBarModalFS] = useState(false);
  const [activeTab, setActiveTab] = useState<'infos'|'musique'|'menu'|'events'>('infos');
  const [eventsModal, setEventsModal] = useState<any[]>([]);
  const [fsMenuItems, setFsMenuItems] = useState<any[]>([]);

  const [showAllMusic, setShowAllMusic] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);

// APRÈS
async function openBarFullModal(bar: Bar){
  setSelectedBar(bar);
  setActiveTab('infos');
  setShowBarModalFS(true);

  /* Musique */
  try {
    const r = await fetch(`${API}/public/bars/${bar.bar_id}/playlist`);
    setPlaylistModal(r.ok ? await r.json() : []);
  } catch { setPlaylistModal([]); }

  /* Événements */
  try {
    const r2 = await fetch(`${API}/events?bar_id=${encodeURIComponent(bar.bar_id)}&limit=10`);
    const j2 = await r2.json();
    setEventsModal(j2?.events ?? []);
  } catch { setEventsModal([]); }

  /* Menu (items) pour l’onglet "Menu" */
  try {
    const r3 = await fetch(`${API}/bars/${bar.bar_id}/items`);
    const j3 = await r3.json();
    setFsMenuItems(j3?.items ?? []);
  } catch { setFsMenuItems([]); }
}

  // Références markers & popups
  const markerMap = useRef<Record<string, mapboxgl.Marker>>({});
  const popupMap = useRef<Record<string, mapboxgl.Popup>>({});
  const sortedSuggestions = useMemo(() => {
    const rank = (bar?: Bar) => {
      if (!bar) return 3;
      const c = statusColorFor(bar);
      if (c === '#22C55E') return 0; // vert = ouvert
      if (c === '#F97316') return 1; // orange = ouvre plus tard
      if (c === '#EF4444') return 2; // rouge = fermé
      return 3;
    };

    const getOpenMinutes = (bar?: Bar) => {
      if (!bar) return Number.POSITIVE_INFINITY;
      const today = getTodayIdxFor(bar.weekday_text);
      const line = bar.weekday_text?.[today] || '';
      // prend la première heure trouvée (format 24h ou am/pm)
      const m = line.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (!m) return Number.POSITIVE_INFINITY;
      let h = parseInt(m[1], 10);
      const min = m[2] ? parseInt(m[2], 10) : 0;
      if (m[3]) {
        const ap = m[3].toLowerCase();
        if (ap === 'pm' && h < 12) h += 12;
        if (ap === 'am' && h === 12) h = 0;
      }
      return h * 60 + min;
    };

    return suggestions.slice().sort((a, b) => {
      const ba = bars.find(x => x.bar_id === a.bar_id);
      const bb = bars.find(x => x.bar_id === b.bar_id);
      const ra = rank(ba), rb = rank(bb);
      if (ra !== rb) return ra - rb;                 // vert < orange < rouge
      if (ra === 1) {                                // si orange: trier par heure d'ouverture
        return getOpenMinutes(ba) - getOpenMinutes(bb);
      }
      return 0;                                      // sinon garder l'ordre actuel
    });
  }, [suggestions, bars]);

  const geolocGrantedRef = useRef(false);



  const watchIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!navigator.geolocation) return;

    // 1) premier fix → déclenchera l'unique fly via l'effet de recentrage
    navigator.geolocation.getCurrentPosition(
      (p) => {
        geolocGrantedRef.current = true;
        setStart([p.coords.longitude, p.coords.latitude]);
        // 2) ensuite on démarre le suivi continu
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pp) => {
            // on MAJ juste le marker pour éviter un nouveau fly
            meMarkerRef.current?.setLngLat([pp.coords.longitude, pp.coords.latitude]);
          },
          (e) => warn("Geolocation watch fail", e?.code, e?.message),
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
        );
      },
      (e) => warn("Geolocation first fix fail", e?.code, e?.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );

    return () => { if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, []);


  // 🔄 Récupération météo Open-Meteo
  useEffect(() => {
    const target = selectedBar ? { lat: selectedBar.lat, lng: selectedBar.lng }
                              : { lat: start[1],        lng: start[0] };
    if (!Number.isFinite(target.lat) || !Number.isFinite(target.lng)) return;

    const url = `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${target.lat}&longitude=${target.lng}` +
      `&current_weather=true` +
      `&hourly=relative_humidity_2m,apparent_temperature,uv_index,precipitation_probability` +
      `&timezone=auto`;

    (async () => {
      try {
        const r = await fetch(url);
        const j = await r.json();

        const cw = j?.current_weather || {};
        // heures alignées sur j.hourly.time[0..]
        const idxNow = 0; // suffisant pour un affichage « maintenant »
        const h = j?.hourly || {};
        const w: WeatherNow = {
          temp: cw.temperature,
          wind: cw.windspeed,
          code: cw.weathercode,
          isDay: cw.is_day === 1,
          rh: Array.isArray(h.relative_humidity_2m) ? h.relative_humidity_2m[idxNow] : undefined,
          appTemp: Array.isArray(h.apparent_temperature) ? h.apparent_temperature[idxNow] : undefined,
          uv: Array.isArray(h.uv_index) ? h.uv_index[idxNow] : undefined,
          ppop: Array.isArray(h.precipitation_probability) ? h.precipitation_probability[idxNow] : undefined,
        };
        setWeather(w);
      } catch (e) {
        console.warn("Weather fetch failed", e);
        setWeather(null);
      }
    })();
  }, [start, selectedBar]);


  // 2) Fetch bars (avec logs + limiter à 5 + normaliser coords)
  useEffect(() => {
    (async () => {
      try {
        log("Fetching bars…");
        const res = await fetch(`${API}/public/bars/locations`);
        log("Bars status:", res.status);
        const data = await res.json();

        const raw = data?.locations ?? [];
        const cleaned: Bar[] = raw
          .filter((b: any) => Number.isFinite(Number(b?.lng)) && Number.isFinite(Number(b?.lat)))
          .map((b: any) => {
            const parseMaybeArray = (v: any) => {
              if (Array.isArray(v)) return v.filter((x) => typeof x === 'string');
              if (typeof v === 'string') {
                if (v.trim().toLowerCase() === 'null' || v.trim() === '') return [];
                try { const p = JSON.parse(v); return Array.isArray(p) ? p.filter((x)=>typeof x==='string') : []; } catch { return []; }
              }
              return [];
            };
            const parseWeek = (v: any) => {
              if (Array.isArray(v)) return v.map(String);
              if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p.map(String) : []; } catch { return []; } }
              return [];
            };

            return {
              bar_id: String(b.bar_id),
              id: b.id,
              name: b.name ?? undefined,
              description: b.description ?? undefined,
              description_fr: b.description_fr ?? undefined,
              music: parseMaybeArray(b.music),
              music_fr: parseMaybeArray(b.music_fr),
              tags: parseMaybeArray(b.tags),
              tags_fr: parseMaybeArray(b.tags_fr),
              price: b.price ?? undefined,
              url: b.url ?? undefined,
              phone: b.phone ?? undefined,
              rating: b.rating != null ? Number(b.rating) : undefined,
              rating_count: b.rating_count != null ? Number(b.rating_count) : undefined,
              weekday_text: parseWeek(b.weekday_text),
              lng: Number(b.lng),
              lat: Number(b.lat),
            };
          });
        setBars(cleaned);


        log("Bars total:", raw.length, " → kept all valid:", cleaned.length);
        console.log(cleaned);

        setBars(cleaned);
      } catch (e) {
        err("Failed to load bars", e);
      }
    })();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const ids = new Set(suggestions.map(s => s.bar_id));
    const feats = bars
      .filter(b => ids.has(b.bar_id))
      .map(b => ({
        type: 'Feature',
        properties: { name: b.name || b.bar_id },
        geometry: { type: 'Point', coordinates: [b.lng, b.lat] }
      }));

    const fc = { type:'FeatureCollection', features: feats };
    const src = map.getSource('suggest-src') as any;
    if (src) src.setData(fc);
  }, [suggestions, bars, mapReady]);

  // 3) Init Mapbox (mapReady + logs)
  useEffect(() => {
    if (mapRef.current) { warn("Map already exists, skip init"); return; }
    if (!containerRef.current) { err("No containerRef, abort"); return; }

    log("Init map… start:", { start });
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: start as LngLatLike,
      zoom: 14.6, pitch: 60, bearing: -18, antialias: true,
    });
    mapRef.current = map;
    // @ts-ignore
    window.__MAP__ = mapRef.current;
    log("Map instance created");

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right');

    map.on('style.load', () => {
      log("style.load fired");
      const labelLayerId = map.getStyle().layers?.find(
        (l) => l.type === 'symbol' && (l.layout as any)?.['text-field']
      )?.id;

      map.addLayer(
        {
          id: '3d',
          source: 'composite',
          'source-layer': 'building',
          filter: ['==', 'extrude', 'true'],
          type: 'fill-extrusion',
          minzoom: 14,
          paint: {
            'fill-extrusion-color': ['interpolate', ['linear'], ['zoom'], 14, '#1f2433', 17, '#2a3147'],
            'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 16, ['get', 'height']],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.95,
          },
        },
        labelLayerId
      );

      const me = document.createElement('div');
      me.style.cssText = 'width:18px;height:18px;border-radius:50%;background:#3B82F6;box-shadow:0 0 0 6px rgba(59,130,246,.25), 0 0 18px rgba(59,130,246,.6)';
      meMarkerRef.current = new mapboxgl.Marker({ element: me }).setLngLat(start).addTo(map);
      log("Added 'me' marker at:", start);
    });

    map.once('load', () => {
      map.addSource('bars-src', { type: 'geojson', data: { type:'FeatureCollection', features: [] }});
      map.addLayer({
        id: 'bars-layer',
        type: 'symbol',
        source: 'bars-src',
        layout: {
          'icon-image': 'marker-15',
          'icon-size': 1.2,
          'icon-allow-overlap': true,
          'text-field': ['get', 'name'],
          'text-size': 12,
          'text-offset': [0, -1.6],
          'text-anchor': 'bottom',
          'icon-pitch-alignment': 'viewport',   // reste rond
          'icon-rotation-alignment': 'viewport'
        },
        paint: { 'text-color': '#ffffff' }
      });
      map.on('click', (e) => {
        setShowSuggestions(false); // 👈 cache la liste
        const feats = map.queryRenderedFeatures(e.point, { layers: ['bars-layer'] });
        console.log('[DEBUG] qrf bars-layer =', feats.length, feats[0]?.properties);
      });

      const hideSuggests = () => setShowSuggestions(false);
      map.on('dragstart', hideSuggests);   // 👈 dès que l'utilisateur déplace la carte

      map.addSource('suggest-src', { type:'geojson', data:{ type:'FeatureCollection', features:[] } });

      map.addLayer({
        id: 'suggest-labels',
        type: 'symbol',
        source: 'suggest-src',
        layout: {
          'text-field': ['get','name'],
          'text-size': 14,               // plus gros
          'text-font': ['Open Sans Bold'], // police bold de Mapbox
          'text-anchor': 'top',
          'text-offset': [0, 1.4],
          'text-allow-overlap': true,
          'text-ignore-placement': true
        },
        paint: {
          'text-color': '#FFD700',       // doré
          'text-halo-color': '#000000',
          'text-halo-width': 2
        }
      });


      console.log('has layer?', !!map.getLayer('bars-layer'));
      console.log('has source?', !!map.getSource('bars-src'));


      // click sur un bar
      map.on('click', 'bars-layer', (e: any) => {
        const f = e.features?.[0];
        console.log('[MAP CLICK] Feature =', f); // 👈 debug complet
        const id = f?.properties?.bar_id;
        console.log('[MAP CLICK] bar_id =', id); // 👈 debug valeur bar_id
        const bar = bars.find(b => b.bar_id === id);
        if (bar) {
          console.log('[MAP CLICK] Bar trouvé →', bar.name || bar.bar_id);
          openBarPopup(bar);
        } else {
          console.warn('[MAP CLICK] Aucun bar trouvé pour id', id);
        }
      });
      setMapReady(true);
    });



    return () => {
      log("map.remove()");
      setMapReady(false);
      map.remove();
    };
  }, []);

  // 4) Recenter après géoloc (seulement une fois)
  const recenterDone = useRef(false);

  // 4) Recenter après géoloc — une seule fois
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !start) {
      if (!mapReady) warn("Recenter skipped: map not ready");
      return;
    }
    // Unique flyTo seulement si l'utilisateur a accordé la géoloc
    if (geolocGrantedRef.current && !recenterDone.current) {
      log("Recenter (unique) + move me-marker to", start);
      meMarkerRef.current?.setLngLat(start);
      map.flyTo({ center: start as LngLatLike, zoom: 15.2, pitch: 60, bearing: -18, duration: 600 });
      recenterDone.current = true;
    } else {
      // Si pas de permission, on met juste à jour le marqueur sans fly
      meMarkerRef.current?.setLngLat(start);
    }
  }, [start, mapReady]);


  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
    .mapboxgl-popup.kpsule-popup{ max-width:300px; margin-right:50px;}
    .mapboxgl-popup.kpsule-popup .mapboxgl-popup-content{
      background: linear-gradient(180deg,#0b0f1d,#0a0e1c);
      color:#fff;
      border:1px solid #22304a;
      border-radius:14px;
      box-shadow:0 14px 40px rgba(0,0,0,.55), inset 0 0 0 1px rgba(34,48,74,.35);
      padding:12px 14px;
      box-sizing:border-box;        /* ✅ empêche le dépassement par le padding */
      max-width:300px;              /* ✅ largeur dure du contenu */
      overflow:hidden;
      margin-right:-50px;              /* ✅ coupe tout débordement horizontal résiduel */
    }
    .kpsule-pop-title{font-weight:900;font-size:16px;margin-bottom:6px;letter-spacing:.2px}
    /* CTA cliquable pour le nom du bar */
    .kpsule-pop-title{display:flex;align-items:center;gap:8px}
    .kpsule-pop-cta{
      all:unset; cursor:pointer; color:#fff; font-weight:900;
      padding:6px 10px; border-radius:10px;
      background:rgba(255,255,255,.06); border:1px solid #22304a;
      transition:transform .12s ease, box-shadow .12s ease, background .12s ease;
      position:relative; display:inline-flex; align-items:center; gap:6px;
    }
    .kpsule-pop-cta::after{
      content:""; position:absolute; left:8px; right:8px; bottom:4px; height:2px;
      background:linear-gradient(90deg,#60A5FA,#22D3EE);
      transform:scaleX(0); transform-origin:left; transition:transform .22s ease;
      opacity:.9; border-radius:2px;
    }
    .kpsule-pop-cta:hover::after, .kpsule-pop-cta:focus-visible::after{ transform:scaleX(1); }
    .kpsule-pop-cta:hover{ background:rgba(255,255,255,.09); box-shadow:0 6px 20px rgba(0,0,0,.25); }
    .kpsule-pop-cta:active{ transform:translateY(1px); }
    .kpsule-pop-cta:focus-visible{ outline:none; box-shadow:0 0 0 2px #60A5FA55, 0 0 0 4px #22304a; }

    /* petite flèche animée */
    .kpsule-cta-icon{opacity:.7; transition:transform .18s ease, opacity .18s ease}
    .kpsule-pop-cta:hover .kpsule-cta-icon{ transform:translate(2px,-2px) rotate(10deg); opacity:1; }

    .kpsule-pop-desc{
      opacity:.9;font-style:italic;margin-bottom:8px;line-height:1.35;
      overflow-wrap:anywhere;word-break:break-word;hyphens:auto;
      scrollbar-width:none;
    }
    .kpsule-pop-desc::-webkit-scrollbar{display:none}
    .kpsule-pop-row{display:flex;align-items:flex-start;gap:6px;margin-top:6px;overflow:hidden}
    .kpsule-hours-wheel{
      max-height:126px; overflow:hidden;
      border:1px solid #22304a; border-radius:8px;
      background:rgba(255,255,255,.06); position:relative;
      user-select:none; touch-action:none;           /* ✅ empêche le scroll natif qui “vole” le geste */
      overscroll-behavior: contain;                  /* ✅ évite de faire scroller la page parente */
      -webkit-mask-image: linear-gradient(to bottom, transparent 0, black 10px, black calc(100% - 10px), transparent 100%);
              mask-image: linear-gradient(to bottom, transparent 0, black 10px, black calc(100% - 10px), transparent 100%);
    }

    .kpsule-hours-list{ display:flex; flex-direction:column; will-change:transform; }
    .kpsule-hours-row{
      padding:8px 10px; border-bottom:1px solid rgba(255,255,255,.06);
      display:flex; align-items:center; gap:10px;
    }
    .kpsule-day-bullet{ width:8px; height:8px; border-radius:50%; flex:0 0 8px; }
    .kpsule-day-name{ opacity:.85; min-width:46px; font-weight:700; }
    .kpsule-hours-list.grabbing{ cursor:grabbing; }

    .kpsule-hours-today{display:flex;align-items:center;gap:8px;margin:6px 0 8px 0;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,.06)}
    .kpsule-hours-dot{width:10px;height:10px;border-radius:50%}

    .kpsule-pop-row .scroll-chips{
      display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;
      flex:1 1 auto;min-width:0;      /* ✅ autorise la contraction dans la row */
    }
    .kpsule-pop-row .scroll-chips::-webkit-scrollbar{display:none}
    .kpsule-chip{
      flex:0 0 auto;white-space:nowrap;display:inline-block;
      background:#11182b;border:1px solid #22304a;border-radius:8px;
      padding:2px 8px;margin-right:6px;margin-bottom:6px;font-size:12px;
    }
    .kpsule-link{display:block;margin-top:6px;text-decoration:none}
    .kpsule-link.site{color:#60A5FA}
    .kpsule-link.items{color:#22C55E}
    .kpsule-link.playlist{color:#A855F7}
    /* Modal FS + onglets */
    .kpsule-fs-wrap{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.55);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center}
    .kpsule-fs{position:relative;width:min(100%,100vw);height:min(100%,100vh);border-radius:0;background:
      radial-gradient(1400px 800px at 70% -10%, rgba(59,130,246,.20), transparent 60%),
      radial-gradient(1200px 900px at 30% 110%, rgba(34,197,94,.18), transparent 60%),
      linear-gradient(180deg,#0b0f1d,#0a0e1c);
    border:1px solid #1e2a44; box-shadow:0 30px 120px rgba(0,0,0,.6); color:#fff; overflow:hidden}
    .kpsule-fs-head{display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid #182137}
    .kpsule-fs-title{font-size:20px;font-weight:900;letter-spacing:.2px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .kpsule-fs-tabs{display:flex;gap:8px}
    .kpsule-tab{padding:8px 12px;border-radius:999px;border:1px solid #22304a;background:rgba(13,18,36,.7);cursor:pointer;opacity:.9}
    .kpsule-tab[aria-selected="true"]{background:linear-gradient(90deg,#60A5FA,#22D3EE);color:#0b0f1d;border-color:transparent;opacity:1}
    .kpsule-fs-body{position:absolute;inset:64px 16px 16px 16px;border-radius:16px;background:rgba(255,255,255,.03);border:1px solid #1e2a44;overflow:auto;padding:5px}
    .kpsule-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
    .kpsule-pill{display:inline-block;background:#11182b;border:1px solid #22304a;border-radius:999px;padding:4px 10px;margin:4px 6px 0 0;font-size:12px}
    .kpsule-kv{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #22304a;border-radius:12px;background:rgba(255,255,255,.04)}
    .kpsule-close{position:absolute;top:10px;right:12px;font-size:20px;cursor:pointer;border:1px solid #22304a;border-radius:10px;background:rgba(13,18,36,.7);padding:6px 10px}
    .kpsule-card{border:1px solid #22304a;border-radius:12px;padding:12px;background:rgba(13,18,36,.6)}
    .kpsule-img{width:100%;height:220px;object-fit:cover;border-radius:12px;border:1px solid #22304a}
    `;

    document.head.appendChild(style);
    return () => style.remove();
  }, []);
  // useEffect(() => {
  //   const highlighted = new Set(suggestions.map(s => s.bar_id));
  //   const hasSuggests = highlighted.size > 0;

  //   Object.values(markerMap.current).forEach(({ marker, bar }: any) => {
  //     const isSel = selected?.bar_id === bar.bar_id;
  //     const isHi  = highlighted.has(bar.bar_id);
  //     const { color } = computeMarkerStyle(bar, isSel, isHi);

  //     // 50% de transparence pour les autres quand il y a des suggestions
  //     const opacity = hasSuggests ? (isSel || isHi ? 1 : 0.5) : 1;

  //     applyMarkerStyle(marker, color, opacity);
  //   });
  // }, [suggestions, selected]);

  // ⬇️ remplace ENTIEREMENT l’effet "mise en forme des marqueurs"
  useEffect(() => {
    const highlighted = new Set(suggestions.map(s => s.bar_id));
    const hasSuggests = highlighted.size > 0;

    Object.values(markerMap.current).forEach(({ marker, bar }: any) => {
      const isSel = selected?.bar_id === bar.bar_id;
      const isHi  = highlighted.has(bar.bar_id);
      const el = marker.getElement();

      if (hasSuggests) {
        if (isSel || isHi) {
          // montrer uniquement sélection + résultats (jaunes)
          el.style.display = '';
          applyMarkerStyle(marker, isSel ? '#EF4444' : '#FFD700', 1);
        } else {
          // masquer le reste
          el.style.display = 'none';
        }
      } else {
        // aucune recherche → tout ré-afficher
        el.style.display = '';
        const { color } = computeMarkerStyle(bar, false, false);
        applyMarkerStyle(marker, color, 1);
      }
    });
  }, [suggestions, selected]);

  // Création des markers avec pin natif
  useEffect(() => {
    console.log("[Markers] Initialisation…", { mapReady, barsCount: bars.length });

    if (!mapRef.current || !mapReady || !bars.length) {
      console.warn("[Markers] Map pas prête ou pas de bars");
      return;
    }

    // Suppression des anciens markers
    Object.values(markerMap.current).forEach(({ marker }: any) => marker.remove());
    markerMap.current = {};



    // APRÈS — création des markers (infos intégrées + title + couleur)
    bars.forEach((bar) => {
      const { color, opacity } = computeMarkerStyle(bar, false, false);
      const marker = new mapboxgl.Marker({ color })
        .setLngLat([bar.lng, bar.lat])
        .addTo(mapRef.current!);
      applyMarkerStyle(marker, color, opacity);


      const el = marker.getElement();
      el.style.cursor = 'pointer';
      // Stocke des métadonnées utiles sur l'élément (debug/inspect)
      el.dataset.barId = bar.bar_id;
      if (bar.phone) el.dataset.phone = bar.phone;
      if (bar.url) el.dataset.url = bar.url;
      if (bar.rating != null) el.dataset.rating = String(bar.rating);
      if (bar.rating_count != null) el.dataset.ratingCount = String(bar.rating_count);

      // Accessibilité / hover : nom + note + téléphone
      el.title = [
        bar.name ?? 'Bar',
        bar.rating != null ? `• ${bar.rating}★ (${bar.rating_count ?? 0})` : '',
        bar.phone ? `• ${bar.phone}` : ''
      ].filter(Boolean).join(' ');

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        openBarPopup(bar);
      });

      // conserve aussi l'objet bar pour d'autres usages
      markerMap.current[bar.bar_id] = { marker, bar };
    });

    console.log("[Markers] Création terminée, total =", Object.keys(markerMap.current).length);
  }, [mapReady, bars]);

  function baseColorFor(bar: Bar): string {
    return statusColorFor(bar);               // ouvert/fermé/ouvre plus tard
  }

  function computeMarkerStyle(bar: Bar, isSelected: boolean, isHighlighted: boolean) {
    if (isHighlighted) return { color: '#FFD700', opacity: 1 }; // résultat = doré
    return { color: baseColorFor(bar), opacity: 1 };
  }

  function applyMarkerStyle(marker: mapboxgl.Marker, color: string, opacity: number) {
    if (typeof (marker as any).setColor === 'function') {
      (marker as any).setColor(color);
    } else {
      const path = marker.getElement()?.querySelector('svg path');
      if (path) path.setAttribute('fill', color);
    }
    marker.getElement().style.opacity = String(opacity);
  }
  // // Mise à jour des couleurs
  // useEffect(() => {
  //   console.log("[Markers] Mise à jour couleurs…", { suggestionsCount: suggestions.length, selected });

  //   const highlighted = new Set(suggestions.map(s => s.bar_id));

  //   Object.entries(markerMap.current).forEach(([id, { marker }]: any) => {
  //       // let color = '#22C55E';
  //       // let opacity = 1;
  //       // if (selected?.bar_id === id) {
  //       //   color = '#EF4444';
  //       // } else if (highlighted.has(id)) {
  //       //   color = '#FFD700';
  //       // }

  //       // // Couleur
  //       // if (typeof (marker as any).setColor === 'function') {
  //       //   (marker as any).setColor(color);
  //       // } else {
  //       //   const path = marker.getElement()?.querySelector('svg path');
  //       //   if (path) path.setAttribute('fill', color);
  //       // }

  //       // // Opacité
  //       // marker.getElement().style.opacity = opacity;


  //     // Version avec setColor si dispo
  //     if (typeof (marker as any).setColor === 'function') {
  //       (marker as any).setColor(color);
  //       console.log(`[Markers] setColor() appliqué sur ${id} → ${color}`);
  //     } else {
  //       // Fallback DOM pour versions Mapbox sans setColor
  //       const el = marker.getElement();
  //       const path = el?.querySelector('svg path');
  //       if (path) {
  //         path.setAttribute('fill', color);
  //         //console.log(`[Markers] Fallback DOM appliqué sur ${id} → ${color}`);
  //       } else {
  //         console.warn(`[Markers] Impossible de changer la couleur pour ${id}`);
  //       }
  //     }
  //   });
  // }, [suggestions, selected]);




  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        log("Search debounce:", { type: searchType, term: searchTerm });
        const term = searchTerm.trim();
        if (!term) { setSuggestions([]); return; }

        // 🔎 Recherche locale: description + musiques + tags
        if (searchType === 'ambiance') {
          const q = searchTerm.toLowerCase();
          const results: SearchResult[] = [];

          bars.forEach((b) => {
            const nameLC = (b.name || '').toString().toLowerCase();
            const desc   = (b.description_fr || b.description || '').toString().toLowerCase();

            const musics = (parseList(b.music_fr).length ? parseList(b.music_fr) : parseList(b.music))
              .map((m) => (m || '').toString().toLowerCase());

            const tags = (parseList(b.tags_fr).length ? parseList(b.tags_fr) : parseList(b.tags))
              .map((t) => (t || '').toString().toLowerCase());

            const matchName  = nameLC.includes(q);
            const matchMusic = musics.find((m) => m.includes(q));
            const matchTag   = tags.find((t) => t.includes(q));
            const inDesc     = desc.includes(q);

            if (matchName || matchMusic || matchTag || inDesc) {
              let match_term = (matchName && b.name) ? b.name : (matchMusic || matchTag || q);
              if (!matchName && !matchMusic && !matchTag && inDesc) {
                const i = desc.indexOf(q);
                const s = Math.max(0, i - 20), e = Math.min(desc.length, i + q.length + 20);
                match_term = `…${desc.slice(s, e)}…`;
              }
              results.push({ bar_id: b.bar_id, match_term });
            }
          });

          log("Search results (local ambiance):", results.length);
          setSuggestions(results);
          setShowSuggestions(true);
          return;
        }


        // 🌐 Comportement API inchangé pour item/music
        const qs = `${searchType}=${encodeURIComponent(term)}`;
        const res = await fetch(`${API}/public/bars/search?${qs}`);
        const data = await res.json();
        log("Search results:", data?.results?.length || 0);
        setShowSuggestions(true);
        setSuggestions(data?.results ?? []);
      } catch (e) {
        err("Search error", e);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm, searchType, bars]);




  function openBarPopup(bar: Bar) {
    const map = mapRef.current;
    if (!map) return;
  
    const offsetY = -Math.round(window.innerHeight / 4);
    const existing = popupMap.current[bar.bar_id];
  
    if (existing) {
      existing.addTo(map);
    } else {
      // 1) Container + contenu de la popin
      const container = document.createElement('div');
      container.style.cssText = 'min-width:240px;max-width:300px;color:#fff';
  
      const desc   = (bar.description_fr || bar.description || '').toString();
      const musics = (Array.isArray(bar.music_fr) && bar.music_fr.length ? bar.music_fr : bar.music || []).filter(Boolean);
      const tags   = (Array.isArray(bar.tags_fr)   && bar.tags_fr.length   ? bar.tags_fr   : bar.tags  || []).filter(Boolean);
      const hours  = Array.isArray(bar.weekday_text) ? bar.weekday_text : [];
      const today  = getTodayIdxFor(hours);
      const stars  = (r?: number) => r == null ? '' : '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
  
      container.innerHTML = `
        <div class="kpsule-pop-title">
          <button data-action="open-bar-modal"
                  class="kpsule-pop-cta"
                  aria-label="Ouvrir la fiche complète">
            ${bar.name || 'Bar'} <span class="kpsule-cta-icon">↗</span>
          </button>
        </div>
        ${desc ? `<div class="kpsule-pop-desc">${desc}</div>` : ''}
  
        ${bar.rating != null || bar.rating_count != null || bar.price ? `
          <div class="kpsule-pop-row" style="width:100%;align-items:center;background:rgba(255,255,255,0.05);padding:6px 8px;border-radius:8px;gap:10px">
            <div style="display:flex;align-items:center;gap:8px;min-width:0;flex:1">
              ${bar.rating != null ? `<span style="font-size:22px;line-height:1;letter-spacing:1px;color:#FFD700" title="${bar.rating}">${stars(bar.rating)}</span>` : ''}
              ${bar.rating != null ? `<span style="opacity:.9;font-weight:600;white-space:nowrap">${bar.rating.toFixed(1)}${bar.rating_count ? ` (${bar.rating_count})` : ''}</span>` : ''}
            </div>
            ${bar.price ? `<span style="font-weight:600;white-space:nowrap">💰 ${bar.price}</span>` : ''}
          </div>` : ''
        }
  
        ${bar.phone ? `
          <div class="kpsule-pop-row" style="gap:8px;align-items:center">
            📞 <a data-action="tel" class="kpsule-link" style="color:#93C5FD" href="javascript:void(0)">${bar.phone}</a>
          </div>` : ''
        }
  
        ${hours.length ? `
          <div class="kpsule-pop-row" style="display:block;margin-top:6px">
            <div style="opacity:.9;margin-bottom:4px">🕒 Horaires</div>
  
            <!-- Bandeau Aujourd’hui -->
            <div class="kpsule-hours-today" id="hoursToday-${bar.bar_id}">
              <span class="kpsule-hours-dot" id="hoursDot-${bar.bar_id}"></span>
              <span id="hoursTodayText-${bar.bar_id}" style="font-weight:700"></span>
            </div>
  
            <!-- Carrousel 3 lignes visibles 
            <div id="hoursWheel-${bar.bar_id}" class="kpsule-hours-wheel">
              <div id="hoursList-${bar.bar_id}" class="kpsule-hours-list"></div>
            </div> -->
          </div>` : ''
        }
  
        ${musics.length ? `<div class="kpsule-pop-row"><span>🎶</span><div class="scroll-chips">${musics.map(m=>`<span class="kpsule-chip">${m}</span>`).join('')}</div></div>` : ''}
        ${tags.length   ? `<div class="kpsule-pop-row"><span>🏷️</span><div class="scroll-chips">${tags.map(t=>`<span class="kpsule-chip">${t}</span>`).join('')}</div></div>`   : ''}
  
        ${bar.url ? `
          <div class="kpsule-pop-row" style="align-items:center;gap:8px">
            <a data-action="site" class="kpsule-link site" href="javascript:void(0)" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${bar.url}</a>
            <span data-action="gmap" title="Itinéraire Google Maps" style="cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#4285F4">🧭</span>
          </div>` : ''
        }
  
        <a data-action="items" class="kpsule-link items" href="javascript:void(0)">Voir les items</a>
        <a data-action="playlist" class="kpsule-link playlist" href="javascript:void(0)">Voir les musiques</a>
      `;
  
      // 2) Sélecteurs (après injection)
      const list   = container.querySelector('#hoursList-'  + bar.bar_id) as HTMLDivElement | null;
      const wheel  = container.querySelector('#hoursWheel-' + bar.bar_id) as HTMLDivElement | null;
      const dotEl  = container.querySelector('#hoursDot-'   + bar.bar_id) as HTMLDivElement | null;
      const txtEl  = container.querySelector('#hoursTodayText-' + bar.bar_id) as HTMLSpanElement | null;
  
      // 3) Données & helpers pour l’affichage
      const DAY_LABELS = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
      const days = hours.length === 7 ? hours : Array(7).fill('—');
      let offset = 0; // décalage cyclique
      const wrap = (i:number)=> (i%7+7)%7;
  
      function colorForDay(idx:number): string {
        const line = (days[idx] || '').toLowerCase();
        if (!line || line.includes('closed') || line.includes('fermé')) return '#EF4444'; // rouge
        if (idx === today) return statusColorFor(bar); // logique du pin pour AUJ
        return '#F97316'; // futur → ouvre plus tard
      }
  
      function compactHours(line:string): string {
        const m = line.match(/(\d{1,2}[:.]?\d{0,2}\s?(?:am|pm|[hH])?).*?(\d{1,2}[:.]?\d{0,2}\s?(?:am|pm|[hH])?)/i);
        if (!m) return line || '—';
        const fmt = (t:string)=> t.replace(/\s?h/i,'h').replace(/\s+/g,'').toLowerCase();
        return `${fmt(m[1])} – ${fmt(m[2])}`;
      }
  
      // Bandeau "Aujourd'hui"
      const todayColor = statusColorFor(bar);
      if (dotEl) dotEl.style.background = todayColor;
      if (txtEl) {
        const todayText = compactHours(days[today] || '');
        txtEl.textContent = `Aujourd’hui · ${todayText || '—'}`;
      }
  
      // 4) Scroll “site web”: inertie + snap (sans boutons)
      let ROW = 0;                // hauteur d'une ligne (auto)
      let visualShift = 0;        // décalage visuel pendant drag/inertie
      let rafId: number | null = null;
  
      function ensureRowHeight(){
        if (!list) return;
        const first = list.querySelector('.kpsule-hours-row') as HTMLElement | null;
        if (first) ROW = first.getBoundingClientRect().height || 42;
      }
      function applyTransform(y:number){ if (list) list.style.transform = `translateY(${y}px)`; }
      function cancelAnim(){ if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; } }
  
      function step(n:number){
        offset += n;
        // bouclage pour rester raisonnable (optionnel)
        offset = wrap(offset);
      }
  
      function redraw(){
        if (!list) return;
        list.innerHTML = [0,1,2].map(k => {
          const absIdx = wrap(today + offset + k);
          const color  = colorForDay(absIdx);
          const label  = DAY_LABELS[absIdx] || '';
          const text   = compactHours(days[absIdx] || '—');
          return `
            <div class="kpsule-hours-row">
              <span class="kpsule-day-bullet" style="background:${color}"></span>
              <span class="kpsule-day-name" style="color:${color}">${label}</span>
              <span style="opacity:.92">${text}</span>
            </div>
          `;
        }).join('');
        ensureRowHeight();
      }
      redraw();
  
      // Wheel desktop (proportionnel + snap court)
      let wheelAccum = 0;
      wheel?.addEventListener('wheel', (e:any)=>{
        e.preventDefault();
        ensureRowHeight();
        wheelAccum += e.deltaY; // le trackpad apporte déjà une inertie naturelle
        const steps = Math.trunc(wheelAccum / (ROW || 40));
        if (steps){
          step(steps);
          wheelAccum -= steps * (ROW || 40);
          if (list){ list.classList.remove('grabbing'); list.style.transition='transform .12s ease-out'; }
          applyTransform(0);
          setTimeout(()=>{ if(list) list.style.transition=''; }, 120);
          redraw();
        }
      }, { passive:false });
  
      // Drag (touch + souris) → momentum + snap
      let dragging = false;
      let y0 = 0, y = 0;
      let lastT = 0, lastY = 0;
      let velocity = 0; // px/ms
  
      const onStart = (clientY:number) => {
        cancelAnim();
        dragging = true;
        y0 = y = clientY;
        lastY = y; lastT = performance.now();
        velocity = 0;
        if (list){ list.style.transition=''; list.classList.add('grabbing'); }
      };
      const onMove = (clientY:number) => {
        if (!dragging) return;
        y = clientY;
        const dy = y - y0; // bas = positif
        visualShift = dy;
        applyTransform(visualShift);
  
        const now = performance.now();
        const dt  = Math.max(1, now - lastT);
        velocity  = (y - lastY) / dt;
        lastY = y; lastT = now;
      };
      const onEnd = () => {
        if (!dragging) return;
        dragging = false;
        list?.classList.remove('grabbing');
  
        // inertie
        const DECAY = 0.0019;   // friction (↑ = stop + court)
        const MAX_MS = 550;     // limite durée inertie
        const startT = performance.now();
        const startV = velocity; // px/ms
        let lastOffset = visualShift;
  
        const tick = () => {
          const t = performance.now() - startT;
          const v = startV * Math.max(0, 1 - (t * DECAY));
          const ds = v * 16.7; // ~ 1 frame
          lastOffset += ds;
          applyTransform(lastOffset);
  
          if (t < MAX_MS && Math.abs(v) > 0.01) {
            rafId = requestAnimationFrame(tick);
          } else {
            const steps = Math.round(lastOffset / (ROW || 40)) * -1; // swipe up = jours +
            if (steps) { step(steps); redraw(); }
            if (list) list.style.transition = 'transform .14s cubic-bezier(.2,.8,.2,1)';
            visualShift = 0;
            applyTransform(0);
            setTimeout(()=>{ if(list) list.style.transition=''; }, 150);
            rafId = null;
          }
        };
        tick();
      };
  
      // Touch
      wheel?.addEventListener('touchstart', (e:any)=> onStart(e.touches[0].clientY), {passive:true});
      wheel?.addEventListener('touchmove',  (e:any)=> onMove(e.touches[0].clientY),  {passive:true});
      wheel?.addEventListener('touchend',   onEnd,                                   {passive:true});
  
      // Mouse (pointer) — drag vertical
      wheel?.addEventListener('pointerdown', (e:any)=>{
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        onStart(e.clientY);
      });
      wheel?.addEventListener('pointermove', (e:any)=> onMove(e.clientY));
      wheel?.addEventListener('pointerup',   onEnd);
      wheel?.addEventListener('pointercancel', onEnd);
  
      // Actions
      container.addEventListener('click', async (e: any) => {
        const action = e?.target?.getAttribute?.('data-action');
        if (!action) return;
        if (action === 'site' && bar.url) window.open(bar.url, '_blank');
        if (action === 'open-bar-modal') { openBarFullModal(bar); return; }
        if (action === 'gmap') {
          const gmUrl = `https://www.google.com/maps/dir/?api=1&destination=${bar.lat},${bar.lng}&travelmode=transit`;
          window.open(gmUrl, '_blank');
        }
        if (action === 'tel' && bar.phone) window.open(`tel:${bar.phone.replace(/\s|\(|\)|-/g,'')}`);
        if (action === 'items') openItemsModal(bar.bar_id);
        if (action === 'playlist') openPlaylistModal(bar.bar_id);
      });
  
      // 5) Création de la popup
      const popup = new mapboxgl.Popup({
        offset: 16,
        closeButton: true,
        className: 'kpsule-popup',
        keepInView: true,
        maxWidth: '320px',
      })
        .setDOMContent(container)
        .setLngLat([bar.lng, bar.lat])
        .addTo(map);
  
      popup.on('close', () => setSelected(null));
      popupMap.current[bar.bar_id] = popup;
    }
  
    // Focus carte
    map.flyTo({
      center: [bar.lng, bar.lat],
      zoom: 16.2,
      pitch: 60,
      bearing: -18,
      duration: 600,
      offset: [0, offsetY],
    });
  
    setSelected(bar);
  }
  


  function statusColorFor(bar: Bar): string {
    if (!Array.isArray(bar.weekday_text) || bar.weekday_text.length === 0) return '#999999';

    // Jour actuel (0=dimanche … 6=samedi)
    const todayIdx = getTodayIdxFor(bar.weekday_text);
    const todayStr = bar.weekday_text[todayIdx] || '';
    const lower = todayStr.toLowerCase();

    if (lower.includes('closed') || lower.includes('fermé')) {
      return '#EF4444'; // rouge
    }

    // Extraire les heures d'ouverture (format ex: "Friday: 11:00 PM – 3:00 AM")
    const match = todayStr.match(/(\d{1,2}[:.]?\d{0,2}\s?(?:am|pm|[hH])?).*?(\d{1,2}[:.]?\d{0,2}\s?(?:am|pm|[hH])?)/i);
    if (!match) return '#22C55E';

    const [ , openStr, closeStr ] = match;

    const parseTime = (t: string) => {
      const now = new Date();
      let hours = 0, minutes = 0;
      const m = t.match(/(\d{1,2})(?::(\d{2}))?\s?(am|pm)?/i);
      if (!m) return null;
      hours = parseInt(m[1], 10);
      minutes = m[2] ? parseInt(m[2], 10) : 0;
      if (m[3]) {
        const ampm = m[3].toLowerCase();
        if (ampm === 'pm' && hours < 12) hours += 12;
        if (ampm === 'am' && hours === 12) hours = 0;
      }
      const d = new Date(now);
      d.setHours(hours, minutes, 0, 0);
      return d;
    };

    const now = new Date();
    const openTime = parseTime(openStr);
    const closeTime = parseTime(closeStr);

    if (openTime && closeTime) {
      // Gestion du passage minuit (ex: 11PM – 3AM)
      if (closeTime < openTime) closeTime.setDate(closeTime.getDate() + 1);

      if (now >= openTime && now <= closeTime) {
        return '#22C55E'; // vert ouvert
      }
      if (now < openTime) {
        return '#F97316'; // orange : ferme maintenant mais ouvrira plus tard
      }
    }
    return '#EF4444'; // rouge : fermé aujourd'hui
  }

  function openStatus(bar: Bar): { color: string; label: string } {
    const color = statusColorFor(bar); // garde ta logique existante
    // Jour courant
    const idx = getTodayIdxFor(bar.weekday_text);
    const todayStr = (bar.weekday_text?.[idx] || '').toLowerCase();
    const m = (bar.weekday_text?.[idx] || '').match(/.../i);

    const fmt = (t?: string) => (t || '').replace(/\s?h/i, 'h'); // 7h/19h style fr

    let label = 'Fermé aujourd’hui';
    if (todayStr.includes('closed') || todayStr.includes('fermé')) {
      label = 'Fermé aujourd’hui';
    } else if (m) {
      const [, openStr, closeStr] = m;
      // on ne refait pas tout le parsing: on affiche simple
      if (color === '#22C55E') label = `Ouvert (jusqu’à ${fmt(closeStr)})`;
      else if (color === '#F97316') label = `Ouvre à ${fmt(openStr)}`;
      else label = 'Fermé pour le moment';
    } else {
      if (color === '#22C55E') label = 'Ouvert maintenant';
      else if (color === '#F97316') label = 'Ouvre plus tard';
    }
    return { color, label };
  }


  async function drawRoute(from: [number, number], to: [number, number]) {
    if (!mapRef.current) return;
    try {
      const url = `https://router.project-osrm.org/route/v1/foot/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const json = await res.json();
      const route = json?.routes?.[0];
      if (!route) return;

      const feature: any = { type: 'Feature', properties: {}, geometry: route.geometry };

      const map = mapRef.current;
      if (map.getSource('route')) {
        (map.getSource('route') as any).setData(feature);
      } else {
        map.addSource('route', { type: 'geojson', data: feature });

        map.addLayer({
          id: 'route-halo',
          type: 'line',
          source: 'route',
          paint: { 'line-color': '#66A7FF', 'line-width': 12, 'line-blur': 6, 'line-opacity': 0.35 },
        });

        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#3B82F6', 'line-width': 7, 'line-opacity': 0.95 },
        });

        map.addLayer({
          id: 'route-arrows',
          type: 'symbol',
          source: 'route',
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': 60,
            'icon-image': 'triangle-11',
            'icon-rotate': 90,
            'icon-size': 1.2,
          },
          paint: { 'icon-color': '#BBD5FF' },
        });
      }

      const bbox = turf.bbox(feature) as [number, number, number, number];
      map.fitBounds(
        [
          [bbox[0], bbox[1]],
          [bbox[2], bbox[3]],
        ],
        { padding: { top: 120, bottom: 180, left: 40, right: 40 }, pitch: 60, bearing: -18, duration: 900 }
      );

      const km = route.distance / 1000;
      const mins = Math.round(route.duration / 60);
      setDistanceText(km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);
      setDurationText(`${mins} mins`);
      setEtaText(new Date(Date.now() + mins * 60000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
    } catch (e) {
      console.error('OSRM error', e);
    }
  }

  async function openItemsModal(bar_id: string) {
    try {
      const res = await fetch(`${API}/bars/${bar_id}/items`);
      const data = await res.json();
      setModalItems(data.items ?? []);
      setShowItemsModal(true);
    } catch (e) {
      console.error(e);
    }
  }

  async function openPlaylistModal(bar_id: string) {
    const found = bars.find(b => b.bar_id === bar_id) || null;
    setSelectedBar(found);

    try {
      const res = await fetch(`${API}/public/bars/${bar_id}/playlist`);
      if (res.status === 403) {
        alert('Accès interdit à la playlist');
        return;
      }
      const data = await res.json();
      setPlaylistModal(data ?? []);
      setShowPlaylistModal(true);
    } catch (e) {
      console.error(e);
    }
  }

  function jumpToResult(s: SearchResult) {
    const bar = bars.find((b) => b.bar_id === s.bar_id);
    if (!bar) return;
    openBarPopup(bar);
    setSearchTerm('');
    setSuggestions([]);
  }

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100dvh',
        height: '100%',
        WebkitFillAvailable: 'height',
        background: 'linear-gradient(160deg,#0b0f1d 0%,#0a0c18 60%,#0b1020 100%)',
      }}
    >
      <BrowserDebugInfo />

      {/* halo de fond */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(800px 400px at 50% -10%, rgba(74,222,255,.18), transparent 60%), radial-gradient(700px 400px at 70% 110%, rgba(59,130,246,.18), transparent 60%)',
        }}
      />

      {/* Titre */}
      <div style={{ position: 'absolute', top: 12, left: 0, right: 0, textAlign: 'center', color: '#fff' }}>
      {!isFullscreen && (
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 0.2 }}>Assa trouve ton spot ce soir</div>)}
        <div
          style={{
            width: '40%',
            maxWidth: 160,
            height: 3,
            margin: '8px auto',
            borderRadius: 6,
            background: 'linear-gradient(90deg,#60A5FA,#22D3EE)',
          }}
        />
            </div>

            {/* Barre de recherche flottante - mobile friendly */}
            <div
              style={{
                position: 'absolute',
                top: isFullscreen ? 12 : 64,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '94%',
                maxWidth: 780,
                display: 'flex',
                flexDirection: window.innerWidth < 640 ? 'column' : 'row',
                gap: 8,
                zIndex: 10,
                padding: '0 10px'
              }}
            >
        <select
          value={searchType}
          onChange={(e) => setSearchType(e.target.value as 'item' | 'music' | 'ambiance')}
          style={{
            padding: '10px 8px',
            borderRadius: 12,
            background: 'rgba(13,18,36,.7)',
            border: '1px solid #22304a',
            color: '#fff',
            backdropFilter: 'blur(8px)',
          }}
        >
          <option value="ambiance">Ambiance</option>
          <option value="item">Item</option>
          <option value="music">Musique</option>
        </select>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setShowSuggestions(true)}  // 👈 re-ouvre à la sélection de la barre

            placeholder={
              searchType === 'item'
                ? 'Recherche ton drink préféré'
                : searchType === 'music'
                  ? 'Recherche ton artiste préféré'
                  : 'Trouve le bar qui matche ta vibe'
            }

            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 12,
              background: 'rgba(13,18,36,.7)',
              border: '1px solid #22304a',
              color: '#fff',
              outline: 'none',
              backdropFilter: 'blur(8px)',
            }}
          />
          {showSuggestions && sortedSuggestions.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '110%',
                  left: 0,
                  right: 0,
                  background: '#0a0e1c',
                  border: '1px solid #22304a',
                  borderRadius: 12,
                  overflow: 'auto',
                  maxHeight: 130,
                  zIndex: 20,
                  boxShadow: '0 8px 24px rgba(0,0,0,.45)',
                }}
              >
                {sortedSuggestions.map((s, i) => {
                  const bar = bars.find((b) => b.bar_id === s.bar_id);
                  const barName = bar?.name || s.bar_id;
                  const st = bar ? openStatus(bar) : { color: '#fff', label: '' };

                return (
                  <div
                    key={i}
                    onClick={() => jumpToResult(s)}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #162039',
                    }}
                    onMouseEnter={(e) => ((e.currentTarget.style.background = '#11182b'))}
                    onMouseLeave={(e) => ((e.currentTarget.style.background = 'transparent'))}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ color: st.color }}>
                        {(s.match_term === barName)
                          ? barName
                          : `${barName} - ${s.match_term}`}
                      </span>
                      {st.label && (
                        <span style={{ color: st.color, fontSize: 12, opacity: 0.95 }}>
                          {st.label}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* conteneur carte */}
      <div
          ref={containerRef}
          style={{
            position: 'absolute',
            inset: isFullscreen ? '0' : '112px 16px 120px 16px',
            borderRadius: isFullscreen ? 0 : 24,
            overflow: 'hidden',
            boxShadow: isFullscreen ? 'none' : '0 14px 60px rgba(0,0,0,.45), inset 0 0 0 1px #182137',
            zIndex: 1,
          }}
        />

      {/* bouton Resume
      <button
        onClick={() => {
          if (!mapRef.current || !selected) return;
          mapRef.current.flyTo({
            center: start as LngLatLike,
            zoom: 16.2,
            pitch: 60,
            bearing: -18,
            duration: 600,
          });
        }}
        style={{
          position: 'absolute',
          left: 26,
          bottom: 150,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          color: '#fff',
          borderRadius: 12,
          cursor: 'pointer',
          background: 'rgba(13,18,36,.7)',
          border: '1px solid #22304a',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 6px 20px rgba(0,0,0,.35)',
        }}
      >
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22D3EE' }} />
      </button> */}

      {/* panneau bas */}
      {!isFullscreen && (
          <div
            style={{
              position: 'absolute',
              left: 12,
              right: 12,
              bottom: 12,
              height: 96,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              padding: '4px 8px',
              color: '#fff',
              borderRadius: 18,
              background: 'linear-gradient(180deg, rgba(12,16,30,.85), rgba(10,14,26,.85))',
              border: '1px solid #1e2a44',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 10px 28px rgba(0,0,0,.45)',
            }}
          >
            {/* Gauche : Météo + Heure */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', borderRadius: 12,
                  background: 'rgba(13,18,36,.7)', border: '1px solid #22304a'
                }}
                title="Météo actuelle"
              >
                <span style={{ fontSize: 18 }}>
                  {weather ? weatherIcon(weather.code, weather.isDay === false) : '🌡️'}
                </span>
                <span style={{ opacity: .95 }}>
                  {weather?.temp != null ? `${Math.round(weather.temp)}°C` : '—'}
                </span>
              </div>

              <div
                style={{
                  padding: '8px 10px', borderRadius: 12,
                  background: 'rgba(13,18,36,.7)', border: '1px solid #22304a',
                  fontVariantNumeric: 'tabular-nums'
                }}
                title="Heure locale"
              >
                🕒 {nowText}
              </div>
            </div>

            {/* Droite : Évènements */}
            <div className="flex justify-center items-center">
              <EventsFloatingButton />
            </div>
          </div>
        )}

    <button
      onClick={toggleFullscreen}
      aria-label={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 20,
        padding: '10px 12px',
        color: '#fff',
        background: 'rgba(13,18,36,.7)',
        border: '1px solid #22304a',
        borderRadius: 12,
        backdropFilter: 'blur(8px)',
        boxShadow: '0 6px 20px rgba(0,0,0,.35)',
        cursor: 'pointer'
      }}
    >
      {isFullscreen ? '⤢' : '⤢'}
    </button>

      {/* Modal Items */}
      {showItemsModal && (
        <div
          className="fixed inset-0"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: '#fff',
              width: '90%',
              height: '90%',
              borderRadius: 12,
              overflow: 'auto',
              padding: 16,
              position: 'relative',
              color: '#0b0f1d',
            }}
          >
            <button
              onClick={() => setShowItemsModal(false)}
              style={{ position: 'absolute', top: 8, right: 16, color: '#374151', fontSize: 20 }}
            >
              ✕
            </button>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
              {selectedBar?.name ? `Items – ${selectedBar.name}` : 'Items disponibles'}
            </h2>

            {modalItems.length === 0 ? (
              <div
                style={{
                  height: 'calc(100% - 60px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  color: '#374151',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: 42, marginBottom: 8 }}>🛒</div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Aucun item publié</div>
                <div style={{ opacity: 0.8 }}>
                  Ce bar n’a pas encore renseigné sa carte.
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))',
                  gap: 12,
                }}
              >
                {modalItems.map((item: any) => (
                  <div key={item.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 8 }}>
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }}
                      />
                    )}
                    <div style={{ fontWeight: 700 }}>{item.name}</div>
                    <div style={{ fontSize: 14, color: '#374151' }}>{item.description}</div>
                    <div style={{ marginTop: 6, color: '#16a34a', fontWeight: 800 }}>{item.price} $</div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      )}

      {/* Modal Playlist */}
      {showPlaylistModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: '#000',
              width: '90%',
              height: '90%',
              borderRadius: 12,
              overflow: 'auto',
              padding: 16,
              position: 'relative',
              color: '#0b0f1d',
              scrollbarWidth: 'none',       // Firefox
              msOverflowStyle: 'none',      // IE/Edge
            }}
          >
            <button
              onClick={() => setShowPlaylistModal(false)}
              style={{ position: 'absolute', top: 8, right: 16, color: '#ffffffff', fontSize: 20 }}
            >
              ✕
            </button>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12, color: '#ffffffff' }}>
              {selectedBar?.name || 'Playlist'}, leurs incontournables :
            </h2>
            {Array.isArray(playlistModal) && playlistModal.length === 0 ? (
              <div
                style={{
                  height: 'calc(100% - 60px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  color: '#e5e7eb',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: 42, marginBottom: 8 }}>🎵</div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Aucune musique publique</div>
                <div style={{ opacity: 0.8 }}>
                  Ce bar n’a pas encore partagé sa playlist.
                </div>
              </div>
            ) : (
              <div className="px-1">
                <PlaylistGrid
                  tracks={playlistModal as any}
                  onVote={() => {}}
                  likeDisplay="both"
                  enableRedirect={true}
                  hrefForTrack={(t) => t.spotify_url}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ⬇️ Nouveau : Modal FULL SCREEN Bar */}
      {showBarModalFS && selectedBar && (
        <div
          className="kpsule-fs-wrap"
          onClick={(e)=>{ if(e.target===e.currentTarget) setShowBarModalFS(false); }}
        >
          <div className="kpsule-fs">
            <button className="kpsule-close" onClick={()=>setShowBarModalFS(false)}>✕</button>

            {/* Header + Tabs */}
            <div className="kpsule-fs-head">
              <div className="kpsule-fs-tabs" role="tablist" aria-label="Bar details">
                {(['infos','musique','menu','events'] as const).map(t=>(
                  <button
                    key={t}
                    className="kpsule-tab"
                    role="tab"
                    aria-selected={activeTab===t}
                    onClick={()=>setActiveTab(t)}
                  >
                    {t==='infos'?'Infos':t==='musique'?'Musique':t==='menu'?'Menu':'Évènements'}
                  </button>
                ))}
              </div>
            </div>

            {/* Body */}
            <div className="kpsule-fs-body">
                  <div>
                    <div style={{opacity:1,fontWeight:900, textAlign: "center",padding:8,fontSize:22}}>
                      {(selectedBar.bar_name || selectedBar.name) || '—'}
                    </div>
                  </div>
              {/* INFOS */}
              {activeTab==='infos' && (

                <div className="kpsule-grid">

                  <div className="kpsule-card">
                    <div style={{fontWeight:800,marginBottom:6}}>Description</div>
                    <div style={{opacity:.92}}>
                      {(selectedBar.description_fr || selectedBar.description) || '—'}
                    </div>
                  </div>

                  <div className="kpsule-card">
                    <div style={{fontWeight:800,marginBottom:6}}>Contacts</div>
                    <div className="kpsule-kv">📞 {selectedBar.phone || '—'}</div>
                    <div className="kpsule-kv">
                      🔗 {selectedBar.url ? (
                        <a href={selectedBar.url} target="_blank" style={{color:'#93C5FD'}}>{selectedBar.url}</a>
                      ) : '—'}
                    </div>
                    <div className="kpsule-kv">
                      ⭐ {selectedBar.rating != null ? `${selectedBar.rating.toFixed(1)} (${selectedBar.rating_count ?? 0})` : '—'}
                    </div>
                    <div className="kpsule-kv">💰 {selectedBar.price ?? '—'}</div>
                  </div>

                  <div className="kpsule-card">
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Ambiance</div>

                    <RowPills
                      icon="🎶"
                      items={
                        (parseList(selectedBar.music_fr).length
                          ? parseList(selectedBar.music_fr)
                          : parseList(selectedBar.music))
                      }
                    />

                    <div style={{ marginTop: 8 }}>
                      <RowPills
                        icon="🏷️"
                        items={
                          (parseList(selectedBar.tags_fr).length
                            ? parseList(selectedBar.tags_fr)
                            : parseList(selectedBar.tags))
                        }
                      />
                    </div>
                  </div>

                  <div className="kpsule-card" style={{gridColumn:'1/-1'}}>
                    <div style={{fontWeight:800,marginBottom:6}}>Horaires</div>
                    {(() => {
                      const week = normalizeWeek(selectedBar.weekday_text || []);
                      const isClosed = (line: string) =>
                        !line ||
                        /ferm[ée]|closed|close/i.test(line.trim());

                      return (
                        <ul style={{listStyle:'none', margin:0, padding:0}}>
                          {week.map((ln, idx) => {
                            const text = stripDayPrefix(ln || '').trim();
                            const closed = isClosed(text);
                            const color = closed ? '#EF4444' : '#22C55E';
                            return (
                              <li key={idx}
                                  style={{
                                    display:'flex',
                                    justifyContent:'space-between',
                                    gap:12,
                                    padding:'8px 10px',
                                    borderBottom:'1px solid rgba(255,255,255,.06)',
                                    color
                                  }}>
                                <span style={{opacity:.9, minWidth:46, fontWeight:700}}>
                                  {DAY_LABELS_FR[idx]}
                                </span>
                                <span style={{opacity:.95}}>
                                  {text || '—'}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      );
                    })()}
                  </div>


                  {/* Bouton Google Maps (extrait de l’ancienne case Itinéraire) */}
                  <div style={{gridColumn:'1/-1',textAlign:'center',marginTop:12}}>
                    <button
                      onClick={()=>window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedBar.lat},${selectedBar.lng}&travelmode=transit`,'_blank')}
                      style={{padding:'10px 12px',borderRadius:10,border:'1px solid #22304a',background:'linear-gradient(90deg,#60A5FA,#22D3EE)',color:'#0b0f1d',fontWeight:800}}
                    >
                      Ouvrir dans Google Maps 🧭
                    </button>
                  </div>
                </div>
              )}


              {/* MUSIQUE */}
              {activeTab==='musique' && (
                <div>
                  {Array.isArray(playlistModal) && playlistModal.length>0 ? (
                    <div className="px-1">
                      <PlaylistGrid
                        tracks={playlistModal as any}
                        onVote={()=>{}}
                        likeDisplay="both"
                        enableRedirect={true}
                        hrefForTrack={(t)=>t.spotify_url}
                      />
                    </div>
                  ) : (
                    <div className="kpsule-card" style={{textAlign:'center',opacity:.9}}>
                      🎵 Aucune playlist publique
                    </div>
                  )}
                </div>
              )}

              {/* MENU (remplace l'ancien onglet “carte”) */}
              {activeTab==='menu' && (
                <div className="kpsule-grid" style={{gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))'}}>
                  {Array.isArray(fsMenuItems) && fsMenuItems.length>0 ? (
                    fsMenuItems.map((item:any)=>(
                      <div key={item.id} className="kpsule-card">
                        {item.image_url && (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="kpsule-img"
                            style={{height:160,marginBottom:8}}
                          />
                        )}
                        <div style={{fontWeight:800,marginBottom:4}}>{item.name}</div>
                        {item.description && <div style={{opacity:.9,marginBottom:6}}>{item.description}</div>}
                        {item.price!=null && <div style={{color:'#22C55E',fontWeight:800}}>{item.price} $</div>}
                      </div>
                    ))
                  ) : (
                    <div className="kpsule-card" style={{textAlign:'center',opacity:.9}}>
                      🛒 Aucune carte publiée pour le moment.
                    </div>
                  )}
                </div>
              )}

              {/* ÉVÈNEMENTS */}
              {activeTab==='events' && (
                <div className="kpsule-grid">
                  {Array.isArray(eventsModal) && eventsModal.length>0 ? eventsModal.map((ev:any)=>(
                    <div key={ev.id||ev.slug} className="kpsule-card">
                      {ev.image_url && <img src={ev.image_url} alt={ev.name} className="kpsule-img" style={{height:160,marginBottom:8}}/>}
                      <div style={{fontWeight:800,marginBottom:4}}>{ev.name}</div>
                      <div style={{opacity:.9,marginBottom:6}}>
                        {ev.local_date || ev.date || 'Date à venir'} {ev.local_time ? `· ${ev.local_time}` : ''}
                      </div>
                      {ev.venue?.name && <div style={{opacity:.85}}>📍 {ev.venue.name}</div>}
                      {ev.url && <a href={ev.url} target="_blank" style={{display:'inline-block',marginTop:8,color:'#93C5FD'}}>Voir l’évènement ↗</a>}
                    </div>
                  )) : (
                    <div className="kpsule-card" style={{textAlign:'center',opacity:.9}}>Aucun évènement à venir.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}