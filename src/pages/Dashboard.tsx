
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store/authStore";
import { Music, LogOut, Package, ShoppingCart, Upload } from "lucide-react";
import ItemsManager from "@/components/ItemsManager";
import OrdersList from "@/components/OrdersList";
import PlaylistManager from "@/components/PlaylistManager";
import MenuScanner from "@/components/MenuScanner";
import QRCode from "react-qr-code";


const Dashboard = () => {
  const { logout, barId } = useAuthStore();
  const [activeTab, setActiveTab] = useState("items");

  const handleLogout = () => {
    logout();
  };

  const publicUrl = `${window.location.origin}/bar/${barId}`;

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
          <Button
            onClick={handleLogout}
            variant="outline"
            size="sm"
            className="border-orange-200 text-orange-700 hover:bg-orange-50"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Déconnexion
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Card className="bg-gradient-to-r from-orange-500 to-red-500 text-white border-0">
            <CardHeader>
              <CardTitle>Page publique de votre établissement</CardTitle>
              <CardDescription className="text-orange-100">
                Partagez ce lien avec vos clients pour qu'ils puissent commander et voter pour la musique
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-4">
                <code className="bg-white/20 px-3 py-2 rounded text-sm flex-1 truncate">
                  {publicUrl}
                </code>
                <Button
                  onClick={() => navigator.clipboard.writeText(publicUrl)}
                  variant="secondary"
                  size="sm"
                >
                  Copier
                </Button>
              </div>
              <div className="mt-4 flex justify-center bg-white p-4 rounded">
                <QRCode value={publicUrl} size={128} />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white/60 backdrop-blur-sm">
            <TabsTrigger value="items" className="flex items-center space-x-2">
              <Package className="h-4 w-4" />
              <span>Menu</span>
            </TabsTrigger>
            <TabsTrigger value="scanner" className="flex items-center space-x-2">
              <Upload className="h-4 w-4" />
              <span>Scanner</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center space-x-2">
              <ShoppingCart className="h-4 w-4" />
              <span>Commandes</span>
            </TabsTrigger>
            <TabsTrigger value="playlist" className="flex items-center space-x-2">
              <Music className="h-4 w-4" />
              <span>Playlist</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="items">
            <ItemsManager />
          </TabsContent>

          <TabsContent value="scanner">
            <MenuScanner />
          </TabsContent>

          <TabsContent value="orders">
            <OrdersList />
          </TabsContent>

          <TabsContent value="playlist">
            <PlaylistManager />
          </TabsContent>
        </Tabs>
        {/*
        <div className="mt-6 text-center">
          <Button
            onClick={async () => {
              try {
                const reg = await navigator.serviceWorker.register("/sw.js");
                const sub = await reg.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey:
                    "BDwFtxs1cVZj0zuFZveuoQbQzZ36RjOhU6ljtsWxQvesjfWLZL9et5VSFVfSwmyHqsGGyG1E8fG_6Bs8oCFOpRo",
                });
                localStorage.setItem("pushSubscription", JSON.stringify(sub));
                alert("✅ Notifications activées !");
              } catch (err) {
                alert("❌ Échec de l'activation : " + err);
              }
            }}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            🔔 Activer les notifications
          </Button>
        </div>
        */}
      </main>
    </div>
  );
};

export default Dashboard;
