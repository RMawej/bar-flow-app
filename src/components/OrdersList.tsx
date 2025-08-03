import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/hooks/use-toast";
import { ShoppingCart, Clock, User } from "lucide-react";

interface Order {
  id: number;
  client_name: string;
  items: Array<{
    item_id: number;
    item_name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  status: string;
  created_at: string;
  pickup_code?: string;
  pickup_color?: string;
  pos_name: string;
}
const OrdersList = ({
  filter,
  pos_id,
  pos_token,
}: {
  filter: "all" | "done" | "not_done";
  pos_id?: string;
  pos_token?: string;
}) => {
  const { token, barId, userId } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchOrders = async () => {
    let url: string;
    let headers: Record<string, string> = {};

    if (pos_token && pos_id) {
      url = `https://kpsule.app/api/pos/${pos_id}/commands`;
      headers["token"] = pos_token;
    } else {
      url = `https://kpsule.app/api/bars/${barId}/commands`;
      headers["x-user-id"] = userId;
    }

    setIsLoading(true);
    try {
      const response = await fetch(url, { headers });

      if (response.ok) {
        const data = await response.json();
        setOrders(data);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des commandes:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les commandes",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [token, barId]);

  useEffect(() => {
    if (!pos_id || !pos_token) return;
    const socket = new WebSocket(`wss://kpsule.app/ws?pos_id=${pos_id}&token=${pos_token}`);
    socket.onopen = () => console.log("✅ WebSocket connecté dans OrdersList");

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "new_order") {
        const newOrder = message.order;
        console.log("🆕 Nouvelle commande reçue :", newOrder); // 👈 log ici
        setOrders((prev) => [newOrder, ...prev]);
      }
      if (message.type === "command_update") {
        const updated = message.command;
        setOrders((prev) =>
          prev.map((order) =>
            order.id === updated.id ? { ...order, status: updated.status } : order
          )
        );
      }
    };
  
    return () => socket.close();
  }, [pos_id, pos_token]);
  

  const filteredOrders = orders.filter((order) => {
    if (filter === "done") return order.status === "done";
    if (filter === "not_done") return order.status !== "done";
    return true;
  });
  
  
  const getStatusColor = (status: string | undefined) => {
    if (!status) return "bg-gray-100 text-gray-800";
    switch (status.toLowerCase()) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "ready":
        return "bg-green-100 text-green-800";
      case "done":
        return "bg-gray-300 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };
  

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Commandes Clients</h2>
          <p className="text-gray-600">Gérez les commandes reçues de vos clients</p>
        </div>
        <Badge variant="outline" className="border-orange-300 text-orange-700">
          {filteredOrders.length} commande{filteredOrders.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
          <p className="text-gray-600 mt-2">Chargement des commandes...</p>
        </div>
      ) : orders.length === 0 ? (
        <Card className="bg-white/80 backdrop-blur-sm border-orange-200">
          <CardContent className="p-8 text-center">
            <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">Aucune commande</h3>
            <p className="text-gray-500">Les commandes de vos clients apparaîtront ici</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {filteredOrders.map((order) => (
            <div className="relative" key={order.id}>
              <Card className="bg-white/80 backdrop-blur-sm border-orange-200 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                  {order.pos_name && (
                    <Badge className="absolute top-3 right-3 bg-orange-100 text-orange-800 border border-orange-300">
                      {order.pos_name}
                    </Badge>
                  )}

                    <CardTitle className="flex items-center space-x-2">
                      <User className="h-5 w-5 text-orange-600" />
                      <span>{order.client_name}</span>
                    </CardTitle>
                    <div
                      onClick={async () => {
                        const next = {
                          pending: "in_progress",
                          in_progress: "ready",
                          ready: "done",
                          done: "pending",
                        }[order.status] || "pending";

                        try {
                          const url = pos_token
                            ? `https://kpsule.app/api/pos/${pos_id}/commands/${order.id}/status`
                            : `https://kpsule.app/api/bars/${barId}/commands/${order.id}/status`;

                          const headers: Record<string, string> = {
                            "Content-Type": "application/json",
                            ...(pos_token ? { token: pos_token } : { "x-user-id": userId }),
                          };

                          const res = await fetch(url, {
                            method: "POST",
                            headers,
                            body: JSON.stringify({ status: next }),
                          });

                          if (res.ok) {
                            setOrders((prev) =>
                              prev.map((o) =>
                                o.id === order.id ? { ...o, status: next } : o
                              )
                            );
                          }
                        } catch (e) {
                          toast({
                            title: "Erreur",
                            description: "Impossible de changer le statut",
                            variant: "destructive",
                          });
                        }
                      }}
                      className={`w-1/3 flex items-center justify-center ${getStatusColor(order.status)} rounded-md ml-4 cursor-pointer`}
                    >
                      {order.status}
                    </div>

                  </div>
                  <CardDescription className="flex items-center space-x-2">
                    <Clock className="h-4 w-4" />
                    <span>{formatTime(order.created_at)}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                  {order.items?.map((item, index) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <div>
                          <p className="font-medium">{item.item_name}</p>
                          <p className="text-sm text-gray-600">Quantité: {item.quantity}</p>
                        </div>
                        <p className="font-semibold text-orange-600">
                          {(item.price * item.quantity).toFixed(2)}$ CA
                        </p>
                      </div>
                    ))}
                    <div className="pt-3 border-t border-orange-200">
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-bold">Total</p>
                        <p className="text-xl font-bold text-orange-600">{order.total.toFixed(2)}$ CA</p>
                      </div>
                    </div>
                    {order.pickup_code && order.status !== "ready" && (
                      <p className="text-sm text-gray-700 mt-2">Code retrait : <strong>{order.pickup_code}</strong></p>
                    )}
                  </div>
                </CardContent>
              </Card>

            {order.status === "ready" && order.pickup_code && (
              <div
                className="absolute inset-0 p-6 text-white text-center cursor-pointer flex flex-col justify-center rounded-md"
                style={{ backgroundColor: order.pickup_color || "#000000cc" }}
                onClick={async () => {
                  try {
                    const url = pos_token
                      ? `https://kpsule.app/api/pos/${pos_id}/commands/${order.id}/status`
                      : `https://kpsule.app/api/bars/${barId}/commands/${order.id}/status`;

                    const headers: Record<string, string> = {
                      "Content-Type": "application/json",
                      ...(pos_token ? { token: pos_token } : { "x-user-id": userId }),
                    };

                    const res = await fetch(url, {
                      method: "POST",
                      headers,
                      body: JSON.stringify({ status: "done" }),
                    });

                    if (res.ok) {
                      setOrders((prev) =>
                        prev.map((o) =>
                          o.id === order.id ? { ...o, status: "done" } : o
                        )
                      );
                    }
                  } catch (e) {
                    toast({
                      title: "Erreur",
                      description: "Impossible de passer la commande en done",
                      variant: "destructive",
                    });
                  }
                }}
              >
                <div className="text-5xl font-bold mb-4">{order.pickup_code}</div>
                <div className="space-y-2 text-lg">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-white/90">
                      <span>{item.item_name} × {item.quantity}</span>
                      <span>{(item.price * item.quantity).toFixed(2)}$</span>
                    </div>
                  ))}
                </div>
              </div>
            )}


            </div>

          ))}
        </div>
      )}
    </div>
  );
};

export default OrdersList;
