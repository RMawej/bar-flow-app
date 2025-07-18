
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent,DialogTitle,DialogDescription, DialogClose } from "@/components/ui/dialog";

interface Item {
  id: number;
  name: string;
  price: number;
  image_url?: string;
  description?: string;
  production_time?: number;
}

const ItemsManager = () => {
  const { token, barId, userId } = useAuthStore();
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const isEditing = (id: number) => editingItem?.id === id;
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");

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




      <DialogContent className="max-w-lg">
      <DialogTitle>{editingItem ? "Modifier l'Item" : "Nouvel Item"}</DialogTitle>
        <DialogDescription>Ajoutez un nouvel item à votre menu</DialogDescription>

        <Card className="bg-white/80 backdrop-blur-sm border-orange-200">
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Mojito"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Prix ($ CA) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="Ex: 8.50"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="production_time">Temps de préparation (min) *</Label>
                  <Input
                    id="production_time"
                    type="number"
                    step="0.1"
                    value={formData.production_time}
                    onChange={(e) => setFormData({ ...formData, production_time: e.target.value })}
                    placeholder="Ex: 2.5"
                    required
                  />
                </div>

              </div>
              <div className="space-y-2">
                <Label htmlFor="image">Image</Label>
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const compressed = await compressImage(file, 500);
                      setImageFile(compressed);
                      setPreviewUrl(URL.createObjectURL(compressed));
                    }
                  }}
                />
                {!previewUrl && formData.image && (
                  <img
                    src={formData.image}
                    alt="Image actuelle"
                    className="rounded-md mt-2 max-h-48 object-contain"
                  />
                )}
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Prévisualisation"
                    className="rounded-md mt-2 max-h-48 object-contain"
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description de l'item..."
                  rows={3}
                />
              </div>
              <div className="flex space-x-2">
                <Button type="submit" className="bg-green-600 hover:bg-green-700">
                  {editingItem ? "Modifier" : "Ajouter"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Annuler
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
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
