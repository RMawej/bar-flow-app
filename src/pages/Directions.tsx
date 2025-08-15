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

  const [searchType, setSearchType] = useState<'item' | 'music' | 'ambiance'>('ambiance');
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedBar, setSelectedBar] = useState<Bar | null>(null);

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



  // Modals
  const [modalItems, setModalItems] = useState<any[]>([]);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [playlistModal, setPlaylistModal] = useState<any[]>([]);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

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
      const today = new Date().getDay();
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
  // 1) Geolocation (avec logs)
  useEffect(() => {
    if (!navigator.geolocation) { warn("Geolocation API not available"); return; }
    if (location.protocol !== 'https:') warn("Geolocation may be inaccurate without HTTPS");

    log("Geolocation: watchPosition start (high accuracy)");
    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        const { latitude, longitude, accuracy } = p.coords;
        log("Geolocation: success", { lat: latitude, lng: longitude, accuracy: `${accuracy}m` });
        setStart([longitude, latitude]); // ⬅️ bien [lng,lat]
      },
      (e) => warn("Geolocation: denied/fail", e?.code, e?.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
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


      log("map.load → mapReady=true; flyTo start");
      setMapReady(true);
      map.flyTo({ center: start as LngLatLike, zoom: 15.2, pitch: 60, bearing: -18, duration: 600 });
    });



    return () => {
      log("map.remove()");
      setMapReady(false);
      map.remove();
    };
  }, []);

  // 4) Recenter après géoloc (seulement une fois)
  const recenterDone = useRef(false);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !start || recenterDone.current) {
      if (!mapReady) warn("Recenter skipped: map not ready");
      return;
    }
    log("Recenter + move me-marker to", start);
    meMarkerRef.current?.setLngLat(start); 
    map.flyTo({ center: start as LngLatLike, zoom: 15.2, pitch: 60, bearing: -18, duration: 600 });
    recenterDone.current = true; // empêche relance
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
    .kpsule-pop-desc{
      opacity:.9;font-style:italic;margin-bottom:8px;line-height:1.35;
      overflow-wrap:anywhere;word-break:break-word;hyphens:auto;
      scrollbar-width:none;
    }
    .kpsule-pop-desc::-webkit-scrollbar{display:none}
    .kpsule-pop-row{display:flex;align-items:flex-start;gap:6px;margin-top:6px;overflow:hidden} /* ✅ pas de débordement */
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
    if (isSelected)   return { color: '#EF4444', opacity: 1 }; // sélection = rouge
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
          return;
        }


        // 🌐 Comportement API inchangé pour item/music
        const qs = `${searchType}=${encodeURIComponent(term)}`;
        const res = await fetch(`${API}/public/bars/search?${qs}`);
        const data = await res.json();
        log("Search results:", data?.results?.length || 0);
        setSuggestions(data?.results ?? []);
      } catch (e) {
        err("Search error", e);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm, searchType, bars]);




  // APRÈS — affiche TOUTES les infos de l’API
  function openBarPopup(bar: Bar) {
    const map = mapRef.current;
    if (!map) return;

    const offsetY = -Math.round(window.innerHeight / 4);

    const existing = popupMap.current[bar.bar_id];
    if (existing) {
      existing.addTo(map);
    } else {
      const container = document.createElement('div');
      container.style.cssText = 'min-width:240px;max-width:300px;color:#fff';

      const desc = (bar.description_fr || bar.description || '').toString();
      const musics = (Array.isArray(bar.music_fr) && bar.music_fr.length ? bar.music_fr : bar.music || []).filter(Boolean);
      const tags   = (Array.isArray(bar.tags_fr)   && bar.tags_fr.length   ? bar.tags_fr   : bar.tags  || []).filter(Boolean);
      const hours  = Array.isArray(bar.weekday_text) ? bar.weekday_text : [];
      const today  = new Date().getDay(); // 0=dim … 6=sam
      const stars  = (r?: number) => r == null ? '' : '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));

      const coords = `${bar.lat?.toFixed?.(6)}, ${bar.lng?.toFixed?.(6)}`;

      container.innerHTML = `
        <div class="kpsule-pop-title">${bar.name || 'Bar'}</div>
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

            <button data-action="toggle-hours" data-hours-id="hours-${bar.bar_id}"
                    style="width:100%;display:flex;align-items:center;gap:8px;justify-content:space-between;
                          background:rgba(255,255,255,.06);border:1px solid #22304a;border-radius:8px;
                          padding:8px 10px;cursor:pointer;color:#fff">
              <span style="font-weight:700">${hours[today] || '—'}</span>
              <span data-caret style="transition:transform .25s ease">▾</span>
            </button>

            <div id="hours-${bar.bar_id}" class="hours-more"
                style="max-height:0;overflow:hidden;opacity:0;transition:max-height .25s ease, opacity .25s ease; margin-top:6px">
              ${hours.map((h,i)=> i===today ? '' : `
                <div style="display:flex;gap:6px;padding:6px 8px;border-radius:6px;background:rgba(255,255,255,.04);margin-bottom:6px;opacity:.95">
                  <span>${h}</span>
                </div>
              `).join('')}
            </div>
          </div>` : ''
        }

        ${musics.length ? `<div class="kpsule-pop-row"><span>🎶</span><div class="scroll-chips">${musics.map(m=>`<span class="kpsule-chip">${m}</span>`).join('')}</div></div>` : ''}
        ${tags.length ?   `<div class="kpsule-pop-row"><span>🏷️</span><div class="scroll-chips">${tags.map(t=>`<span class="kpsule-chip">${t}</span>`).join('')}</div></div>`   : ''}

        ${bar.url ? `
          <div class="kpsule-pop-row" style="align-items:center;gap:8px">
            <a data-action="site" class="kpsule-link site" href="javascript:void(0)" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${bar.url}</a>
            <span data-action="gmap" title="Itinéraire Google Maps" style="cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#4285F4">🧭</span>
          </div>
        ` : ''}

        <a data-action="items" class="kpsule-link items" href="javascript:void(0)">Voir les items</a>
        <a data-action="playlist" class="kpsule-link playlist" href="javascript:void(0)">Voir les musiques</a>
      `;

      // Toggle horaires (animation auto en utilisant scrollHeight)
      container.querySelectorAll('[data-action="toggle-hours"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-hours-id');
          const panel = container.querySelector('#' + id) as HTMLDivElement | null;
          const caret = btn.querySelector('[data-caret]') as HTMLElement | null;
          if (!panel) return;

          const isOpen = panel.style.maxHeight && panel.style.maxHeight !== '0px';
          if (isOpen) {
            panel.style.maxHeight = '0px';
            panel.style.opacity = '0';
            if (caret) caret.style.transform = 'rotate(0deg)';
          } else {
            panel.style.maxHeight = panel.scrollHeight + 'px';
            panel.style.opacity = '1';
            if (caret) caret.style.transform = 'rotate(180deg)';
          }
        });
      });


      container.addEventListener('click', async (e: any) => {
        const action = e?.target?.getAttribute?.('data-action');
        if (!action) return;
        if (action === 'site' && bar.url) window.open(bar.url, '_blank');
        if (action === 'gmap') {
          const gmUrl = `https://www.google.com/maps/dir/?api=1&destination=${bar.lat},${bar.lng}&travelmode=transit`;
          window.open(gmUrl, '_blank');
        }
        if (action === 'tel' && bar.phone) window.open(`tel:${bar.phone.replace(/\s|\(|\)|-/g,'')}`);
        if (action === 'copy-coords') {
          try {
            await navigator.clipboard.writeText(`${bar.lat},${bar.lng}`);
            (e.target as HTMLElement).textContent = 'Copié ✓';
            setTimeout(() => ((e.target as HTMLElement).textContent = 'Copier'), 1200);
          } catch {}
        }
        if (action === 'items') openItemsModal(bar.bar_id);
        if (action === 'playlist') openPlaylistModal(bar.bar_id);
      });

      const popup = new mapboxgl.Popup({ offset: 16, closeButton: true, className: 'kpsule-popup' })
        .setDOMContent(container)
        .setLngLat([bar.lng, bar.lat])
        .addTo(map);
      popup.on('close', () => {
        setSelected(null);
        requestAnimationFrame(() => {
          Object.values(markerMap.current).forEach(({ marker, bar }: any) => {
            const { color } = computeMarkerStyle(bar, false, false);
            marker.getElement().style.display = '';
            applyMarkerStyle(marker, color, 1);
          });
        });
      });
      popupMap.current[bar.bar_id] = popup;
    }

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
    const todayIdx = new Date().getDay();
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
    const todayStr = (bar.weekday_text?.[new Date().getDay()] || '').toLowerCase();

    // Heures “HH:MM … HH:MM” si dispo
    const m = (bar.weekday_text?.[new Date().getDay()] || '').match(/(\d{1,2}[:.]?\d{0,2}\s?(?:am|pm|[hH])?).*?(\d{1,2}[:.]?\d{0,2}\s?(?:am|pm|[hH])?)/i);
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
        height: '100vh',
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
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 0.2 }}>Assa trouve ton spot ce soir</div>
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
          top: 64,
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
                  maxHeight: 260,
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
          inset: '112px 16px 120px 16px',
          borderRadius: 24,
          overflow: 'hidden',
          boxShadow: '0 14px 60px rgba(0,0,0,.45), inset 0 0 0 1px #182137',
        }}
      />

      {/* bouton Resume */}
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
      </button>

      {/* panneau bas */}
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
        gap: 4,
        padding: '4px 4px',
        color: '#fff',
        borderRadius: 18,
        background: 'linear-gradient(180deg, rgba(12,16,30,.85), rgba(10,14,26,.85))',
        border: '1px solid #1e2a44',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 10px 28px rgba(0,0,0,.45)',
      }}
    >

          <div className="flex justify-center items-center">
            <EventsFloatingButton />
          </div>
    </div>


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
    </div>
  );
}
