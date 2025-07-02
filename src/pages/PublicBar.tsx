
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Music, ShoppingCart, Plus, Minus, ThumbsUp, Send } from "lucide-react";
import WhackAMole from "@/components/WhackAMole";
import InfiniteTicTacToe from "@/components/InfiniteTicTacToe";

interface Item {
  id: number;
  name: string;
  price: number;
  image?: string;
  description?: string;
}

interface Track {
  id: number;
  track_name: string;
  spotify_url?: string;
  votes: number;
}

interface CartItem extends Item {
  quantity: number;
}

const PublicBar = () => {
  const { barId } = useParams();
  const [items, setItems] = useState<Item[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [clientName, setClientName] = useState("");
  const [newTrackName, setNewTrackName] = useState("");
  const [newSpotifyUrl, setNewSpotifyUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pickupCode, setPickupCode] = useState<string | null>(null);
  const [pickupColor, setPickupColor] = useState<string | null>(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [currentCommand, setCurrentCommand] = useState<any>(null);
  const [lastCommand, setLastCommand] = useState<any>(null);

  const fetchItems = async () => {
    try {
      const response = await fetch(`https://kpsule.app/api/bars/${barId}/items`);
      if (response.ok) {
        const data = await response.json();
        setItems(data.items);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des items:', error);
    }
  };

  const fetchPlaylist = async () => {
    try {
      const response = await fetch(`https://kpsule.app/api/public/bars/${barId}/playlist`);
      if (response.ok) {
        const data = await response.json();
        setTracks(data);
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la playlist:', error);
    }
  };

  useEffect(() => {
    if (barId) {
      // 🔁 Charger nom & téléphone sauvegardés
      const savedName = localStorage.getItem("client_name");
      const savedPhone = localStorage.getItem("phone_number");
      if (savedName) setClientName(savedName);
      if (savedPhone) setPhoneNumber(savedPhone);
  
      fetchItems();
      fetchPlaylist();
  
      const savedId = localStorage.getItem("client_id");
      console.log("Saved Client ID:", savedId);
      if (savedId) {
        fetch(`https://kpsule.app/api/public/bars/${barId}/commands/by-client?client_id=${savedId}`)
          .then(res => res.json())
          .then(data => {
            if (data?.id) setCurrentCommand(data);
          });
      }
      if (!savedId) {
        const lastCmd = localStorage.getItem("last_command");
        if (lastCmd) {
          try {
            setLastCommand(JSON.parse(lastCmd));
          } catch {}
        }
      }
      
    }
  }, [barId]);
  

  useEffect(() => {
    if (!barId || !currentCommand) return;
  
    const clientId = localStorage.getItem("client_id");
    const socket = new WebSocket(`wss://kpsule.app/ws/${barId}?client_id=${clientId}`);
  
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (
        message.type === "command_update" &&
        message.command?.id === currentCommand.id
      ) {
        setCurrentCommand((prev: any) => {
          const isNowReady = prev.status !== "ready" && message.command.status === "ready";
          const isNowDone = message.command.status === "done";
      
          if (isNowReady) {
            toast({
              title: "🥤 Votre drink est prêt !",
              description: "Rendez-vous au bar pour le récupérer.",
            });
          }
      
          if (message.command.pickup_code) {
            setPickupCode(message.command.pickup_code);
            setPickupColor(message.command.pickup_color);
          }
      
          if (isNowDone) {
            localStorage.setItem("last_command", JSON.stringify(prev));
            localStorage.removeItem("client_id");
            setLastCommand(prev); // facultatif si tu veux aussi en RAM
            return null;
          }
          
      
          return { ...prev, status: message.command.status };
        });
      }
      
    };
  
    return () => socket.close();
  }, [barId, currentCommand?.id]);
  
  



  const addToCart = (item: Item) => {
    setCart(prev => {
      const existing = prev.find(cartItem => cartItem.id === item.id);
      const updatedCart = existing
        ? prev.map(cartItem =>
            cartItem.id === item.id
              ? { ...cartItem, quantity: cartItem.quantity + 1 }
              : cartItem
          )
        : [...prev, { ...item, quantity: 1 }];
  
      const total = updatedCart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  
      toast({
        title: `${item.name} ajouté au panier`,
        description: `Total : ${total.toFixed(2)}€`,
      });
  
      return updatedCart;
    });
  };
  

  const removeFromCart = (itemId: number) => {
    setCart(prev => {
      const existing = prev.find(cartItem => cartItem.id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map(cartItem =>
          cartItem.id === itemId
            ? { ...cartItem, quantity: cartItem.quantity - 1 }
            : cartItem
        );
      }
      return prev.filter(cartItem => cartItem.id !== itemId);
    });
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const handleOrder = async () => {
    if (!clientName || cart.length === 0) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir votre nom et ajouter des items au panier",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const orderItems = cart.map(item => ({
        item_id: item.id,
        quantity: item.quantity,
      }));

      const response = await fetch(`https://kpsule.app/api/public/bars/${barId}/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_name: clientName,
          phone: phoneNumber,
          items: orderItems,
        }),
      });      

      if (response.ok) {
        toast({
          title: "Commande envoyée",
          description: "Votre commande a été transmise au bar !",
        });
        const clientId = crypto.subtle
          ? await crypto.subtle.digest("SHA-256", new TextEncoder().encode(phoneNumber)).then(buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join(''))
          : "";

        localStorage.setItem("client_id", clientId);
        localStorage.setItem("client_name", clientName);
        localStorage.setItem("phone_number", phoneNumber);


        const data = await response.json();
        setCurrentCommand({
          id: data.command_id,
          items: cart.map(item => ({
            item_id: item.id,
            item_name: item.name,
            quantity: item.quantity,
            price: item.price,
          })),
          status: "pending",
          total: getTotalPrice(),
        });
        

        setCart([]);
        } else {
        throw new Error('Erreur lors de la commande');
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer la commande",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = async (trackId: number) => {
    try {
      const response = await fetch(`https://kpsule.app/api/bars/${barId}/playlist/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ track_id: trackId }),
      });

      if (response.ok) {
        toast({
          title: "Vote enregistré",
          description: "Merci pour votre vote !",
        });
        fetchPlaylist(); // Refresh to show updated votes
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer le vote",
        variant: "destructive",
      });
    }
  };

  const handleSuggestTrack = async () => {
    if (!newTrackName) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir le nom de la musique",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`https://kpsule.app/api/bars/${barId}/playlist/suggest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          track_name: newTrackName,
          spotify_url: newSpotifyUrl || undefined,
        }),
      });

      if (response.ok) {
        toast({
          title: "Suggestion envoyée",
          description: "Votre suggestion musicale a été ajoutée !",
        });
        setNewTrackName("");
        setNewSpotifyUrl("");
        fetchPlaylist();
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer la suggestion",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-orange-200 shadow-sm">
        <div className="container mx-auto px-4 py-6 text-center">
          <div className="h-12 w-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center mx-auto mb-3">
            <Music className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
            Bienvenue
          </h1>
          <p className="text-gray-600 mt-1">Commandez et votez pour la musique !</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="menu" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 bg-white/60 backdrop-blur-sm">
            <TabsTrigger value="menu" className="flex items-center space-x-2">
              <ShoppingCart className="h-4 w-4" />
              <span>Menu & Commande</span>
            </TabsTrigger>
            <TabsTrigger value="music" className="flex items-center space-x-2">
              <Music className="h-4 w-4" />
              <span>Playlist</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="menu" className="space-y-6">
          {currentCommand ? (
            <Card>
              <CardHeader>
                <CardTitle>Commande en cours</CardTitle>
                <CardDescription>ID : {currentCommand.id}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                
              {currentCommand.items.map((item: any, index: number) => {
              console.log(item);
              return (
                <div key={item.item_id || item.id || index} className="flex justify-between">

                    <span>{item.item_name} × {item.quantity}</span>
                    <span>{(item.price * item.quantity).toFixed(2)}€</span>
                  </div>
                );
              })}
                <div className="text-right font-bold text-orange-600">
                  Total : {currentCommand.total.toFixed(2)}€
                </div>
                <Badge
                    className={
                      currentCommand.status === "pending"
                        ? "bg-gray-400 text-white"
                        : currentCommand.status === "in_progress"
                        ? "bg-yellow-400 text-white"
                        : currentCommand.status === "ready"
                        ? "bg-green-500 text-white"
                        : currentCommand.status === "done"
                        ? "bg-blue-500 text-white"
                        : "bg-slate-500 text-white"
                    }
                  >
                    {currentCommand.status === "pending"
                      ? "En attente ⏳"
                      : currentCommand.status === "in_progress"
                      ? "En préparation 🍹"
                      : currentCommand.status === "ready"
                      ? "Prêt 🥤"
                      : currentCommand.status === "done"
                      ? "Récupéré ✅"
                      : currentCommand.status}
                  </Badge>


                  <div className="mt-6 text-center">
                  {currentCommand.status === "ready" ? (
                    <button
                      onClick={() => setShowCodeModal(true)}
                      className="inline-block px-8 py-6 rounded-xl text-3xl font-bold shadow-lg transition-all duration-300"
                      style={{
                        backgroundColor: pickupColor || "#22c55e",
                        color: "#fff",
                        animation: "bounce 1.5s ease-in-out infinite",
                        animationName: "bounce",
                        animationDuration: "1s",
                        animationTimingFunction: "ease-in-out",
                        animationIterationCount: "infinite",
                        animationDirection: "normal",
                        animationFillMode: "none",
                        animationPlayState: "running",
                        animationDelay: "0s",
                        animationKeyframes: {
                          "0%": { transform: "translateY(0)" },
                          "50%": { transform: "translateY(-5px)" },
                          "100%": { transform: "translateY(0)" },
                        }
                      }}
                    >
                      🥤 Prêt ! Cliquez pour voir votre code
                    </button>

                  ) : (
                    <div
                      className={
                        `inline-block px-6 py-4 rounded-xl text-2xl font-bold shadow-md ` +
                        (currentCommand.status === "pending"
                          ? "bg-gray-400 text-white"
                          : currentCommand.status === "in_progress"
                          ? "bg-yellow-400 text-white"
                          : currentCommand.status === "done"
                          ? "bg-blue-500 text-white"
                          : "bg-slate-500 text-white")
                      }
                    >
                      {currentCommand.status === "pending"
                        ? "⏳ En attente"
                        : currentCommand.status === "in_progress"
                        ? "🍹 En préparation"
                        : currentCommand.status === "done"
                        ? "✅ Récupéré"
                        : currentCommand.status}
                    </div>
                  )}


                    <Tabs defaultValue="game1" className="w-full mt-6">
                      <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="game1">Solo</TabsTrigger>
                        <TabsTrigger value="game2">1v1</TabsTrigger>
                      </TabsList>
                      <TabsContent value="game1">
                        <WhackAMole />
                      </TabsContent>
                      <TabsContent value="game2">
                        <InfiniteTicTacToe />
                      </TabsContent>
                    </Tabs>
                  </div>


              </CardContent>
            </Card>

          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Notre Menu</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {items.map((item) => (
                    <Card key={item.id} className="bg-white/80 backdrop-blur-sm border-orange-200 hover:shadow-lg transition-shadow">
                      <CardContent className="p-4">
                        {item.image && (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-32 object-cover rounded-md mb-3"
                          />
                        )}
                        <h3 className="font-semibold text-lg text-gray-800">{item.name}</h3>
                        <p className="text-2xl font-bold text-orange-600 mb-2">{item.price}€</p>
                        {item.description && (
                          <p className="text-gray-600 text-sm mb-3">{item.description}</p>
                        )}
                        <Button
                          onClick={() => addToCart(item)}
                          className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Ajouter au panier
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-1">
                <Card className="bg-white/80 backdrop-blur-sm border-orange-200 sticky top-4">
                  <CardHeader>
                    <CardTitle>Votre Commande</CardTitle>
                    <CardDescription>
                      {cart.length} item{cart.length !== 1 ? 's' : ''} dans votre panier
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="clientName">Votre nom</Label>
                      <Input
                        id="clientName"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Ex: Léo"
                      />
                      <Label htmlFor="phoneNumber">Téléphone</Label>
                      <Input
                        id="phoneNumber"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="Ex: +1 234 567 8901"
                      />
                    </div>
                    {lastCommand?.items?.length > 0 && (
                      <Button
                        variant="outline"
                        className="w-full mb-2"
                        onClick={() => {
                          const map = new Map<number, CartItem>();
                          for (const item of lastCommand.items) {
                            const existing = items.find(i => i.id === item.id || i.id === item.item_id);
                            if (existing) {
                              map.set(item.item_id, {
                                ...existing,
                                quantity: item.quantity,
                              });
                            }
                          }
                          setCart([...map.values()]);
                          toast({ title: "Commande rechargée dans le panier." });
                        }}
                      >
                        Recommander la même chose
                      </Button>
                    )}

                    {cart.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">Votre panier est vide</p>
                    ) : (
                      <>
                        <div className="space-y-3">
                          {cart.map((item) => (
                            <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                              <div>
                                <p className="font-medium">{item.name}</p>
                                <p className="text-sm text-gray-600">{item.price}€ × {item.quantity}</p>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => removeFromCart(item.id)}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-8 text-center">{item.quantity}</span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => addToCart(item)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="pt-3 border-t border-orange-200">
                          <div className="flex items-center justify-between mb-4">
                            <p className="text-lg font-bold">Total</p>
                            <p className="text-xl font-bold text-orange-600">
                              {getTotalPrice().toFixed(2)}€
                            </p>
                          </div>

                          <Button
                            onClick={handleOrder}
                            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                            disabled={isLoading}
                          >
                            {isLoading ? "Envoi..." : "Commander"}
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
              )}
          </TabsContent>

          <TabsContent value="music" className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border-orange-200">
              <CardHeader>
                <CardTitle>Suggérer une musique</CardTitle>
                <CardDescription>Proposez une musique pour la playlist du bar</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="trackName">Nom de la musique *</Label>
                    <Input
                      id="trackName"
                      value={newTrackName}
                      onChange={(e) => setNewTrackName(e.target.value)}
                      placeholder="Ex: Bohemian Rhapsody - Queen"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="spotifyUrl">Lien Spotify (optionnel)</Label>
                    <Input
                      id="spotifyUrl"
                      value={newSpotifyUrl}
                      onChange={(e) => setNewSpotifyUrl(e.target.value)}
                      placeholder="https://open.spotify.com/track/..."
                    />
                  </div>
                </div>
                <Button
                  onClick={handleSuggestTrack}
                  className="mt-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Suggérer
                </Button>
              </CardContent>
            </Card>

            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Playlist Actuelle</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tracks
                  .sort((a, b) => b.votes - a.votes)
                  .map((track) => (
                    <Card key={track.id} className="bg-white/80 backdrop-blur-sm border-orange-200 hover:shadow-lg transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="font-semibold text-gray-800 leading-tight flex-1">
                            {track.track_name}
                          </h3>
                          <Badge variant="outline" className="ml-2 border-orange-300 text-orange-700">
                            {track.votes} votes
                          </Badge>
                        </div>
                        <Button
                          onClick={() => handleVote(track.id)}
                          className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                          size="sm"
                        >
                          <ThumbsUp className="h-4 w-4 mr-2" />
                          Voter
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
        {showCodeModal && (
          <div
            className="fixed inset-0 z-50 flex flex-col justify-center items-center text-center"
            style={{ backgroundColor: pickupColor || "#22c55e" }}
          >
            <h2 className="text-4xl font-bold mb-8 text-black">Votre code de retrait</h2>
            <div
              className="text-6xl font-extrabold px-10 py-6 rounded-2xl shadow-xl mb-8 bg-black text-white"
            >
              {pickupCode}
            </div>
            <Button
              onClick={() => setShowCodeModal(false)}
              className="text-lg font-semibold bg-black text-white"
            >
              Fermer
            </Button>
          </div>
        )}


      </main>
    </div>
  );
};


export default PublicBar;

