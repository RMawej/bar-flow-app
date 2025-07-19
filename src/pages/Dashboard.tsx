import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store/authStore";
import { Music, LogOut, Package, ShoppingCart, Upload } from "lucide-react";
import ItemsManager from "@/components/ItemsManager";
import OrdersListAdmin from "@/components/OrdersListAdmin";
import PlaylistManager from "@/components/PlaylistManager";
import MenuScanner from "@/components/MenuScanner";
import QRCode from "react-qr-code";
import SettingsForm from "@/components/SettingsForm";

const Dashboard = () => {
  const { logout, barId, userId } = useAuthStore();
  const [activeTab, setActiveTab] = useState(() => {
    return new URLSearchParams(window.location.search).get("tab") || "items";
  });
  const [showPublicPage, setShowPublicPage] = useState(true);
  const [lockPublicPage, setLockPublicPage] = useState(false);

  const [posList, setPosList] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [selectedPos, setSelectedPos] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [burgerOpen, setBurgerOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");

  useEffect(() => {
    if (!modalOpen) return;
    fetch(`https://kpsule.app/api/bars/${barId}/pos`, {
      headers: { 'x-user-id': userId }
    })
      .then(res => res.json())
      .then(data => setPosList(data.points_of_sale))
      .catch(err => console.error('Erreur chargement PDV:', err));
  }, [modalOpen]);

  useEffect(() => {
    if (selectedPos) {
      const selected = posList.find(p => p.id === selectedPos);
      if (selected) {
        setFormName(selected.name);
        setFormSlug(selected.slug);
      }
    } else {
      setFormName("");
      setFormSlug("");
    }
  }, [selectedPos, posList]);

  const openCreate = () => {
    setSelectedPos(null);
    setFormName("");
    setFormSlug("");
  };
  useEffect(() => {
    fetch(`https://kpsule.app/api/bars/${barId}/pos`, {
      headers: { 'x-user-id': userId }
    })
      .then(res => res.json())
      .then(data => {
        console.log(data);
        setPosList(data.points_of_sale);
        // si aucun pos_id dans l'URL, pré-sélectionner le premier
        const qp = new URLSearchParams(window.location.search).get('pos_id');
        if (qp && data.points_of_sale.find((p: any) => p.id === qp)) {
          setSelectedPos(qp);
        } else if (data.points_of_sale.length) {
          setSelectedPos(data.points_of_sale[0].id);
        }
      })
      .catch(err => console.error('Erreur chargement PDV:', err));
  }, [barId, userId]);

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
          <div className="mb-4 flex justify-between items-center">

    </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8 relative">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-xl"
            >
              ✕
            </button>

            <h2 className="text-3xl font-semibold text-center text-orange-600 mb-6">Gestion des Points de Vente</h2>

            <div className="flex flex-col items-center gap-4">
              {posList.length > 1 && (
                <div className="flex flex-wrap justify-center gap-3">
                  {posList.map(pos => (
                    <Button
                      key={pos.id}
                      onClick={() => setSelectedPos(pos.id)}
                      className={`
                        px-4 py-2 text-sm rounded-full border transition 
                        ${selectedPos === pos.id
                          ? 'bg-orange-600 text-white border-orange-600'
                          : 'bg-white text-orange-600 border-orange-300 hover:bg-orange-100'}
                      `}
                      variant="outline"
                    >
                      {pos.name}
                    </Button>
                  ))}
                </div>
              )}

              <Button onClick={openCreate} size="sm" className="mt-2">+ Nouveau</Button>
              {selectedPos && (
                <a
                href={`${window.location.origin}/bartender/${selectedPos}`}
                target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 underline hover:text-blue-800 mt-2"
                >
                  {`${window.location.origin}/bartender/${selectedPos}`}
                </a>
              )}              
                <div className="flex gap-6 w-full mt-6">
                <div className="flex-shrink-0">
                  {selectedPos ? (
                    <QRCode value={`https://kpsule.app/bartender/${selectedPos}`} size={140} />
                  ) : (
                    <div className="w-[140px] h-[140px] flex items-center justify-center border rounded text-gray-400 text-sm">
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-3">
                  <input
                    type="text"
                    placeholder="Nom"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <input
                    type="text"
                    placeholder="Slug"
                    value={formSlug}
                    onChange={e => setFormSlug(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={submitForm}
                      disabled={!formName || !formSlug}
                      className="flex-1"
                    >
                      {selectedPos ? 'Modifier' : 'Créer'}
                    </Button>
                    {selectedPos && (
                      <Button
                        variant="destructive"
                        onClick={deletePos}
                        className="flex-1"
                      >
                        Supprimer
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8">
      <div
        className="mb-8 transition-all duration-300"
      >
        <Card className="bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 overflow-hidden">
          <CardHeader        onMouseEnter={() => setShowPublicPage(true)}
        onMouseLeave={() => !lockPublicPage && setShowPublicPage(false)}
        onClick={() => setLockPublicPage(prev => {
          const newLock = !prev;
          if (!newLock) setShowPublicPage(false); // ferme aussi visuellement
          return newLock;
        })}>
            <CardTitle className="cursor-pointer">Page publique de votre établissement</CardTitle>
            <CardDescription className="text-orange-100">
              Choisissez un point de vente et partagez son lien
            </CardDescription>
          </CardHeader>

          {showPublicPage && (
            <CardContent className="space-y-6">
              {/* Sélection PDV */}
              <div className="p-4 rounded-lg justify-center flex flex-wrap gap-3">
                {posList.map(pos => (
                  <Button
                    key={pos.id}
                    variant={pos.id === selectedPos ? 'default' : 'outline'}
                    size="sm"
                    className={`
                      text-xs 
                      ${pos.id === selectedPos 
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                        : 'border-indigo-500 text-indigo-600 hover:bg-indigo-50'}
                    `}
                    onClick={() => setSelectedPos(pos.id)}
                  >
                    {pos.name}
                  </Button>
                ))}
              </div>

              {/* Lien & QR */}
              <div className="flex flex-col items-center gap-4 text-center">
                {(() => {
                  const link = selectedPos
                    ? `${window.location.origin}/bar/${barId}?pos_id=${selectedPos}`
                    : `${window.location.origin}/bar/${barId}`;
                  return (
                    <>
                      <code className="bg-white/20 px-4 py-2 rounded-lg text-sm max-w-full sm:max-w-[400px] truncate sm:whitespace-normal">
                        {link}
                      </code>
                      <div className="flex flex-wrap justify-center gap-2">
                        <Button
                          className="bg-white/30 backdrop-blur border border-white/50 text-white hover:bg-white/40 transition text-xs"
                          size="sm"
                          onClick={() => navigator.clipboard.writeText(link)}
                        >
                          Copier le lien
                        </Button>
                        <Button
                          className="bg-white/30 backdrop-blur border border-white/50 text-white hover:bg-white/40 transition text-xs"
                          size="sm"
                          onClick={() => {
                            const canvas = document.querySelector('canvas');
                            if (canvas) {
                              const url = canvas.toDataURL('image/png');
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = 'qr_code.png';
                              a.click();
                            }
                          }}
                        >
                          Enregistrer le QR code
                        </Button>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow">
                        <QRCode value={link} size={128} />
                      </div>
                    </>
                  );
                })()}
              </div>
            </CardContent>
          )}
        </Card>
      </div>




        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white/60 backdrop-blur-sm">
            <TabsTrigger value="items"><Package className="h-4 w-4" />Menu</TabsTrigger>
            <TabsTrigger value="orders"><ShoppingCart className="h-4 w-4" />Commandes</TabsTrigger>
            <TabsTrigger value="playlist"><Music className="h-4 w-4" />Playlist</TabsTrigger>
            <TabsTrigger value="settings">Paramètres</TabsTrigger>
          </TabsList>
          <TabsContent value="items"><ItemsManager /></TabsContent>
          <TabsContent value="orders"><OrdersListAdmin /></TabsContent>
          <TabsContent value="playlist"><PlaylistManager /></TabsContent>
          <TabsContent value="settings">
            <SettingsForm />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
