import { Dialog, DialogTrigger, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const ItemsModal = ({ items }: { items: any[] }) => (
  <Dialog>
    <DialogTrigger asChild>
      <Button>Voir les stocks</Button>
    </DialogTrigger>
    <DialogContent className="max-w-lg">
      <DialogTitle>Stocks du Point de Vente</DialogTitle>
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        {items.map((item) => (
          <div key={item.id} className="border p-2 rounded-md bg-white/70">
            <div className="font-semibold">{item.name}</div>
            <div className="text-sm text-gray-600">
              Quantité : {item.pos_settings?.[0]?.stock_quantity ?? "?"}
            </div>
          </div>
        ))}
      </div>
    </DialogContent>
  </Dialog>
);

export default ItemsModal;
