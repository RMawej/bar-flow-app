"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

// ---------------------------------------------
// Components/UpcomingEvents.tsx
// Lightweight UI inspired by your page (glass + gradients)
// Fetches Ticketmaster Discovery API and renders upcoming events
// ---------------------------------------------

export type TMEvent = {
  id: string;
  name: string;
  url: string;
  localDate?: string;
  localTime?: string;
  dateTime?: string; // UTC
  venue?: { id?: string; name?: string; city?: string; address?: string };
  distanceMiles?: number;
  image?: string;
  segment?: string; // Musique, Sports, Théâtre, etc.
};

export type UpcomingEventsProps = {
  // If not provided, read from NEXT_PUBLIC_TICKETMASTER_KEY
  apikey?: string;
  lat?: number; // default: Montréal centre
  lng?: number;
  radius?: number; // miles (TM expects miles) – we convert km if you pass < 50 and looks like km
  locale?: string; // e.g. 'fr-ca'
  days?: number; // horizon from now, default 30
  segmentId?: string; // e.g. Musique: KZFzniwnSyZfZ7v7nJ
  keyword?: string; // optional user filter
  open?: boolean; // controlled modal
  onClose?: () => void;
};

const DEFAULT_SEGMENTS: Record<string, string> = {
  // segmentId → label (fr)
  KZFzniwnSyZfZ7v7nJ: "Musique",
  KZFzniwnSyZfZ7v7nE: "Sports",
  KZFzniwnSyZfZ7v7na: "Arts & Théâtre",
};

function iso(date: Date) {
  // YYYY-MM-DDTHH:mm:ssZ
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");
}

function pickImage(images?: { url: string; width: number; ratio?: string }[]): string | undefined {
  if (!images || !Array.isArray(images)) return undefined;
  // Prefer 16:9 >= 1024
  const sixteenNine = images
    .filter((i: any) => (i.ratio === "16_9" || !i.ratio) && Number(i.width) >= 1024)
    .sort((a: any, b: any) => Number(b.width) - Number(a.width));
  if (sixteenNine[0]) return sixteenNine[0].url;
  // fallback largest
  return images.slice().sort((a: any, b: any) => Number(b.width) - Number(a.width))[0]?.url;
}

function kmToMiles(km: number) { return km * 0.621371; }

export default function UpcomingEvents({
  apikey,
  lat = 45.5017,
  lng = -73.5673,
  radius = 10, // miles
  locale = "fr-ca",
  days = 30,
  segmentId,
  keyword,
  open = false,
  onClose,
}: UpcomingEventsProps) {
    const apiKey =
    apikey ||
    ((import.meta as any).env?.VITE_TICKETMASTER_KEY as string) ||
    "";
  const [query, setQuery] = useState(keyword || "");
  const [seg, setSeg] = useState<string | undefined>(segmentId);
  const [daysRange, setDaysRange] = useState(days);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<TMEvent[]>([]);

  const start = useMemo(() => new Date(), []);
  const end = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + daysRange);
    return d;
  }, [daysRange]);

  const radiusMiles = useMemo(() => {
    // If radius looks like km (< 50), convert to miles; else assume given miles
    return radius < 50 ? kmToMiles(radius) : radius;
  }, [radius]);

  useEffect(() => {
    if (!open) return; // fetch only when panel opened
    if (!apiKey) { setError("Aucune clé Ticketmaster trouvée"); return; }

    const ctrl = new AbortController();
    (async () => {
      try {
        setLoading(true); setError(null);
        const params = new URLSearchParams({
          apikey: apiKey,
          latlong: `${lat},${lng}`,
          radius: String(Math.max(1, Math.round(radiusMiles))),
          locale,
          sort: "date,asc",
          size: "100",
          startDateTime: iso(start),
          endDateTime: iso(end),
        });
        if (seg) params.set("segmentId", seg);
        if (query.trim()) params.set("keyword", query.trim());

        const url = `https://app.ticketmaster.com/discovery/v2/events.json?${params.toString()}`;
        console.groupCollapsed("[TM] Fetch events");
        console.log("→ URL", url);

        const res = await fetch(url, { signal: ctrl.signal });
        console.log("← Status", res.status, res.statusText);
        console.log("Headers X-RateLimit:",
          res.headers.get("X-RateLimit-Limit"),
          res.headers.get("X-RateLimit-Remaining"),
          res.headers.get("X-RateLimit-Reset")
        );
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

        const j = await res.json();
        const raw = j?._embedded?.events || [];
        console.log("Raw count (_embedded.events.length):", raw.length);
        console.log("Page info:", j?.page);

        const list: TMEvent[] = raw.map((e: any) => ({
          id: e.id,
          name: e.name,
          url: e.url,
          localDate: e.dates?.start?.localDate,
          localTime: e.dates?.start?.localTime,
          dateTime: e.dates?.start?.dateTime,
          venue: {
            id: e._embedded?.venues?.[0]?.id,
            name: e._embedded?.venues?.[0]?.name,
            city: e._embedded?.venues?.[0]?.city?.name,
            address: e._embedded?.venues?.[0]?.address?.line1,
          },
          distanceMiles: e.distance,
          image: pickImage(e.images),
          segment: e.classifications?.[0]?.segment?.name,
        })).filter(ev => !!ev.url);

        console.log("Mapped count (with url):", list.length);
        console.table(list.slice(0, 3).map(ev => ({
          id: ev.id,
          name: ev.name,
          date: `${ev.localDate ?? ""} ${ev.localTime ?? ""}`.trim(),
          venue: `${ev.venue?.name ?? ""} · ${ev.venue?.city ?? ""}`.trim(),
          segment: ev.segment ?? "",
        })));
        console.groupEnd();

        console.log("Fetched events:", list);
        // Deduplicate by id and keep earliest date
        const uniq = new Map<string, TMEvent>();
        list.forEach((ev) => {
          if (!uniq.has(ev.id)) uniq.set(ev.id, ev);
        });

        const arr = Array.from(uniq.values());

        // 🔵 NEW: récupérer les infos détaillées de la venue du 1er event
        try {
          const firstVenueId = arr[0]?.venue?.id;
          if (firstVenueId) {
            const vurl = `https://app.ticketmaster.com/discovery/v2/venues/${firstVenueId}.json?apikey=${apiKey}`;
            console.groupCollapsed("[TM] Fetch first venue");
            console.log("→ URL", vurl);
            const vres = await fetch(vurl, { signal: ctrl.signal });
            console.log("← Status", vres.status, vres.statusText);
            if (vres.ok) {
              const v = await vres.json();
              console.table([{
                id: v.id,
                name: v.name,
                address: v.address?.line1 ?? "",
                city: v.city?.name ?? "",
                state: v.state?.name ?? v.state?.stateCode ?? "",
                country: v.country?.name ?? v.country?.countryCode ?? "",
                postalCode: v.postalCode ?? "",
                timezone: v.timezone ?? "",
                lat: v.location?.latitude ?? "",
                lng: v.location?.longitude ?? "",
                upcoming: v.upcomingEvents?._total ?? ""
              }]);
            } else {
              console.warn("Venue fetch failed");
            }
            console.groupEnd();
          }
        } catch (e) {
          console.warn("Venue fetch error:", (e as any)?.message);
        }

        setEvents(arr);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setError(err?.message || "Échec au chargement");
      } finally {
        setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [apiKey, lat, lng, radiusMiles, locale, seg, query, start, end, open]);

  // ---- UI ----
  if (!open) return null;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.55)" }} />

      {/* Panel
      <div style={{
        position: "relative",
        width: "min(1100px, 96vw)",
        height: "min(86vh, 900px)",
        background: "linear-gradient(180deg, rgba(12,16,30,.92), rgba(10,14,26,.92))",
        border: "1px solid #1e2a44",
        borderRadius: 18,
        boxShadow: "0 18px 60px rgba(0,0,0,.55)",
        color: "#fff",
        overflow: "hidden",
        backdropFilter: "blur(10px)",
      }}> */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(180deg, rgba(12,16,30,.95), rgba(10,14,26,.95))",
        color: "#fff",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}>

        {/* Header */}
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #1e2a44" }}>
          <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 0.2 }}>Événements à venir</div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} title="Fermer" style={{ background: "transparent", border: "1px solid #22304a", color: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}>✕</button>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 10, padding: 12, alignItems: "center", borderBottom: "1px solid #1e2a44" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {Object.entries(DEFAULT_SEGMENTS).map(([id, label]) => (
              <button key={id}
                onClick={() => setSeg((s) => (s === id ? undefined : id))}
                style={{
                  padding: "8px 10px",
                  borderRadius: 999,
                  border: "1px solid #22304a",
                  background: seg === id ? "linear-gradient(90deg,#60A5FA,#22D3EE)" : "rgba(13,18,36,.6)",
                  color: seg === id ? "#0b0f1d" : "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}>
                {label}
              </button>
            ))}
          </div>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer par mot-clé (ex: jazz)"
            style={{ flex: 1, padding: "10px 12px", borderRadius: 12, background: "rgba(13,18,36,.7)", border: "1px solid #22304a", color: "#fff", outline: "none" }}
          />

          <select value={daysRange} onChange={(e) => setDaysRange(Number(e.target.value))}
            style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(13,18,36,.7)", border: "1px solid #22304a", color: "#fff" }}>
            <option value={7}>7 jours</option>
            <option value={14}>14 jours</option>
            <option value={30}>30 jours</option>
            <option value={60}>60 jours</option>
          </select>
        </div>

        {/* Body */}
        <div style={{
          position: "relative",
          width: "min(1100px, 96vw)",
          height: "min(86vh, 900px)",
          background: "linear-gradient(180deg, rgba(12,16,30,.92), rgba(10,14,26,.92))",
          border: "1px solid #1e2a44",
          borderRadius: 18,
          boxShadow: "0 18px 60px rgba(0,0,0,.55)",
          color: "#fff",
          overflow: "hidden",
          backdropFilter: "blur(10px)",
          display: "flex",
          flexDirection: "column",
        }}>
        <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
        {loading && (
            <div style={{ display: "grid", placeItems: "center", height: "100%", opacity: .9 }}>Chargement…</div>
          )}
          {error && !loading && (
            <div style={{ display: "grid", placeItems: "center", height: "100%", color: "#FCA5A5", textAlign: "center" }}>
              <div style={{ fontSize: 38, marginBottom: 8 }}>⚠️</div>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Erreur</div>
              <div style={{ opacity: .9 }}>{error}</div>
            </div>
          )}

          {!loading && !error && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
              {events.map((ev) => (
                <a key={ev.id} href={ev.url} target="_blank" rel="noreferrer"
                   style={{
                     display: "flex", flexDirection: "column", gap: 8,
                     background: "rgba(13,18,36,.6)", border: "1px solid #22304a",
                     borderRadius: 14, overflow: "hidden", textDecoration: "none", color: "#fff",
                     boxShadow: "0 8px 22px rgba(0,0,0,.35)",
                   }}>
                  {ev.image && (
                    <img src={ev.image} alt={ev.name} style={{ width: "100%", height: 150, objectFit: "cover" }} />
                  )}
                  <div style={{ padding: "10px 12px" }}>
                    <div style={{ fontSize: 14, opacity: .85, marginBottom: 4 }}>
                      {ev.localDate} {ev.localTime ? `· ${ev.localTime}` : ""}
                    </div>
                    <div style={{ fontWeight: 900, lineHeight: 1.15, marginBottom: 6 }}>{ev.name}</div>
                    <div style={{ fontSize: 13, opacity: .9 }}>
                      {ev.venue?.name}{ev.venue?.city ? ` · ${ev.venue.city}` : ""}
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
                      {ev.segment && (
                        <span style={{ fontSize: 12, padding: "2px 8px", border: "1px solid #22304a", borderRadius: 999 }}>{ev.segment}</span>
                      )}
                      {/* Empty state {typeof ev.distanceMiles === "number" && (
                        <span style={{ fontSize: 12, opacity: .85 }}>{Math.round(ev.distanceMiles)} mi</span>
                      )} */}
                    </div>
                  </div>
                </a>
              ))}

              {/* Empty state */}
              {events.length === 0 && (
                <div style={{ gridColumn: "1 / -1", display: "grid", placeItems: "center", height: 280, opacity: .9 }}>
                  Aucun événement trouvé.
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------
// Quick integration helper (optional):
// A small button to open the modal from any page (1 click)
// ---------------------------------------------

export function EventsFloatingButton({ label = "Événements" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed", right: 18, top: 18, zIndex: 50,
          padding: "10px 14px", borderRadius: 12,
          background: "linear-gradient(90deg,#60A5FA,#22D3EE)",
          color: "#0b0f1d", fontWeight: 900, border: "1px solid #1e2a44",
          boxShadow: "0 10px 26px rgba(0,0,0,.35)", cursor: "pointer",
        }}
      >{label}</button>
      <UpcomingEvents open={open} onClose={() => setOpen(false)} />
    </>
  );
}