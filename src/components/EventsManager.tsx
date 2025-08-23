"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/store/authStore";
import { CalendarDays, Pencil, Plus, Trash2 } from "lucide-react";
import TicketsManager from "@/components/TicketsManager";

export type ApiEvent = {
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

type EventForm = Omit<ApiEvent, "id" | "local_time"> & {
  id?: string;
  local_time?: string;   // pour <input type="time"> -> "HH:mm"
  venue_id?: string;     // préservé au PUT si présent
};

function toBool(n?: number) { return n === 1; }
function toNum(b: boolean) { return b ? 1 : 0; }
function toTimeInput(t?: string | number) {
  return typeof t === "number"
    ? new Date(t * 1000).toISOString().slice(11, 16)
    : t ? String(t).slice(0, 5) : "";
}

export default function EventsManager() {
  const { barId, userId } = useAuthStore();

  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<string>("");

  const [editing, setEditing] = useState<EventForm | null>(null);
  const [showForm, setShowForm] = useState(false);

  const baseUrl = useMemo(() => `https://kpsule.app/api/bars/${barId}/events`, [barId]);

  // Pré-charge filtres depuis l'URL
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setQuery(sp.get("q") || "");
    setSegmentFilter(sp.get("segment") || "");
  }, []);

  // Pousse filtres dans l'URL
  useEffect(() => {
    const url = new URL(window.location.href);
    if (query) url.searchParams.set("q", query); else url.searchParams.delete("q");
    if (segmentFilter) url.searchParams.set("segment", segmentFilter); else url.searchParams.delete("segment");
    window.history.replaceState({}, "", url);
  }, [query, segmentFilter]);

  async function fetchEvents() {
    if (!barId || !userId) return;
    setLoading(true);
    try {
      const url = new URL(baseUrl);
      if (query) url.searchParams.set("q", query);
      if (segmentFilter) url.searchParams.set("segment", segmentFilter);
      const res = await fetch(url.toString(), { headers: { "x-user-id": userId } });
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : (data.events ?? []));
    } catch (e) {
      console.error("Fetch events error:", e);
    } finally {
      setLoading(false);
    }
  }

  // Refetch débouncé
  useEffect(() => {
    const t = setTimeout(() => { fetchEvents(); }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, query, segmentFilter, barId, userId]);

  function resetForm() {
    setEditing(null);
    setShowForm(false);
  }

  function openCreate() {
    setEditing({
      name: "",
      url: "",
      image_url: "",
      segment: "",
      datetime_utc: "",
      local_date: "",
      local_time: "",
      venue_name: "",
      venue_city: "",
      is_free: 0,
    });
    setShowForm(true);
  }

  function openEdit(ev: ApiEvent) {
    const anyEv = ev as any;
    setEditing({
      ...ev,
      venue_id: anyEv?.venue_id,
      local_time: toTimeInput(ev.local_time),
    });
    setShowForm(true);
  }

    async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !editing.name?.trim()) return;

    setSaving(true);
    try {
        const isUpdate = Boolean(editing.id);
        const url = isUpdate
        ? `${baseUrl}/${editing.id}/upload`
        : `${baseUrl}/upload`;
        const method = isUpdate ? "PUT" : "POST";

        const formData = new FormData();
        formData.append("name", editing.name.trim());
        formData.append("url", editing.url || "");
        formData.append("segment", editing.segment || "");
        formData.append("datetime_utc", editing.datetime_utc || "");
        formData.append("local_date", editing.local_date || "");
        formData.append("local_time", editing.local_time || "");
        formData.append("venue_name", editing.venue_name || "");
        formData.append("venue_city", editing.venue_city || "");
        formData.append("is_free", String(toNum(toBool(editing.is_free))));
        if (editing.venue_id) formData.append("venue_id", editing.venue_id);

        if ((editing as any).file) {
        // le champ attendu côté FastAPI est `file`
        formData.append("file", (editing as any).file);
        }

        const res = await fetch(url, {
        method,
        headers: { "x-user-id": userId },
        body: formData,
        });

        if (!res.ok) throw new Error(res.statusText);

        await fetchEvents();
        resetForm();
    } catch (err) {
        console.error("Save event error:", err);
    } finally {
        setSaving(false);
    }
    }

  async function removeEvent(id: string) {
    if (!confirm("Supprimer cet événement ?")) return;
    try {
      const res = await fetch(`${baseUrl}/${id}`, {
        method: "DELETE",
        headers: { "x-user-id": userId },
      });
      if (!res.ok) throw new Error(res.statusText);
      setEvents(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      console.error("Delete event error:", err);
    }
  }

  // Filtrage client (sécurité si le back ignore q/segment)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter(ev => {
      const okQ = !q || [ev.name, ev.venue_name, ev.venue_city, ev.segment]
        .some(v => (v ?? "").toLowerCase().includes(q));
      const okS = !segmentFilter || ev.segment === segmentFilter;
      return okQ && okS;
    });
  }, [events, query, segmentFilter]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            <CardTitle>Événements</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e)=>{ if(e.key==='Enter') fetchEvents(); }}
              placeholder="Rechercher…"
              className="px-3 py-2 border rounded-md text-sm"
            />
            <select
              value={segmentFilter}
              onChange={(e) => setSegmentFilter(e.target.value)}
              className="px-3 py-2 border rounded-md text-sm"
            >
              <option value="">Tous segments</option>
              {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <Button variant="outline" onClick={fetchEvents} disabled={loading}>
              Rafraîchir
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Nouvel événement
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left border-b">
                <tr>
                  <th className="py-2 pr-3">Nom</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Heure</th>
                  <th className="py-2 pr-3">Lieu</th>
                  <th className="py-2 pr-3">Segment</th>
                  <th className="py-2 pr-3">Gratuit</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(ev => (
                  <tr key={ev.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{ev.name}</div>
                      {ev.url ? (
                        <a href={ev.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">
                          Lien
                        </a>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3">{ev.local_date || "—"}</td>
                    <td className="py-2 pr-3">
                      {typeof ev.local_time === "number"
                        ? new Date(ev.local_time * 1000).toISOString().slice(11,16)
                        : (ev.local_time || "—")}
                    </td>
                    <td className="py-2 pr-3">
                      {ev.venue_name || "—"}
                      {ev.venue_city ? <span className="text-xs text-gray-500"> — {ev.venue_city}</span> : null}
                    </td>
                    <td className="py-2 pr-3">{ev.segment || "—"}</td>
                    <td className="py-2 pr-3">{toBool(ev.is_free) ? "Oui" : "Non"}</td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(ev)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => removeEvent(ev.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filtered.length && !loading && (
                  <tr><td className="py-6 text-center text-gray-500" colSpan={7}>Aucun événement</td></tr>
                )}
                {loading && (
                  <tr><td className="py-6 text-center text-gray-500" colSpan={7}>Chargement…</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editing?.id ? "Modifier l’événement" : "Créer un événement"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitForm} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Nom *</label>
                <input
                  required
                  value={editing?.name ?? ""}
                  onChange={e => setEditing(v => v ? { ...v, name: e.target.value } : v)}
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="Nom de l’événement"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Segment</label>
                <select
                  value={editing?.segment ?? ""}
                  onChange={e => setEditing(v => v ? { ...v, segment: e.target.value } : v)}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="">—</option>
                  {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Date (local)</label>
                <input
                  type="date"
                  value={(editing?.local_date as string) ?? ""}
                  onChange={e => setEditing(v => v ? { ...v, local_date: e.target.value } : v)}
                  className="w-full border rounded-md px-3 py-2"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Heure (local)</label>
                <input
                  type="time"
                  value={editing?.local_time ?? ""}
                  onChange={e => setEditing(v => v ? { ...v, local_time: e.target.value } : v)}
                  className="w-full border rounded-md px-3 py-2"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Nom du lieu</label>
                <input
                  value={editing?.venue_name ?? ""}
                  onChange={e => setEditing(v => v ? { ...v, venue_name: e.target.value } : v)}
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="Ex: MTelus"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Ville</label>
                <input
                  value={editing?.venue_city ?? ""}
                  onChange={e => setEditing(v => v ? { ...v, venue_city: e.target.value } : v)}
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="Montréal"
                />
              </div>

                <div className="space-y-1">
                    <label className="text-sm font-medium">Image</label>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                            setEditing(v => v ? { ...v, file } : v);
                        }
                        }}
                        className="w-full border rounded-md px-3 py-2"
                    />
                </div>


              <div className="space-y-1">
                <label className="text-sm font-medium">Lien</label>
                <input
                  value={editing?.url ?? ""}
                  onChange={e => setEditing(v => v ? { ...v, url: e.target.value } : v)}
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="https://..."
                />
              </div>

              <div className="col-span-1 md:col-span-2 flex items-center gap-3 pt-2">
                {/* <label className="text-sm font-medium">Gratuit ?</label>
                <input
                  type="checkbox"
                  checked={toBool(editing?.is_free)}
                  onChange={e => setEditing(v => v ? { ...v, is_free: toNum(e.target.checked) } : v)}
                /> */}
                <div className="ml-auto flex gap-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {editing?.id ? "Enregistrer" : "Créer"}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    {editing?.id && (
    <div className="mt-6">
        <TicketsManager eventId={editing.id} />
    </div>
    )}

    </div>
  );
}

