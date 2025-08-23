"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/store/authStore";
import { Plus, Pencil, Trash2, TicketPercent } from "lucide-react";

type Ticket = {
  id: string;
  event_id: string;
  name: string;
  base_price: number;
  is_free?: 0 | 1;                // virtual
  currency: string;               // 'CAD' by default
  max_per_order: number;
  inventory?: number | null;
  source_type?: "internal" | "api";
  source_provider?: string | null;
  external_ticket_id?: string | null;
  checkout_mode: "stripe" | "external_url";
  stripe_price_id?: string | null;
  external_checkout_url?: string | null;
};

type TicketForm = Omit<Ticket, "id" | "event_id" | "is_free"> & { id?: string };

const CURRENCIES = ["CAD", "USD", "EUR"] as const;

export default function TicketsManager({ eventId }: { eventId: string }) {
  const { barId, userId } = useAuthStore();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<TicketForm | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (eventId) {
        console.log("Event ID:", eventId);
    }
    }, [eventId]);

  const baseUrl = useMemo(
    () => `https://kpsule.app/api/bars/${barId}/events/${eventId}/tickets`,
    [barId, eventId]
  );

  async function fetchTickets() {
    if (!barId || !eventId || !userId) return;
    setLoading(true);
    try {
      const res = await fetch(baseUrl, { headers: { "x-user-id": userId } });
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      setTickets(Array.isArray(data) ? data : (data.tickets ?? []));
    } catch (e) {
      console.error("Fetch tickets error:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchTickets(); /* initial */ }, [baseUrl]);

  function openCreate() {
    setEditing({
      name: "",
      base_price: 0, // FREE_MODE: toujours 0
      currency: "CAD",
      max_per_order: 10,
      inventory: null,
      source_type: "internal",
      source_provider: null,
      external_ticket_id: null,
      checkout_mode: "external_url", // FREE_MODE: neutralisé
      stripe_price_id: null,         // FREE_MODE
      external_checkout_url: null,   // FREE_MODE
    });
    setShowForm(true);
  }

  function openEdit(t: Ticket) {
    setEditing({
      id: t.id,
      name: t.name,
      base_price: 0,                 // FREE_MODE: forcer 0 en édition aussi
      currency: t.currency || "CAD",
      max_per_order: t.max_per_order ?? 10,
      inventory: t.inventory ?? null,
      source_type: t.source_type ?? "internal",
      source_provider: t.source_provider ?? null,
      external_ticket_id: t.external_ticket_id ?? null,
      checkout_mode: "external_url", // FREE_MODE
      stripe_price_id: null,         // FREE_MODE
      external_checkout_url: null,   // FREE_MODE
    });
    setShowForm(true);
  }

  function resetForm() {
    setEditing(null);
    setShowForm(false);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;

    setSaving(true);
    try {
      const isUpdate = Boolean(editing.id);
      const url = isUpdate ? `${baseUrl}/${editing.id}` : baseUrl;
      const method = isUpdate ? "PUT" : "POST";

      const payload: TicketForm = {
        ...editing,
        base_price: 0,                          // FREE_MODE: forcé à 0 dans le body
        max_per_order: Number(editing.max_per_order || 1),
        inventory:
          editing.inventory === null || editing.inventory === undefined
            ? null
            : Number(editing.inventory),
        checkout_mode: "external_url",          // FREE_MODE
        stripe_price_id: null,                  // FREE_MODE
        external_checkout_url: null,            // FREE_MODE
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(res.statusText);

      await fetchTickets();
      resetForm();
    } catch (err) {
      console.error("Save ticket error:", err);
    } finally {
      setSaving(false);
    }
  }

  async function removeTicket(id: string) {
    if (!confirm("Supprimer ce billet ?")) return;
    try {
      const res = await fetch(`${baseUrl}/${id}`, {
        method: "DELETE",
        headers: { "x-user-id": userId },
      });
      if (!res.ok) throw new Error(res.statusText);
      setTickets(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error("Delete ticket error:", err);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <TicketPercent className="h-5 w-5" />
            <CardTitle>
              Billets <span className="ml-2 text-xs px-2 py-1 rounded bg-green-100 text-green-700">Tous gratuits</span>
            </CardTitle>
          </div>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Nouveau billet</Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left border-b">
                <tr>
                  <th className="py-2 pr-3">Nom</th>
                  <th className="py-2 pr-3">Prix</th>
                  <th className="py-2 pr-3">Devise</th>
                  <th className="py-2 pr-3">Max/commande</th>
                  <th className="py-2 pr-3">Stock</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(t => {
                console.log("Ticket ID:", t.id); // <-- affichage console
                return (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">{t.name}</td>
                    <td className="py-2 pr-3">Gratuit{/* FREE_MODE: toujours gratuit */}</td>
                    <td className="py-2 pr-3">{t.currency}</td>
                    <td className="py-2 pr-3">{t.max_per_order}</td>
                    <td className="py-2 pr-3">{t.inventory ?? "∞"}</td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(t)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => removeTicket(t.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )})}
                {!tickets.length && !loading && (
                  <tr><td className="py-6 text-center text-gray-500" colSpan={6}>Aucun billet</td></tr>
                )}
                {loading && (
                  <tr><td className="py-6 text-center text-gray-500" colSpan={6}>Chargement…</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editing?.id ? "Modifier le billet" : "Créer un billet"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitForm} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium">Nom *</label>
                <input
                  required
                  value={editing?.name ?? ""}
                  onChange={e => setEditing(v => v ? { ...v, name: e.target.value } : v)}
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="Ex: Entrée gratuite"
                />
              </div>

              {/* FREE_MODE: champ prix masqué
              <div className="space-y-1">
                <label className="text-sm font-medium">Prix de base *</label>
                <input
                  required
                  type="number" step="0.01" min="0"
                  value={editing?.base_price ?? 0}
                  onChange={e => setEditing(v => v ? { ...v, base_price: Number(e.target.value) } : v)}
                  className="w-full border rounded-md px-3 py-2"
                />
              </div>
              */}

              <div className="space-y-1">
                <label className="text-sm font-medium">Devise</label>
                <select
                  value={editing?.currency ?? "CAD"}
                  onChange={e => setEditing(v => v ? { ...v, currency: e.target.value } : v)}
                  className="w-full border rounded-md px-3 py-2"
                >
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Max par commande</label>
                <input
                  type="number" min={1}
                  value={editing?.max_per_order ?? 10}
                  onChange={e => setEditing(v => v ? { ...v, max_per_order: Number(e.target.value) } : v)}
                  className="w-full border rounded-md px-3 py-2"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Stock (laisser vide = ∞)</label>
                <input
                  type="number" min={0}
                  value={editing?.inventory ?? ""}
                  onChange={e => setEditing(v => v ? { ...v, inventory: e.target.value === "" ? null : Number(e.target.value) } : v)}
                  className="w-full border rounded-md px-3 py-2"
                />
              </div>

              {/* FREE_MODE: paiement neutralisé
              <div className="space-y-1">
                <label className="text-sm font-medium">Mode de paiement</label>
                <select
                  value={editing?.checkout_mode ?? "stripe"}
                  onChange={e => setEditing(v => v ? { ...v, checkout_mode: e.target.value as "stripe"|"external_url" } : v)}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="stripe">Stripe</option>
                  <option value="external_url">Lien externe</option>
                </select>
              </div>

              {editing?.checkout_mode === "stripe" && (
                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium">Stripe price ID</label>
                  <input
                    value={editing?.stripe_price_id ?? ""}
                    onChange={e => setEditing(v => v ? { ...v, stripe_price_id: e.target.value } : v)}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder="price_..."
                  />
                </div>
              )}

              {editing?.checkout_mode === "external_url" && (
                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium">URL de paiement externe</label>
                  <input
                    value={editing?.external_checkout_url ?? ""}
                    onChange={e => setEditing(v => v ? { ...v, external_checkout_url: e.target.value } : v)}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder="https://..."
                  />
                </div>
              )}
              */}

              <div className="md:col-span-3 flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={resetForm}>Annuler</Button>
                <Button type="submit" disabled={saving}>{editing?.id ? "Enregistrer" : "Créer"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
