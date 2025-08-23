"use client";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TicketPercent } from "lucide-react";

type Ticket = {
  id: string;
  name: string;
  base_price: number;
  max_per_order: number;
  inventory?: number;
};

export default function PublicTickets() {
  const { eventId } = useParams<{ eventId: string }>();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  // couleurs de cartes pour alterner
  const COLORS = [
    "bg-orange-50 border-orange-200",
    "bg-blue-50 border-blue-200",
    "bg-green-50 border-green-200",
    "bg-purple-50 border-purple-200",
  ];

  useEffect(() => {
    if (!eventId) return;
    fetch(`https://kpsule.app/api/public/events/${eventId}/tickets`)
      .then((res) => {
        if (!res.ok) throw new Error("Erreur API");
        return res.json();
      })
      .then((data) => {
        setTickets(data.tickets || []);
        const initial: Record<string, number> = {};
        (data.tickets || []).forEach((t: Ticket) => {
          initial[t.id] = 0;
        });
        setQuantities(initial);
      })
      .catch((err) => console.error("Fetch tickets error:", err));
  }, [eventId]);

  const total = tickets.reduce(
    (sum, t) => sum + (quantities[t.id] || 0) * t.base_price,
    0
  );

  const handleReserve = async () => {
    if (!name.trim() || !email.trim()) {
      setMessage("❌ Merci de remplir nom et email");
      return;
    }

    for (const t of tickets) {
      const qty = quantities[t.id] || 0;
      if (qty > 0) {
        const formData = new FormData();
        formData.append("name", name);
        formData.append("email", email);
        formData.append("quantity", qty.toString());

        const res = await fetch(
          `https://kpsule.app/api/public/events/${eventId}/tickets/${t.id}/order`,
          { method: "POST", body: formData }
        );

        if (!res.ok) {
          try {
            const err = await res.json();
            setMessage(`❌ Erreur: ${err.detail}`);
          } catch {
            setMessage("❌ Erreur inconnue");
          }
          return;
        }
      }
    }
    setMessage("✅ Billets réservés avec succès !");
    setQuantities(Object.fromEntries(tickets.map((t) => [t.id, 0])));
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Formulaire utilisateur */}
      <Card>
        <CardHeader>
          <CardTitle>Vos informations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            type="text"
            placeholder="Nom complet"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded-md px-3 py-2"
          />
          <input
            type="email"
            placeholder="Adresse email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-md px-3 py-2"
          />
        </CardContent>
      </Card>

      {/* Liste des billets */}
      <div className="space-y-4">
        {tickets.length === 0 && (
          <p className="text-gray-500 text-center">Aucun billet disponible.</p>
        )}
        {tickets.map((t, idx) => (
          <Card
            key={t.id}
            className={`${COLORS[idx % COLORS.length]} border shadow-sm`}
          >
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TicketPercent className="h-5 w-5 text-orange-600" />
                {t.name}
              </CardTitle>
              <span className="text-sm text-gray-700">
                {t.base_price === 0 ? "Gratuit ✅" : `${t.base_price} CAD`}
                {t.inventory !== null && (
                  <span className="ml-2 text-gray-500">
                    (reste {t.inventory ?? "∞"})
                  </span>
                )}
              </span>
            </CardHeader>
            <CardContent>
              <input
                type="number"
                min={0}
                max={t.max_per_order}
                value={quantities[t.id] || 0}
                onChange={(e) =>
                  setQuantities((prev) => ({
                    ...prev,
                    [t.id]: Number(e.target.value),
                  }))
                }
                className="w-24 border rounded-md px-2 py-1"
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Total + bouton réserver */}
      <Card className="sticky bottom-0 border-t bg-white shadow-lg">
        <CardContent className="flex items-center justify-between py-4">
          <span className="font-medium text-lg">
            Total : {total === 0 ? "Gratuit ✅" : `${total} CAD`}
          </span>
          <Button onClick={handleReserve} disabled={!tickets.length}>
            Réserver
          </Button>
        </CardContent>
      </Card>

      {message && (
        <div className="text-center font-medium text-sm">{message}</div>
      )}
    </div>
  );
}
