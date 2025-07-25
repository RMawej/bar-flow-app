
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/hooks/use-toast";
import { Minus, Plus, ChevronLeft, ChevronRight, Edit, Trash2 } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent,DialogOverlay,DialogTitle,DialogDescription, DialogClose } from "@/components/ui/dialog";

interface Item {
  id: number;
  name: string;
  price: number;
  image_url?: string;
  description?: string;
  production_time?: number;
  pos_settings?: {
    pos_id: string;
    is_visible: boolean;
    is_available: boolean;
    stock_quantity: number;
  }[];
}


const ItemsManager = () => {
  const { token, barId, userId } = useAuthStore();
  const [pdvIndex, setPdvIndex] = useState(0);

  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const isEditing = (id: number) => editingItem?.id === id;
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [posList, setPosList] = useState<{ id: string; name: string }[]>([]);
  const toggleAll = (field: "is_visible" | "is_available") => {
    // détermine si tous sont déjà true
    const allTrue = posList.every(p => posSettings[p.id]?.[field]);
    setPosSettings(prev => {
      const next = { ...prev };
      posList.forEach(p => {
        next[p.id] = { ...prev[p.id], [field]: !allTrue };
      });
      return next;
    });
  };
  
  useEffect(() => {
    if (!token || !barId || !userId) return;
    console.log('[DEBUG] fetching POS for bar', barId, 'with userId', userId);
    fetch(`https://kpsule.app/api/bars/${barId}/pos`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-user-id': userId,
      },
    })
      .then(res => {
        console.log('[DEBUG] POS fetch status:', res.status);
        return res.json();
      })
      .then(data => {
        console.log('[DEBUG] POS list received:', data.points_of_sale);
        setPosList(data.points_of_sale || []);
      })
      .catch(err => console.error('[ERROR] POS fetch error:', err));
  }, [token, barId, userId]);
  
  const [posSettings, setPosSettings] = useState<{ [pos_id: string]: { is_visible: boolean; is_available: boolean } }>({});
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    image: "",
    description: "",
    production_time: "",
  });
  const [confirmSkipUntil, setConfirmSkipUntil] = useState<number | null>(() => {
    const stored = localStorage.getItem("skipDeleteConfirmUntil");
    return stored ? parseInt(stored) : null;
  });
  
  const fetchItems = async () => {
    if (!token || !barId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`https://kpsule.app/api/bars/${barId}/items`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setItems(Array.isArray(data.items) ? data.items : []);
      }      
    } catch (error) {
      console.error('Erreur lors du chargement des items:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les items",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [token, barId]);

  const handleDelete = async (itemId: string) => {
    const now = Date.now();
  
    if (!confirmSkipUntil || now > confirmSkipUntil) {
      const checkbox = window.confirm("Supprimer cet item ?");
  
      if (!checkbox) return;
  
      const skip = window.confirm("Ne plus demander pendant 1 heure ?");
      if (skip) {
        const expiry = now + 3600 * 1000;
        localStorage.setItem("skipDeleteConfirmUntil", expiry.toString());
        setConfirmSkipUntil(expiry);
      }
    }
  
    if (!token || !barId || !userId) return;
  
    try {
      const response = await fetch(`https://kpsule.app/api/bars/${barId}/items/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-user-id': userId,
        },
      });
  
      if (response.ok) {
        toast({ title: "Item supprimé" });
        setItems((prev) => prev.filter((item) => item.id !== itemId));
      } else {
        throw new Error("Échec de la suppression");
      }
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de supprimer l'item", variant: "destructive" });
    }
  };


  const compressImage = (file: File, maxSizeKB = 500): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const scale = Math.sqrt((maxSizeKB * 1024) / file.size);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (blob) resolve(new File([blob], file.name, { type: "image/jpeg" }));
          }, "image/jpeg", 0.7);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !barId) return;
  
    try {
      const url = editingItem
        ? `https://kpsule.app/api/bars/${barId}/items/${editingItem.id}`
        : `https://kpsule.app/api/bars/${barId}/items`;
      const method = editingItem ? "PUT" : "POST";
  
      const formDataToSend = new FormData();
      formDataToSend.append("name", formData.name);
      formDataToSend.append("price", formData.price);
      formDataToSend.append("description", formData.description);
      formDataToSend.append("available", "true");
      formDataToSend.append("production_time", formData.production_time);
      if (imageFile) {
        const compressed = await compressImage(imageFile, 500);
        formDataToSend.append("file", compressed);
      }
      // juste avant l’envoi
      const posArray = Object.entries(posSettings).map(([pos_id, s]) => ({
        pos_id,
        is_visible: s.is_visible,
        is_available: s.is_available,
        stock_quantity: s.stock_quantity || 0
      }));
      formDataToSend.append("pos_data", JSON.stringify(posArray));

  
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-user-id': userId,
        },
        body: formDataToSend,
      });

      if (response.ok) {
        const updated = await response.json();
        toast({ title: "Succès", description: editingItem ? "Item modifié" : "Item ajouté" });
          // 🔔 ENVOI DE LA NOTIFICATION (seulement si modifié)
      if (editingItem) {
        await fetch("https://kpsule.app/api/notify", {
          method: "POST",
          body: JSON.stringify({
            subscription: JSON.parse(localStorage.getItem("pushSubscription") || "{}"),
            payload: {
              title: "Item modifié",
              body: `${formData.name} a été mis à jour`,
            },
          }),
        });
      }
        setItems((prev) =>
          editingItem
            ? prev.map((item) => (item.id === editingItem.id ? updated.item : item))
            : [...prev, updated.item]
        );
        setFormData({ name: "", price: "", image: "", description: "" });
        setImageFile(null);
        setPreviewUrl("");
        setEditingItem(null);
        setOpen(false);
      } else {
        throw new Error("Échec de l'opération");
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: editingItem ? "Impossible de modifier l'item" : "Impossible d'ajouter l'item",
        variant: "destructive",
      });
    }
  };  

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gestion du Menu</h2>
          <p className="text-gray-600">Ajoutez et gérez les items de votre établissement</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
        <Button
          className="bg-orange-600 hover:bg-orange-700 text-white"
          onClick={() => {
            setEditingItem(null);
            setFormData({ name: "", price: "", image: "", description: "", production_time: "" });
            setOpen(true);
          }}
        >
          <Plus className="mr-2" />
          Ajouter un Nouvel Item
        </Button>

        <DialogOverlay className="fixed inset-0 bg-black bg-opacity-50 z-40" />
        <DialogContent
  className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-[800px] max-h-[90vh] bg-white rounded-2xl p-6 overflow-auto"
>
  <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Header */}
  <div className="lg:col-span-3 flex justify-between items-center mb-6">
    <div>
      <h2 className="text-2xl font-bold text-gray-800">
        {editingItem ? "Modifier l'Item" : "Nouvel Item"}
      </h2>
      <p className="text-gray-600">
        {editingItem ? "Mettez à jour les détails de votre item" : "Ajoutez un nouvel item"}
      </p>
    </div>
  </div>

  {/* ← Partie détails + PdV (2/3) */}
  <div className="lg:col-span-2 space-y-6 pr-6">
    {/* Champs de base */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <Label htmlFor="name">Nom *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={e => setFormData({ ...formData, name: e.target.value })}
          required
          className="shadow-inner"
        />
      </div>
      <div>
        <Label>Prix ($ CA) *</Label>
        <div className="flex items-center border rounded overflow-hidden shadow-inner h-10">
          <button
            type="button"
            onClick={() =>
              setFormData(p => ({
                ...p,
                price: (Math.max(parseFloat(p.price) - 0.1, 0)).toFixed(1)
              }))
            }
            className="px-3 hover:bg-gray-100"
          >
            <Minus size={16} />
          </button>
          <Input
            id="price"
            type="number"
            step="0.1"
            value={formData.price}
            onChange={e => setFormData({ ...formData, price: e.target.value })}
            className="text-center border-none flex-1 h-full"
            required
          />
          <button
            type="button"
            onClick={() =>
              setFormData(p => ({
                ...p,
                price: (parseFloat(p.price) + 0.1).toFixed(1)
              }))
            }
            className="px-3 hover:bg-gray-100"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
      <div className="md:col-span-2">
        <Label htmlFor="production_time">Temps de préparation (min) *</Label>
        <Input
          id="production_time"
          type="number"
          step="0.1"
          value={formData.production_time}
          onChange={e => setFormData({ ...formData, production_time: e.target.value })}
          required
          className="shadow-inner"
        />
      </div>
      <div className="md:col-span-2">
        <Label>Description</Label>
        <Textarea
          rows={3}
          value={formData.description}
          onChange={e => setFormData({ ...formData, description: e.target.value })}
          className="shadow-inner"
        />
      </div>
    </div>

    {/* Carousel PdV */}
    {posList.length > 0 && (
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label className="font-medium">Paramètres par PdV</Label>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => toggleAll("is_visible")}>
              Toggle Visible
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => toggleAll("is_available")}>
              Toggle Dispo
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button type="button" size="icon" variant="ghost" onClick={() => setPdvIndex((pdvIndex - 1 + posList.length) % posList.length)}>
            <ChevronLeft />
          </Button>
          <div className="flex-1 bg-gray-50 p-4 rounded shadow-inner">
            <h4 className="font-semibold mb-2">{posList[pdvIndex].name}</h4>
            <div className="flex items-center gap-4">
              <Label className="flex items-center space-x-1">
                <input
                  type="checkbox"
                  checked={posSettings[posList[pdvIndex].id]?.is_visible || false}
                  onChange={e =>
                    setPosSettings(prev => ({
                      ...prev,
                      [posList[pdvIndex].id]: {
                        ...prev[posList[pdvIndex].id],
                        is_visible: e.target.checked
                      }
                    }))
                  }
                />
                <span>Visible</span>
              </Label>
              <Label className="flex items-center space-x-1">
                <input
                  type="checkbox"
                  checked={posSettings[posList[pdvIndex].id]?.is_available || false}
                  onChange={e =>
                    setPosSettings(prev => ({
                      ...prev,
                      [posList[pdvIndex].id]: {
                        ...prev[posList[pdvIndex].id],
                        is_available: e.target.checked
                      }
                    }))
                  }
                />
                <span>Disponible</span>
              </Label>
              <Input
                type="number"
                value={posSettings[posList[pdvIndex].id]?.stock_quantity || 0}
                onChange={e =>
                  setPosSettings(prev => ({
                    ...prev,
                    [posList[pdvIndex].id]: {
                      ...prev[posList[pdvIndex].id],
                      stock_quantity: parseInt(e.target.value)
                    }
                  }))
                }
                className="w-20"
              />
            </div>
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={() => setPdvIndex((pdvIndex + 1) % posList.length)}>
            <ChevronRight />
          </Button>
        </div>
      </div>
    )}
  </div>

  {/* → Image (1/3) */}
  <div className="flex flex-col items-center space-y-4">
    <Label>Image</Label>
    <div className="w-full h-48 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
      {(previewUrl || formData.image) ? (
        <img
          src={previewUrl || formData.image}
          alt="Preview"
          className="object-contain w-full h-full"
        />
      ) : (
        <span className="text-gray-400">Aucune image</span>
      )}
    </div>
    <Button type="button" variant="outline" onClick={() => document.getElementById("image")?.click()}>
      Sélectionner une image
    </Button>
    <Input
      id="image"
      type="file"
      accept="image/*"
      onChange={async e => {
        const file = e.target.files?.[0];
        if (file) {
          const compressed = await compressImage(file, 500);
          setImageFile(compressed);
          setPreviewUrl(URL.createObjectURL(compressed));
        }
      }}
      className="hidden"
    />
  </div>

  {/* Actions */}
  <div className="lg:col-span-3 mt-8 flex justify-end gap-4">
    <Button type="button"variant="outline" onClick={() => setOpen(false)}>
      Annuler
    </Button>
    <Button type="submit" className="bg-green-600 hover:bg-green-700">
      {editingItem ? "Modifier" : "Ajouter"}
    </Button>
  </div>
  </form>

</DialogContent>

      </Dialog>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
            <p className="text-gray-600 mt-2">Chargement...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="col-span-full text-center py-8">
            <p className="text-gray-600">Aucun item dans votre menu</p>
          </div>
        ) : (
          items.filter((item): item is Item => item && typeof item.id !== 'undefined' && typeof item.name === 'string')
          .map((item) => (
            <div
              key={item.id}
              className="relative h-64 rounded-xl overflow-hidden group shadow-md transition transform hover:scale-[1.02] flex items-center justify-center text-white"
            >
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
              style={{ backgroundImage: `url(${item.image_url || "/placeholder.jpg"})` }}
            />

              <div className="absolute inset-0 bg-black/50 group-hover:bg-black/60 transition" />

              {/* Infos nom + prix visibles en permanence */}
              <div className="z-10 text-center absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-500 opacity-100 group-hover:opacity-0">
                <h3 className="text-3xl font-semibold drop-shadow">{item.name}</h3>
                <p className="text-2xl mt-1 drop-shadow">{item.price}$ CA</p>
              </div>


              {/* Icônes visibles uniquement au hover */}
              <div className="absolute inset-0 flex items-center justify-center gap-10 z-10 opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-500">
              <Button
                size="icon"
                variant="ghost"
                className="text-white hover:bg-white/20 w-20 h-20"
                onClick={() => {
                  setEditingItem(item);
                  setFormData({
                    name: item.name,
                    price: item.price.toString(),
                    image: item.image_url || "",
                    description: item.description || "",
                    production_time: item.production_time?.toString() || "",
                  });
                
                  const initialSettings: PosSettings = {};
                  if (item.pos_settings) {
                    for (const s of item.pos_settings) {
                      initialSettings[s.pos_id] = {
                        is_visible: s.is_visible,
                        is_available: s.is_available,
                        stock_quantity: s.stock_quantity,
                      };
                    }
                  }
                  setPosSettings(initialSettings);
                
                  setOpen(true);
                }}                
              >
                <Edit className="w-10 h-10" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="text-red-300 hover:bg-red-500/30 w-20 h-20"
                onClick={() => handleDelete(item.id.toString())}
              >
                <Trash2 className="w-10 h-10" />
              </Button>
            </div>

            </div>

          ))
          
        )}
      </div>
    </div>
  );
};

export default ItemsManager;
