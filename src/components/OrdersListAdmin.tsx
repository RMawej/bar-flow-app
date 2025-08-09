import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { ShoppingCart } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const OrdersListAdmin = () => {
  const { barId, userId } = useAuthStore();
  const [orders, setOrders] = useState([]);
  const [posList, setPosList] = useState([]);
  const [selectedPos, setSelectedPos] = useState(null);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    const sockets: WebSocket[] = [];
  
    fetch(`https://kpsule.app/api/bars/${barId}/pos`, {
      headers: { "x-user-id": userId }
    })
      .then(res => res.json())
      .then(async data => {
        setPosList(data.points_of_sale);
  
        // 1️⃣ historique
        const ordersRes = await fetch(`https://kpsule.app/api/bars/${barId}/commands`, {
          headers: { "x-user-id": userId }
        });
        const datab = await ordersRes.json();
        console.log("📥 commandes :", datab);
        if (ordersRes.ok) setOrders(datab);

  
        // 2️⃣ WebSocket par PdV
        data.points_of_sale.forEach((pos: { id: string; name: string }) => {
          const ws = new WebSocket(`wss://kpsule.app/ws?pos_id=${pos.id}&token=admin-${userId}`);
          sockets.push(ws);
  
          ws.onopen = () => {
            console.log(`✅ Connecté à ${pos.name} (${pos.id})`);
          };
  
          ws.onmessage = (event) => {
            console.log(`📩 Message WS de ${pos.name} (${pos.id}):`, event.data);
            const msg = JSON.parse(event.data);
            console.log("📦 Message parsé :", msg);
  
            if (msg.type === "new_order") {
              const completeOrder = {
                ...msg.order,
                pos_id: pos.id,
                pos_name: pos.name,
              };
              setOrders(prev => [completeOrder, ...prev]);
            }
            else if (msg.type === "command_update") {
              const updatedCommand = {
                ...msg.command,
                pos_id: pos.id,
                pos_name: pos.name,
              };
              setOrders(prev =>
                prev.map(o => o.id === updatedCommand.id ? { ...o, status: updatedCommand.status } : o)
              );
            }
          };
        });
      });
  
    return () => sockets.forEach(s => s.close());
  }, [barId, userId]);
  



  const filteredOrders = orders.filter(o => !selectedPos || o.pos_id === selectedPos);

  return (
    <div className="space-y-6">
      <Button onClick={() => setShowStats(true)} className="bg-orange-600 text-white">
        📊 Voir les stats
      </Button>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Toutes les Commandes</h2>
          <p className="text-gray-600">Vue administrateur de toutes les commandes</p>
        </div>
        <Badge variant="outline" className="border-orange-300 text-orange-700">
          {filteredOrders.length} commande{filteredOrders.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setSelectedPos(null)} className="px-3 py-1 bg-orange-100 rounded">Tous</button>
        {posList.map(pos => (
          <button
            key={pos.id}
            onClick={() => setSelectedPos(pos.id)}
            className={`px-3 py-1 rounded ${selectedPos === pos.id ? 'bg-orange-500 text-white' : 'bg-orange-100'}`}
          >
            {pos.name}
          </button>
        ))}
      </div>
      {showStats && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 w-full max-w-xl relative">
            <button
              className="absolute top-2 right-4 text-gray-500 hover:text-gray-800 text-xl"
              onClick={() => setShowStats(false)}
            >
              ✕
            </button>

            <h2 className="text-xl font-bold mb-4 text-orange-600">Top 3 clients</h2>
            {(() => {
              const countMap = new Map();
              orders.forEach(o => {
                countMap.set(o.client_name, (countMap.get(o.client_name) || 0) + 1);
              });

              const sorted = [...countMap.entries()].sort((a, b) => b[1] - a[1]);
              const top3 = sorted.slice(0, 3);
              const max = Math.max(...[...countMap.values()], 1);

              return (
                <>
                  <ul className="mb-6 space-y-1">
                    {top3.map(([name, count], idx) => (
                      <li key={idx} className="text-gray-700">
                        {idx + 1}. <strong>{name}</strong> — {count} commande{count > 1 ? "s" : ""}
                      </li>
                    ))}
                  </ul>

                  <h3 className="font-semibold mb-2 text-gray-800">Histogramme des commandes</h3>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {[...countMap.entries()].map(([name, count]) => (
                      <div key={name}>
                        <div className="flex justify-between text-sm text-gray-600">
                          <span>{name}</span>
                          <span>{count}</span>
                        </div>
                        <div className="h-2 bg-orange-100 rounded overflow-hidden">
                          <div
                            className="h-full bg-orange-500"
                            style={{ width: `${(count / max) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}


      {filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">Aucune commande</h3>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredOrders.map(order => (
            <Card key={order.id} className="bg-white/80 border-orange-200">
              <CardHeader>
                <CardTitle>{order.client_name} ({order.pos_name})</CardTitle>
                <CardDescription>#{order.id} - {order.status}</CardDescription>
              </CardHeader>
              <CardContent>
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <p>{item.item_name} x{item.quantity}</p>
                    <p>{(item.price * item.quantity).toFixed(2)}$</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrdersListAdmin;
