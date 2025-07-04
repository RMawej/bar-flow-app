import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import React from "react";
import { useState,useEffect } from "react";
import { Plus, Minus } from "lucide-react";

interface Item {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  description?: string;
}

interface Props {
  item: Item;
  onAdd: () => void;
}


const CardWrapper = ({ children }: { children: React.ReactNode }) => (
  <Card className="bg-white/80 backdrop-blur-sm border-orange-200 hover:shadow-lg transition-shadow">
    <CardContent className="p-4">{children}</CardContent>
  </Card>
);

const CardDesign1 = ({ item, onAdd }: Props) => (
  <CardWrapper>
    {item.image_url && <img src={item.image_url} alt={item.name} className="w-full h-32 object-cover rounded-md mb-3 transition-transform hover:scale-105" />}
    <h3 className="font-semibold text-lg text-gray-800 text-center">{item.name}</h3>
    <p className="text-2xl font-bold text-orange-600 text-center mb-2">{item.price}€</p>
    {item.description && <p className="text-gray-600 text-sm text-center mb-3">{item.description}</p>}
    <Button onClick={onAdd} className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">
      <Plus className="h-4 w-4 mr-2" /> Ajouter au panier
    </Button>
  </CardWrapper>
);

const CardDesign2 = ({ item, onAdd }: Props) => (
  <Card className="bg-orange-50 border-orange-300 rounded-3xl">
    <CardContent className="p-4 flex flex-col items-center">
      {item.image_url && <img src={item.image_url} alt={item.name} className="w-24 h-24 object-cover rounded-full mb-2" />}
      <h3 className="font-bold text-lg text-orange-800">{item.name}</h3>
      <p className="text-xl font-bold text-orange-600">{item.price}€</p>
      <Button onClick={onAdd} className="mt-4 rounded-full px-4 bg-orange-500 text-white">+
      </Button>
    </CardContent>
  </Card>
);

export const CardDesign3 = ({
    item,
    onAdd,
    onRemove,
    quantity,
  }: {
    item: Item;
    onAdd: () => void;
    onRemove: () => void;
    quantity: number;
  }) => {
    const [clickedOnce, setClickedOnce] = useState(false);
    useEffect(() => {
        if (quantity === 0 && clickedOnce) {
          setClickedOnce(false);
        }
      }, [quantity, clickedOnce]);
      
  
    const handleClick = () => {
      if (!clickedOnce) {
        setClickedOnce(true);
        onAdd();
      }
    };
  
    return (
      <div
        className="relative rounded-3xl overflow-hidden shadow-xl group hover:scale-[1.01] transition-transform duration-300 active:scale-[1.01]"
        onClick={handleClick}
      >
        {item.image_url && (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-48 object-cover brightness-60 group-hover:brightness-50 transition"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-black/80 flex flex-col justify-between text-white text-center pointer-events-none p-4">
        <div className="flex justify-between text-2xl font-bold">
            <span>{item.name}</span>
            <span>{item.price}€</span>
        </div>

        {quantity > 0 && (
            <div className="flex justify-center">
            <div className="flex items-center bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 gap-3 pointer-events-auto">
                <Button size="sm" variant="ghost" onClick={onRemove} className="text-white p-1">
                <Minus className="w-5 h-5" />
                </Button>
                <span className="text-xl">{quantity}</span>
                <Button size="sm" variant="ghost" onClick={onAdd} className="text-white p-1">
                <Plus className="w-5 h-5" />
                </Button>
            </div>
            </div>
        )}
        </div>


      </div>
    );
  };
  
  

const CardDesign4 = ({ item, onAdd }: Props) => (
  <Card className="flex gap-4 items-center p-4 bg-white/90">
    {item.image_url && <img src={item.image_url} alt={item.name} className="w-20 h-20 object-cover rounded-md" />}
    <div className="flex-1">
      <h3 className="font-semibold text-lg text-gray-800">{item.name}</h3>
      <p className="text-orange-600 font-bold">{item.price}€</p>
      {item.description && <p className="text-sm text-gray-600">{item.description}</p>}
    </div>
    <Button size="sm" onClick={onAdd}><Plus className="h-4 w-4" /></Button>
  </Card>
);

const CardDesign5 = ({ item, onAdd }: Props) => (
  <Card className="flex flex-col items-center bg-white/70 rounded-xl p-4">
    {item.image_url && <img src={item.image_url} alt={item.name} className="w-20 h-20 object-cover border border-orange-200 rounded-full mb-2" />}
    <h3 className="text-md font-medium mb-1 text-center">{item.name}</h3>
    <p className="text-sm text-gray-600 mb-2">{item.price}€</p>
    <Button variant="ghost" size="icon" onClick={onAdd} className="hover:scale-110 transition-transform">
      <Plus className="h-5 w-5 text-orange-600" />
    </Button>
  </Card>
);

export const renderItemCard = (
    item: Item,
    viewStyle: string,
    onAdd: () => void,
    onRemove: () => void,
    quantity: number
  ) => {  switch (viewStyle) {
    case "2": return <CardDesign2 item={item} onAdd={onAdd} />;
    case "3": return <CardDesign3 item={item} onAdd={onAdd} onRemove={onRemove} quantity={quantity} />;
    case "4": return <CardDesign4 item={item} onAdd={onAdd} />;
    case "5": return <CardDesign5 item={item} onAdd={onAdd} />;
    default: return <CardDesign1 item={item} onAdd={onAdd} />;
  }
};