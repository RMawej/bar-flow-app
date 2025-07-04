import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store/authStore";
import { Music, LogOut, Package, ShoppingCart, Upload } from "lucide-react";
import ItemsManager from "@/components/ItemsManager";
import OrdersList from "@/components/OrdersList";
import PlaylistManager from "@/components/PlaylistManager";
import MenuScanner from "@/components/MenuScanner";
import QRCode from "react-qr-code";

const Dashboard = () => {
  const { logout, barId, userId } = useAuthStore();
  const [activeTab, setActiveTab] = useState("items");
  const [posList, setPosList] = useState([]);
  const [selectedPos, setSelectedPos] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [burgerOpen, setBurgerOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");

  useEffect(() => {
    if (!modalOpen) return;
    fetch(`https://kpsule.app/api/bars/${barId}/pos`, {
      headers: { 'x-user-id': userId }
    })
      .then(res => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then(data => setPosList(data.points_of_sale))
      .catch(err => console.error('Erreur chargement PDV:', err));
  }, [modalOpen]);

  const openCreate = () => {
    setSelectedPos(null);
    setFormName("");
    setFormSlug("");
  };

  const submitForm = async () => {
    const method = selectedPos ? 'PUT' : 'POST';
    const url = selectedPos
      ? `https://kpsule.app/api/bars/${barId}/pos/${selectedPos.id}`
      : `https://kpsule.app/api/bars/${barId}/pos`;
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId
      },
      body: JSON.stringify({ name: formName, slug: formSlug })
    });
    if (!res.ok) throw new Error(res.statusText);
    const refresh = await fetch(`https://kpsule.app/api/bars/${barId}/pos`, {
      headers: { 'x-user-id': userId }
    });
    const d = await refresh.json();
    setPosList(d.points_of_sale);
    openCreate();
  };

  const deletePos = async () => {
    if (!selectedPos) return;
    const res = await fetch(`https://kpsule.app/api/bars/${barId}/pos/${selectedPos.id}`, {
      method: 'DELETE',
      headers: { 'x-user-id': userId }
    });
    if (!res.ok) throw new Error(res.statusText);
    const refresh = await fetch(`https://kpsule.app/api/bars/${barId}/pos`, {
      headers: { 'x-user-id': userId }
    });
    const d = await refresh.json();
    setPosList(d.points_of_sale);
    openCreate();
  };

  const publicUrl = pos => `${window.location.origin}/bar/${barId}?pos_id=${pos.id}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-orange-200 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center">
              <Music className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Votre Dashboard</h1>
              <p className="text-sm text-gray-600">Gestion de votre établissement</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button onClick={() => setModalOpen(true)} variant="outline" size="sm">
              Gérer les PDV
            </Button>
            <Button onClick={logout} variant="outline" size="sm" className="border-orange-200 text-orange-700 hover:bg-orange-50">
              <LogOut className="h-4 w-4 mr-2" /> Déconnexion
            </Button>
          </div>
        </div>
      </header>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-3/4 max-w-2xl p-6 relative">
            <button onClick={() => setModalOpen(false)} className="absolute top-2 right-2 text-xl">✕</button>
            <h2 className="text-2xl font-bold mb-4">Points de vente</h2>
            <div className="flex items-center mb-4">
              <button onClick={() => setBurgerOpen(!burgerOpen)} className="mr-2 text-2xl">☰</button>
              {burgerOpen && (
                <ul className="border p-2 bg-white space-y-1">
                  {posList.map(pos => (
                    <li key={pos.id} className="py-1 px-2 rounded hover:bg-gray-100 cursor-pointer" onClick={() => {
                      setSelectedPos(pos); setFormName(pos.name); setFormSlug(pos.slug); setBurgerOpen(false);
                    }}>
                      {pos.name}
                    </li>
                  ))}
                </ul>
              )}
              <Button onClick={openCreate} size="sm">+ Nouveau</Button>
            </div>
            <div className="flex space-x-6">
              <div>
                {selectedPos ? <QRCode value={publicUrl(selectedPos)} size={128} /> : <p>Sélectionnez un PDV</p>}
              </div>
              <div className="flex-1 space-y-2">
                <input type="text" placeholder="Nom" value={formName} onChange={e => setFormName(e.target.value)} className="w-full border p-2 rounded" />
                <input type="text" placeholder="Slug" value={formSlug} onChange={e => setFormSlug(e.target.value)} className="w-full border p-2 rounded" />
                <div className="flex space-x-2">
                  <Button onClick={submitForm} disabled={!formName || !formSlug}>{selectedPos ? 'Modifier' : 'Créer'}</Button>
                  {selectedPos && <Button variant="destructive" onClick={deletePos}>Supprimer</Button>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Card className="bg-gradient-to-r from-orange-500 to-red-500 text-white border-0">
            <CardHeader>
              <CardTitle>Page publique de votre établissement</CardTitle>
              <CardDescription className="text-orange-100">Partagez ce lien avec vos clients pour qu'ils puissent commander et voter pour la musique</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-4">
                <code className="bg-white/20 px-3 py-2 rounded text-sm flex-1 truncate">{`${window.location.origin}/bar/${barId}`}</code>
                <Button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/bar/${barId}`)} variant="secondary" size="sm">Copier</Button>
              </div>
              <div className="mt-4 flex justify-center bg-white p-4 rounded">
                <QRCode value={`${window.location.origin}/bar/${barId}`} size={128} />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white/60 backdrop-blur-sm">
            <TabsTrigger value="items"><Package className="h-4 w-4" />Menu</TabsTrigger>
            <TabsTrigger value="scanner"><Upload className="h-4 w-4" />Scanner</TabsTrigger>
            <TabsTrigger value="orders"><ShoppingCart className="h-4 w-4" />Commandes</TabsTrigger>
            <TabsTrigger value="playlist"><Music className="h-4 w-4" />Playlist</TabsTrigger>
          </TabsList>
          <TabsContent value="items"><ItemsManager /></TabsContent>
          <TabsContent value="scanner"><MenuScanner /></TabsContent>
          <TabsContent value="orders"><OrdersList filter="all" /></TabsContent>
          <TabsContent value="playlist"><PlaylistManager /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
