// app/fiddles-directions/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl, { Map, LngLatLike } from 'mapbox-gl';
import * as turf from '@turf/turf';
import 'mapbox-gl/dist/mapbox-gl.css';

console.log("[Directions] import.meta.env.VITE_MAPBOX_TOKEN =", import.meta.env.VITE_MAPBOX_TOKEN);

mapboxgl.accessToken =
  import.meta.env.VITE_MAPBOX_TOKEN ||
  'pk.eyJ1Ijoicm1vdWhhd2VqZ3JlbWVhIiwiYSI6ImNtZTM2MW80bTAyNGUyanB6NXdkeXg2MW0ifQ.lprSRRWEUAmh3uiKRjp2PA';

type Bar = {
  bar_id: string;
  id?: string;
  name?: string;
  description?: string;
  description_fr?: string;
  music?: string | string[];
  music_fr?: string | string[];
  tags?: string | string[];
  tags_fr?: string | string[];
  price?: string | number;
  url?: string;
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

  const [searchType, setSearchType] = useState<'item' | 'music'>('item');
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);

  // Modals
  const [modalItems, setModalItems] = useState<any[]>([]);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [playlistModal, setPlaylistModal] = useState<any[]>([]);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

  // Références markers & popups
  const markerMap = useRef<Record<string, mapboxgl.Marker>>({});
  const popupMap = useRef<Record<string, mapboxgl.Popup>>({});

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

  // 2) Fetch bars (avec logs + limiter à 5 + normaliser coords)
  useEffect(() => {
    (async () => {
      try {
        log("Fetching bars…");
        const res = await fetch(`${API}/public/bars/locations`);
        log("Bars status:", res.status);
        const data = await res.json();

        const raw = data?.locations ?? [];
        const cleaned = raw
          .filter((b: any) => Number.isFinite(Number(b?.lng)) && Number.isFinite(Number(b?.lat)))
          .map((b: any) => ({ ...b, lng: Number(b.lng), lat: Number(b.lat) }));

        log("Bars total:", raw.length, " → kept all valid:", cleaned.length);
        console.log(cleaned);

        setBars(cleaned);
      } catch (e) {
        err("Failed to load bars", e);
      }
    })();
  }, []);



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
        const feats = map.queryRenderedFeatures(e.point, { layers: ['bars-layer'] });
        console.log('[DEBUG] qrf bars-layer =', feats.length, feats[0]?.properties);
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

  // 4) Recenter après géoloc (séparé)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) { warn("Recenter skipped: map not ready"); return; }
    log("Recenter + move me-marker to", start);
    meMarkerRef.current?.setLngLat(start); 
    map.flyTo({ center: start as LngLatLike, zoom: 15.2, pitch: 60, bearing: -18, duration: 600 });
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

    bars.forEach(bar => {
      if (!Number.isFinite(bar.lng) || !Number.isFinite(bar.lat)) {
        console.warn("[Markers] Coordonnées invalides :", bar);
        return;
      }

    const marker = new mapboxgl.Marker({ color: '#22C55E' })
      .setLngLat([bar.lng, bar.lat])
      .addTo(mapRef.current);

    const el = marker.getElement();
    el.style.cursor = 'pointer';
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      openBarPopup(bar); // même comportement que la recherche
    });


      markerMap.current[bar.bar_id] = { marker };
      console.log(`[Markers] Créé → ${bar.bar_id} (${bar.lng}, ${bar.lat})`);
    });

    console.log("[Markers] Création terminée, total =", Object.keys(markerMap.current).length);
  }, [mapReady, bars]);


  // Mise à jour des couleurs
  useEffect(() => {
    console.log("[Markers] Mise à jour couleurs…", { suggestionsCount: suggestions.length, selected });

    const highlighted = new Set(suggestions.map(s => s.bar_id));

    Object.entries(markerMap.current).forEach(([id, { marker }]: any) => {
      let color = '#22C55E';
      if (selected?.bar_id === id) color = '#EF4444';
      else if (highlighted.has(id)) color = '#FFD700';

      // Version avec setColor si dispo
      if (typeof (marker as any).setColor === 'function') {
        (marker as any).setColor(color);
        console.log(`[Markers] setColor() appliqué sur ${id} → ${color}`);
      } else {
        // Fallback DOM pour versions Mapbox sans setColor
        const el = marker.getElement();
        const path = el?.querySelector('svg path');
        if (path) {
          path.setAttribute('fill', color);
          //console.log(`[Markers] Fallback DOM appliqué sur ${id} → ${color}`);
        } else {
          console.warn(`[Markers] Impossible de changer la couleur pour ${id}`);
        }
      }
    });
  }, [suggestions, selected]);




    // 6) Search debounce (avec logs)
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        log("Search debounce:", { type: searchType, term: searchTerm });
        if (!searchTerm.trim()) { setSuggestions([]); return; }
        const qs = `${searchType}=${encodeURIComponent(searchTerm)}`;
        const res = await fetch(`${API}/public/bars/search?${qs}`);
        const data = await res.json();
        log("Search results:", data?.results?.length || 0);
        setSuggestions(data?.results ?? []);
      } catch (e) {
        err("Search error", e);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm, searchType]);



  function openBarPopup(bar: Bar) {
    const map = mapRef.current;
    if (!map) return;

    const offsetY = -Math.round(window.innerHeight / 4); // décalage vers le haut

    const existing = popupMap.current[bar.bar_id];
    if (existing) {
      existing.addTo(map);
    } else {
      const container = document.createElement('div');
      container.style.cssText = 'min-width:240px;max-width:280px;color:#fff';

      const desc = (bar.description_fr || bar.description || '').toString();
      const musics = parseList(bar.music_fr).length ? parseList(bar.music_fr) : parseList(bar.music);
      const tags = parseList(bar.tags_fr).length ? parseList(bar.tags_fr) : parseList(bar.tags);

      container.innerHTML = `
        <div class="kpsule-pop-title">${bar.name || 'Bar'}</div>
        ${desc ? `<div class="kpsule-pop-desc">${desc}</div>` : ''}
        ${musics.length ? `<div class="kpsule-pop-row"><span>🎶</span><div class="scroll-chips">${musics.map(m=>`<span class="kpsule-chip">${m}</span>`).join('')}</div></div>` : ''}
        ${tags.length ? `<div class="kpsule-pop-row"><span>🏷️</span><div class="scroll-chips">${tags.map(t=>`<span class="kpsule-chip">${t}</span>`).join('')}</div></div>` : ''}
        ${bar.price ? `<div class="kpsule-pop-row">💰 ${bar.price}</div>` : ''}
        ${bar.url ? `<a data-action="site" class="kpsule-link site" href="javascript:void(0)">Voir le site</a>` : ''}
        <a data-action="items" class="kpsule-link items" href="javascript:void(0)">Voir les items</a>
        <a data-action="playlist" class="kpsule-link playlist" href="javascript:void(0)">Voir les musiques</a>
      `;

      container.addEventListener('click', (e: any) => {
        const action = e?.target?.getAttribute?.('data-action');
        if (!action) return;
        if (action === 'site' && bar.url) window.open(bar.url, '_blank');
        if (action === 'items') openItemsModal(bar.bar_id);
        if (action === 'playlist') openPlaylistModal(bar.bar_id);
      });

      const popup = new mapboxgl.Popup({ offset: 16, closeButton: true, className: 'kpsule-popup' })
        .setDOMContent(container)
        .setLngLat([bar.lng, bar.lat])
        .addTo(map);

      popupMap.current[bar.bar_id] = popup;
    }

    // 👉 FlyTo toujours avec offset
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
        <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: 0.2 }}>Find Your Next Spot</div>
        <div
          style={{
            width: 160,
            height: 3,
            margin: '10px auto',
            borderRadius: 6,
            background: 'linear-gradient(90deg,#60A5FA,#22D3EE)',
          }}
        />
      </div>

      {/* Barre de recherche flottante */}
      <div
        style={{
          position: 'absolute',
          top: 64,
          left: 16,
          right: 16,
          margin: '0 auto',
          maxWidth: 780,
          display: 'flex',
          gap: 8,
          zIndex: 10,
        }}
      >
        <select
          value={searchType}
          onChange={(e) => setSearchType(e.target.value as 'item' | 'music')}
          style={{
            padding: '10px 12px',
            borderRadius: 12,
            background: 'rgba(13,18,36,.7)',
            border: '1px solid #22304a',
            color: '#fff',
            backdropFilter: 'blur(8px)',
          }}
        >
          <option value="item">Item</option>
          <option value="music">Musique</option>
        </select>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`Rechercher un ${searchType === 'item' ? 'item' : 'titre/artiste'}...`}
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
          {suggestions.length > 0 && (
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
              }}
            >
              {suggestions.map((s, i) => {
                const barName = bars.find((b) => b.bar_id === s.bar_id)?.name || s.bar_id;
                return (
                  <div
                    key={i}
                    onClick={() => jumpToResult(s)}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      color: '#fff',
                      borderBottom: '1px solid #162039',
                    }}
                    onMouseEnter={(e) => ((e.currentTarget.style.background = '#11182b'))}
                    onMouseLeave={(e) => ((e.currentTarget.style.background = 'transparent'))}
                  >
                    {s.match_term} – {barName}
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
          alignItems: 'center',
          gap: 18,
          padding: '14px 18px',
          color: '#fff',
          borderRadius: 18,
          background: 'linear-gradient(180deg, rgba(12,16,30,.85), rgba(10,14,26,.85))',
          border: '1px solid #1e2a44',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 10px 28px rgba(0,0,0,.45)',
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 900 }}>{durationText}</div>
        <div style={{ opacity: 0.9 }}>{distanceText}</div>
        <div style={{ opacity: 0.9 }}>Arrival: {etaText}</div>
        <div style={{ marginLeft: 'auto', opacity: 0.6, cursor: 'pointer' }}>✕</div>
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
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>Items disponibles</h2>
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
          </div>
        </div>
      )}

      {/* Modal Playlist */}
      {showPlaylistModal && (
        <div
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
              onClick={() => setShowPlaylistModal(false)}
              style={{ position: 'absolute', top: 8, right: 16, color: '#374151', fontSize: 20 }}
            >
              ✕
            </button>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>Playlist du bar</h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))',
                gap: 12,
              }}
            >
              {playlistModal.map((track: any) => (
                <div key={track.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 8 }}>
                  {track.image_url && (
                    <img
                      src={track.image_url}
                      alt={track.track_name}
                      style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }}
                    />
                  )}
                  <div style={{ fontWeight: 700 }}>{track.track_name}</div>
                  <div style={{ fontSize: 14, color: '#374151' }}>
                    {track.artist_name} – {track.album_name}
                  </div>
                  <div style={{ marginTop: 6, color: '#2563eb' }}>Votes : {track.votes}</div>
                  {track.spotify_url && (
                    <a href={track.spotify_url} target="_blank" rel="noopener noreferrer" style={{ color: '#16a34a' }}>
                      Écouter sur Spotify
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
