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
}

const OrdersList = () => {
  const { token, barId, userId } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchOrders = async () => {
    if (!token || !barId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`https://kpsule.app/api/bars/${barId}/commands`, {
        headers: {
          'x-user-id': userId,
        },
      });

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
    if (!barId) return;
    const socket = new WebSocket(`wss://kpsule.app/ws/${barId}`);
  
    socket.onmessage = (event) => {
      const newOrder = JSON.parse(event.data);
      setOrders((prev) => [newOrder, ...prev]);
    };
  
    return () => socket.close();
  }, [barId]);
  

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "preparing":
        return "bg-blue-100 text-blue-800";
      case "ready":
        return "bg-green-100 text-green-800";
      case "delivered":
        return "bg-gray-100 text-gray-800";
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
          {orders.length} commande{orders.length !== 1 ? "s" : ""}
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
          {orders.map((order) => (
            <Card key={order.id} className="bg-white/80 backdrop-blur-sm border-orange-200 hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <User className="h-5 w-5 text-orange-600" />
                    <span>{order.client_name}</span>
                  </CardTitle>
                  <Badge className={getStatusColor(order.status)}>
                    {order.status}
                  </Badge>
                </div>
                <CardDescription className="flex items-center space-x-2">
                  <Clock className="h-4 w-4" />
                  <span>{formatTime(order.created_at)}</span>
                  <span>• Commande #{order.id}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {order.items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="font-medium">{item.item_name}</p>
                        <p className="text-sm text-gray-600">Quantité: {item.quantity}</p>
                      </div>
                      <p className="font-semibold text-orange-600">
                        {(item.price * item.quantity).toFixed(2)}€
                      </p>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-orange-200">
                    <div className="flex items-center justify-between">
                      <p className="text-lg font-bold">Total</p>
                      <p className="text-xl font-bold text-orange-600">{order.total.toFixed(2)}€</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrdersList;
