import { useState, useRef, useEffect } from "react";
import OrdersList from "@/components/OrdersList";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useParams } from "react-router-dom";
import ItemsModal from "@/components/ItemsModal"; // ajuste le chemin si besoin
import CreateOrderModal from "@/components/CreateOrderModal";

const BarTender = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [posToken, setPosToken] = useState<string | null>(null);
  const [filterDone, setFilterDone] = useState<"all" | "done" | "not_done">("all");
  const { pos_id } = useParams();
  const [posName, setPosName] = useState<string | null>(null);
  const [digits, setDigits] = useState(["", "", "", ""]);
  const inputsRef = useRef<HTMLInputElement[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [barId, setBarId] = useState<string | null>(null);

  useEffect(() => {
    if (!pos_id) return;
    fetch(`https://kpsule.app/api/public/pos/${pos_id}`)
      .then(res => res.json())
      .then(data => {
        console.log("✅ Nom du Point de Vente récupéré :", data);
        if (data?.name) setPosName(data.name);
        if (data?.bar_id) setBarId(data.bar_id);
      })
      .catch(err => console.error("Erreur récupération nom PdV", err));
  }, [pos_id]);

  useEffect(() => {
    if (!isAuthorized || !posToken || !pos_id) return;

    fetch(`https://kpsule.app/api/pos/${pos_id}/items`, {
      headers: { token: posToken },
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("✅ Items récupérés :", pos_id, data.items);
        setItems(data.items);
      })
      .catch((err) => console.error("❌ Erreur chargement items", err));
  }, [isAuthorized, posToken, pos_id]);




  useEffect(() => {
    if (!isAuthorized || !posToken || !pos_id) return;
    const ws = new WebSocket(
      `wss://kpsule.app/ws?pos_id=${pos_id}&token=${posToken}`
    );    
  
    ws.onopen = () => {
      console.log("✅ WebSocket connecté (barman)");
    };
  
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("📦 Message WebSocket reçu :", data);
  
      // Optionnel : notifier ou recharger les commandes si besoin
      toast({
        title: "Nouvelle commande !",
        description: "Une commande vient d'être passée 🍸",
      });
    };
  
    ws.onerror = (err) => {
      console.error("❌ WebSocket erreur :", err);
    };
  
    ws.onclose = () => {
      console.warn("🔌 WebSocket fermé");
    };
  
    return () => ws.close();
  }, [isAuthorized, posToken, pos_id]);
  

  const handleDigitInput = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    if (!value) return;

    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);

    if (index < 3 && value) {
      inputsRef.current[index + 1]?.focus();
    }

    if (index === 3) {
      const passcode = newDigits.join("");
      handleLogin(passcode);
    }
  };

  const handleLogin = async (passcode: string) => {
    try {
      const res = await fetch(`https://kpsule.app/api/public/pos/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pos_id, passcode }),
      });

      if (!res.ok) throw new Error();

      const data = await res.json();
      setIsAuthorized(true);
      setPosToken(data.token);
    } catch {
      toast({
        title: "Erreur",
        description: "Code invalide",
        variant: "destructive",
      });
      setDigits(["", "", "", ""]);
      inputsRef.current[0]?.focus();
    }
  };

  if (!isAuthorized || !posToken) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 p-4">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">Connexion Barman</h1>
        {posName && (
          <h2 className="text-xl font-semibold text-center text-orange-700 mb-4">
            {posName}
          </h2>
        )}

        <div className="flex gap-3 mb-4">
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => (inputsRef.current[i] = el!)}
              type="password"
              maxLength={1}
              inputMode="numeric"
              className="w-12 h-12 text-center text-2xl border border-gray-300 rounded-lg shadow focus:outline-none"
              value={digit}
              onChange={(e) => handleDigitInput(e, i)}
            />
          ))}
        </div>

        <Button
          onClick={() => handleLogin(digits.join(""))}
          className="w-48 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
        >
          Se connecter
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 p-6">
      <h1 className="text-3xl font-bold mb-6 text-orange-700 text-center">
        Point de Vente {posName} – Commandes
      </h1>
      <CreateOrderModal items={items} barId={barId} posId={pos_id!} token={posToken!} />


      <div className="flex justify-center gap-4 mb-4">
        <Button variant={filterDone === "all" ? "default" : "outline"} onClick={() => setFilterDone("all")}>
          Toutes
        </Button>
        <Button variant={filterDone === "done" ? "default" : "outline"} onClick={() => setFilterDone("done")}>
          Terminées
        </Button>
        <Button variant={filterDone === "not_done" ? "default" : "outline"} onClick={() => setFilterDone("not_done")}>
          En cours
        </Button>
      </div>

      <div className="flex justify-center mb-6">
        <ItemsModal items={items} />
      </div>

      <OrdersList filter={filterDone} pos_id={pos_id} pos_token={posToken} />

    </div>
  );
};

export default BarTender;
