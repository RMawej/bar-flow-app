import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/authStore";
import { ShoppingCart } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const OrdersListAdmin = () => {
  const { barId, userId } = useAuthStore();
  const [orders, setOrders] = useState([]);
  const [posList, setPosList] = useState([]);
  const [selectedPos, setSelectedPos] = useState(null);

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
        if (ordersRes.ok) setOrders(await ordersRes.json());
  
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
