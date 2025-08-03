import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

const CreateOrderModal = ({
  items,
  posId,
  token,
  barId,
}: {
  items: any[];
  posId: string;
  token: string;
  barId: string;
}) => {
    console.log("✅ Items pour la commande :", barId, token);
  const [selectedItems, setSelectedItems] = useState<{ item_id: string; quantity: number }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const toggleItem = (itemId: string) => {
    setSelectedItems(prev => {
      const existing = prev.find(i => i.item_id === itemId);
      if (existing) {
        return prev.filter(i => i.item_id !== itemId);
      } else {
        return [...prev, { item_id: itemId, quantity: 1 }];
      }
    });
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    setSelectedItems(prev => prev.map(i => i.item_id === itemId ? { ...i, quantity } : i));
  };

const handleSubmit = async () => {
  setIsLoading(true);
  try {
    const res = await fetch(`https://kpsule.app/api/bars/${barId}/commands`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token,
      },
      body: JSON.stringify({
        client_name: "John Doe",
        phone: "000000000",
        pos_id: posId,
        items: selectedItems,
      }),
    });

    const data = await res.json();
    console.log("✅ Statut :", res.status);
    console.log("✅ Réponse :", data);

    if (res.ok) {
      toast({ title: "Commande envoyée ✅", description: "John Doe va être content." });
      setSelectedItems([]);
    } else {
      toast({ title: "Erreur", description: data.detail || "Erreur lors de l'envoi" });
    }
  } catch (err) {
    console.error("❌ Erreur réseau :", err);
    toast({ title: "Erreur réseau" });
  }
  setIsLoading(false);
};


  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Nouvelle commande test</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer une commande test</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {items.map(item => {
            const isSelected = selectedItems.some(i => i.item_id === item.id);
            return (
              <div key={item.id} className="border rounded shadow p-3 flex flex-col gap-2">
                {item.image_url && (
                  <img src={item.image_url} alt={item.name} className="w-full h-40 object-cover rounded" />
                )}
                <h3 className="font-semibold text-lg">{item.name}</h3>
                <p className="text-sm text-gray-700 flex-1">{item.description}</p>
                <p className="text-green-600 font-bold">{item.price} $</p>

                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleItem(item.id)}
                  />
                  <Input
                    type="number"
                    className="w-20"
                    min={1}
                    disabled={!isSelected}
                    value={selectedItems.find(i => i.item_id === item.id)?.quantity || 1}
                    onChange={(e) => updateQuantity(item.id, parseInt(e.target.value))}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <Button onClick={handleSubmit} disabled={isLoading || selectedItems.length === 0} className="w-full">
          {isLoading ? "Envoi..." : "Créer la commande"}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default CreateOrderModal;
