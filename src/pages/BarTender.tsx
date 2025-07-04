import { useState } from "react";
import OrdersList from "@/components/OrdersList";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const BarTender = () => {
  const [passcode, setPasscode] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [filterDone, setFilterDone] = useState<"all" | "done" | "not_done">("all");
  const hardcodedPasscode = "1234"; // Hardcoded passcode, replace with API call later

  const handleLogin = () => {
    if (passcode === hardcodedPasscode) {
      setIsAuthorized(true);
    } else {
      toast({
        title: "Erreur",
        description: "Code invalide",
        variant: "destructive",
      });
    }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 p-4">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">Connexion Barman</h1>
        <Input
          type="password"
          maxLength={4}
          placeholder="Entrez le code à 4 chiffres"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          className="mb-4 text-center text-2xl tracking-widest"
        />
        <Button
          onClick={handleLogin}
          className="w-48 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
        >
          Se connecter
        </Button>
      </div>
    );
  }

  return (
    
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 text-center">Page Commandes Barman</h1>
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
      <OrdersList filter={filterDone}/>
    </div>
  );
};

export default BarTender;