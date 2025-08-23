"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";

type ApiEvent = {
  id: string;
  name: string;
  url?: string;
  image_url?: string;
  segment?: string;
  datetime_utc?: string;
  local_date?: string;
  local_time?: string | number;
  venue_name?: string;
  venue_city?: string;
  is_free?: number;
};

const SEGMENTS = ["Musique", "Sports", "Arts & Théâtre"] as const;

function formatTime(t?: string | number) {
  if (!t && t !== 0) return "";
  if (typeof t === "number") {
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  return t;
}

type Props = { open?: boolean; onClose?: () => void };

export default function UpcomingEvents({ open = false, onClose }: Props) {
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ Segment sélectionné
  const [segmentSelected, setSegmentSelected] = useState<string>("");

  // Filtrage client-side
  const visibleEvents = useMemo(() => {
    return segmentSelected
      ? events.filter((e) => e.segment === segmentSelected)
      : events;
  }, [events, segmentSelected]);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const base = "https://kpsule.app/api/public/events";
        const res = await fetch(base, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const j = await res.json();
        setEvents(j?.events ?? []);
        console.log(j);
      } catch (e: any) {
        if (e?.name !== "AbortError")
          setError(e?.message ?? "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.55)" }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(12,16,30,.95), rgba(10,14,26,.95))",
          color: "#fff",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* header */}
        <div
          style={{
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            borderBottom: "1px solid #1e2a44",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900 }}>
            Événements à venir
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid #22304a",
              color: "#fff",
              borderRadius: 10,
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {/* ✅ Segments */}
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: 12,
            alignItems: "center",
            borderBottom: "1px solid #1e2a44",
            flexWrap: "wrap",
          }}
        >
          {SEGMENTS.map((s) => {
            const active = segmentSelected === s;
            return (
              <button
                key={s}
                onClick={() => setSegmentSelected(active ? "" : s)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: active
                    ? "linear-gradient(90deg,#60A5FA,#22D3EE)"
                    : "rgba(13,18,36,.7)",
                  color: active ? "#0b0f1d" : "#fff",
                  border: active ? "1px solid transparent" : "1px solid #22304a",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {s}
              </button>
            );
          })}
        </div>

        {/* body */}
        <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
          {loading && (
            <div
              style={{
                display: "grid",
                placeItems: "center",
                height: 220,
                opacity: 0.9,
              }}
            >
              Chargement…
            </div>
          )}
          {error && !loading && (
            <div
              style={{
                display: "grid",
                placeItems: "center",
                height: 220,
                color: "#FCA5A5",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 38, marginBottom: 8 }}>⚠️</div>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Erreur</div>
              <div style={{ opacity: 0.9 }}>{error}</div>
            </div>
          )}

          {!loading && !error && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 12,
              }}
            >
            {visibleEvents.map((ev) => {
              const isInternal = (ev as any).source_type === "internal"; // 👈 distinction

              return (
                
                <a
                  key={ev.id}
                  href={ev.url || "#"}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    background: isInternal
                      ? "linear-gradient(135deg,#ff0080,#7928ca)" // flashy
                      : "rgba(13,18,36,.6)",
                    border: isInternal ? "2px solid #ff66cc" : "1px solid #22304a",
                    borderRadius: 14,
                    overflow: "hidden",
                    textDecoration: "none",
                    color: "#fff",
                    boxShadow: isInternal
                      ? "0 0 20px rgba(255,0,128,.6)"
                      : "0 8px 22px rgba(0,0,0,.35)",
                    transform: isInternal ? "scale(1.02)" : "none",
                    transition: "all .25s ease",
                  }}
                >
                    {isInternal && (<div
                    style={{
                      position: "absolute",
                      top: 35,
                      right: -40,
                      transform: "rotate(45deg)",
                      background: "linear-gradient(90deg,#ff0080,#7928ca)",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 900,
                      padding: "4px 50px",
                      boxShadow: "0 0 12px rgba(0,0,0,.4)",
                      textTransform: "uppercase",
                    }}
                  >
                    Exclusivité Assa
                  </div>)}
                  {ev.image_url && (
                    <img
                      src={ev.image_url}
                      alt={ev.name}
                      style={{
                        width: "100%",
                        height: 150,
                        objectFit: "cover",
                        borderBottom: isInternal ? "2px solid #ff66cc" : "none",
                      }}
                    />
                  )}
                  <div style={{ padding: "10px 12px" }}>
                    <div style={{ fontSize: 14, opacity: 0.85 }}>
                      {ev.local_date} {formatTime(ev.local_time)}
                    </div>
                    <div
                      style={{
                        fontWeight: 900,
                        lineHeight: 1.15,
                        margin: "6px 0",
                        fontSize: isInternal ? 18 : 16,
                        textShadow: isInternal ? "0 0 8px rgba(255,0,128,.8)" : "none",
                      }}
                    >
                      {ev.name}
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.9 }}>
                      {ev.venue_name}
                      {ev.venue_city ? ` · ${ev.venue_city}` : ""}
                    </div>
                    {ev.segment && (
                      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                        <span
                          style={{
                            fontSize: 12,
                            padding: "2px 8px",
                            border: isInternal ? "1px solid #ff66cc" : "1px solid #22304a",
                            borderRadius: 999,
                            background: isInternal
                              ? "rgba(255,0,128,.15)"
                              : "transparent",
                          }}
                        >
                          {ev.segment}
                        </span>
                      </div>
                    )}
                  </div>
                </a>
              );
            })}


              {visibleEvents.length === 0 && (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    display: "grid",
                    placeItems: "center",
                    height: 280,
                    opacity: 0.9,
                  }}
                >
                  Aucun événement trouvé.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// bouton flottant inchangé
export function EventsFloatingButton({ label = "Événements" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          right: 18,
          top: 18,
          zIndex: 50,
          padding: "10px 14px",
          borderRadius: 12,
          background: "linear-gradient(90deg,#60A5FA,#22D3EE)",
          color: "#0b0f1d",
          fontWeight: 900,
          border: "1px solid #1e2a44",
          boxShadow: "0 10px 26px rgba(0,0,0,.35)",
          cursor: "pointer",
        }}
      >
        {label}
      </button>
      <UpcomingEvents open={open} onClose={() => setOpen(false)} />
    </>
  );
}
