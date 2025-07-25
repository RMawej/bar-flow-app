
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
import { renderItemCard } from "@/components/ItemCardVariants";
import { useRef } from "react";

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
  const [headerMessage, setHeaderMessage] = useState<string | null>(null);
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(null);

  const [posList, setPosList] = useState<{id:string; name:string; slug:string;}[]>([]);
  const [selectedPos, setSelectedPos] = useState<string | null>(null);
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
  const [viewStyle, setViewStyle] = useState<"1"| "3" | "5">("3");
  const orderSectionRef = useRef<HTMLDivElement | null>(null);
  const [showCartModal, setShowCartModal] = useState(false);



    
  const fetchItems = async (posId) => {
    try {
      // Construire l'URL avec pos_id en query param
      const url = new URL(`https://kpsule.app/api/bars/${barId}/items`);
      if (posId) url.searchParams.append('pos_id', posId);
  
      const response = await fetch(url.toString());
      if (response.ok) {
        const data = await response.json();
        setItems(data.items);
        console.log("Items reçus :", data.items);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des items:', error);
    }
  };

  useEffect(() => {
    if (!barId) return;
    fetch(`https://kpsule.app/api/public/bars/${barId}/pos`)
      .then(res => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then(data => setPosList(data.points_of_sale))
      .catch(err => console.error('Erreur chargement PDV public:', err));
  }, [barId]);

  useEffect(() => {
  if (!barId) return;

    fetch(`https://kpsule.app/api/public/bars/${barId}/header`)
      .then(res => res.json())
      .then(data => {
        setHeaderMessage(data.message);
        setHeaderImageUrl(data.image_url);
      })
      .catch(err => console.error("Erreur chargement header :", err));
  }, [barId]);

  
  // ↓ Sélectionner automatiquement le pos_id en query ou fallback sur le 1er
  useEffect(() => {
    const qp = new URLSearchParams(window.location.search).get('pos_id');
    if (qp && posList.find(p => p.id === qp)) {
      setSelectedPos(qp);
    } else if (posList.length) {
      setSelectedPos(posList[0].id);
    }
  }, [posList]);
  useEffect(() => {
    if (!barId || !selectedPos) return;
    fetchItems(selectedPos);
  }, [barId, selectedPos]);
  
  const fetchPlaylist = async () => {
    try {
      const url = new URL(`https://kpsule.app/api/public/bars/${barId}/playlist`);
      if (phoneNumber) url.searchParams.append("phone", phoneNumber);

      const response = await fetch(url.toString());
      if (response.ok) {
        const data = await response.json();
        setTracks([...data]);
      }
    } catch (error) {
      console.error("Erreur lors du chargement de la playlist:", error);
    }
  };



  useEffect(() => {
    if (!barId) return;

    const savedName = localStorage.getItem("client_name");
    const savedPhone = localStorage.getItem("phone_number");
    const savedId = localStorage.getItem("client_id");
    const lastCmd = localStorage.getItem("last_command");

    if (savedName) setClientName(savedName);
    if (savedPhone) setPhoneNumber(savedPhone);

    if (savedId) {
      console.log("Saved Client ID:", savedId);
      fetch(`https://kpsule.app/api/public/bars/${barId}/commands/by-client?client_id=${savedId}`)
        .then(res => res.json())
        .then(data => {
          if (data?.id) setCurrentCommand(data);
          if (data?.status === "done") {
            localStorage.removeItem("client_id");
            setLastCommand(data);
            setCurrentCommand(null);
          }
        });
    } else if (lastCmd) {
      try {
        setLastCommand(JSON.parse(lastCmd));
      } catch {}
    }
  }, [barId]);

  useEffect(() => {
    if (barId && phoneNumber) {
      fetchPlaylist();
    }
  }, [barId, phoneNumber]);



  useEffect(() => {
    if (!barId || !currentCommand) return;
  
    const clientId = localStorage.getItem("client_id");
    const socket = new WebSocket(`wss://kpsule.app/ws?client_id=${clientId}`);
  
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
        description: `Total : ${total.toFixed(2)}$ CA`,
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
      const clientId = crypto.subtle
        ? await crypto.subtle.digest("SHA-256", new TextEncoder().encode(phoneNumber))
            .then(hashBuffer => Array.from(new Uint8Array(hashBuffer))
              .map(b => b.toString(16).padStart(2, "0"))
              .join(""))
        : undefined;

      if (clientId) localStorage.setItem("client_id", clientId);

  
      const response = await fetch(`https://kpsule.app/api/bars/${barId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: clientName,
          phone: phoneNumber,
          pos_id: selectedPos,
          items: orderItems,
          total: getTotalPrice(),
          client_id: localStorage.getItem("client_id") || undefined
        })        
      });
  
      if (!response.ok) throw new Error("Erreur création session Stripe");
  
      const data = await response.json();
  
      // Sauvegarde infos pour affichage post-paiement
      localStorage.setItem("client_name", clientName);
      localStorage.setItem("phone_number", phoneNumber);
  
      // Redirige vers Stripe Checkout
      window.location.href = data.checkout_url;
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'initier le paiement",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  

  const handleVote = async (trackId: number) => {
    if (!phoneNumber) {
      toast({
        title: "Téléphone requis",
        description: "Veuillez saisir votre numéro de téléphone pour voter",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`https://kpsule.app/api/public/bars/${barId}/playlist/${trackId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber }),
      });

      if (response.ok) {
        toast({ title: "Vote enregistré", description: "Merci pour votre vote !" });
        fetchPlaylist(); // Refresh to show updated votes
      } else {
        const err = await response.json();
        toast({ title: "Erreur", description: err.detail || "Vote impossible", variant: "destructive" });
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
      <header className="relative h-48 overflow-hidden">
        {headerImageUrl ? (
          <img src={headerImageUrl} alt="Header" className="w-full h-full object-cover" />
        ) : (
          <div className="bg-white/80 w-full h-full" />
        )}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <h1 className="text-white text-xl font-bold text-center px-4">
            {headerMessage || "Commandez et votez pour la musique !"}
          </h1>
        </div>
      </header>

        <div className="fixed top-4 right-4 z-50 cursor-pointer" onClick={() => setShowCartModal(true)}>
          <div className="relative">
            <ShoppingCart className="h-10 w-10 text-orange-600" />
            {cart.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            )}
          </div>
        </div>

      <main className="container mx-auto px-4 py-8">
      {posList.length > 1 && (
          <div className="container mx-auto px-4 py-4">
            <div className="flex justify-center flex-wrap gap-3 backdrop-blur-sm rounded-lg p-3">
              {posList.map((pos) => (
                <Button
                  key={pos.id}
                  variant={pos.id === selectedPos ? "default" : "outline"}
                  size="sm"
                  className={
                    pos.id === selectedPos
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                      : "border-indigo-500 text-indigo-600 hover:bg-indigo-50"
                  }
                  onClick={() => setSelectedPos(pos.id)}
                >
                  {pos.name}
                </Button>
              ))}
            </div>
          </div>
        )}
        <Tabs defaultValue="menu" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 bg-white/60 backdrop-blur-sm">
            <TabsTrigger value="menu" className="flex items-center space-x-2">
              <ShoppingCart className="h-4 w-4" />
              <span>Commande</span>
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
                    <span>{(item.price * item.quantity).toFixed(2)}$ CA</span>
                  </div>
                );
              })}
                <div className="text-right font-bold text-orange-600">
                  Total : {currentCommand.total.toFixed(2)}$ CA
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
                  <div className="flex gap-2 mb-4">
                    {[].map(num => (
                      <Button
                        key={num}
                        variant={viewStyle === `${num}` ? "default" : "outline"}
                        onClick={() => setViewStyle(`${num}` as any)}
                      >
                        Design {num}
                      </Button>
                    ))}
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Notre Menu</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((item) => renderItemCard(
                  item,
                  viewStyle,
                  () => addToCart(item),
                  () => removeFromCart(item.id),
                  cart.find(i => i.id === item.id)?.quantity || 0
                ))}
                </div>
              </div>

              <div className="lg:col-span-1" ref={orderSectionRef}>
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
                                <p className="text-sm text-gray-600">{item.price}$ CA × {item.quantity}</p>
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
                              {getTotalPrice().toFixed(2)}$ CA
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

          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Playlist Actuelle</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {tracks.sort((a, b) => b.votes - a.votes).map((track) => (
                <div
                  key={track.id}
                  className="relative rounded-lg overflow-hidden shadow-md group hover:scale-[1.02] transition-transform cursor-pointer"
                  style={{
                    backgroundImage: `url(${track.image_url || "https://via.placeholder.com/300"})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    aspectRatio: "1 / 1",
                  }}
                >
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex justify-between items-center">
                    <div className="text-white">
                      <p className="font-semibold text-sm leading-tight">{track.track_name}</p>
                      <p className="text-xs text-gray-300">{track.artist_name}</p>
                    </div>
                    <button onClick={() => handleVote(track.id)}>
                      <ThumbsUp
                        className={`h-5 w-5 transition ${
                          track.already_voted ? "text-red-500" : "text-white/80"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

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

      {showCartModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="bg-white max-w-md w-full rounded-xl p-6 relative overflow-y-auto max-h-[90vh]">
            <button
              onClick={() => setShowCartModal(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-black"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold mb-4">Votre Commande</h2>

            {/* 👉 Contenu copié depuis la colonne droite */}
            <div className="space-y-4">
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

              {cart.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Votre panier est vide</p>
              ) : (
                <>
                  <div className="space-y-3 overflow-y-auto max-h-[50vh] pr-2">
                    {cart.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between py-2 border-b border-gray-100 gap-3"
                      >
                        {/* Image + nom/infos */}
                        <div className="flex items-center gap-3 flex-1">
                          {item.image_url && (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="w-12 h-12 object-cover rounded-md border"
                            />
                          )}
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-gray-600">
                              {item.price}$ CA × {item.quantity}
                            </p>
                          </div>
                        </div>

                        {/* Boutons + / - */}
                        <div className="flex items-center space-x-2">
                          <Button size="sm" variant="outline" onClick={() => removeFromCart(item.id)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center">{item.quantity}</span>
                          <Button size="sm" variant="outline" onClick={() => addToCart(item)}>
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
                        {getTotalPrice().toFixed(2)}$ CA
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
            </div>
          </div>
        </div>
      )}

    {!currentCommand && !showCartModal && (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-t border-orange-200 shadow-md px-4 py-3 flex justify-between items-center">
        <div className="text-lg font-bold text-orange-600">
          Total : {getTotalPrice().toFixed(2)}$ CA
        </div>
        <Button
          onClick={() => setShowCartModal(true)}
          className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
          disabled={isLoading}
        >
          Commander
        </Button>
      </div>
    )}
      </main>
    </div>
  );
};


export default PublicBar;

