
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Upload, Camera, FileText } from "lucide-react";

const MenuScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedItems, setScannedItems] = useState([]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        
        const response = await fetch('https://kpsule.app/api/scan-menu', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ image: base64 }),
        });

        if (response.ok) {
          const data = await response.json();
          setScannedItems(data);
          toast({
            title: "Scan réussi",
            description: `${data.length} items détectés dans votre menu`,
          });
        } else {
          throw new Error('Erreur lors du scan');
        }
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de scanner le menu",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Scanner de Menu</h2>
        <p className="text-gray-600">Uploadez une photo ou un PDF de votre menu pour détecter automatiquement les items</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-white/80 backdrop-blur-sm border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Camera className="h-5 w-5 text-orange-600" />
              <span>Upload Image</span>
            </CardTitle>
            <CardDescription>
              Prenez une photo de votre menu ou uploadez une image existante
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-orange-300 rounded-lg p-8 text-center hover:border-orange-400 transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="image-upload"
                disabled={isScanning}
              />
              <label htmlFor="image-upload" className="cursor-pointer">
                <Upload className="h-12 w-12 text-orange-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Cliquez pour sélectionner une image</p>
                <p className="text-sm text-gray-400">PNG, JPG jusqu'à 10MB</p>
              </label>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-orange-600" />
              <span>Upload PDF</span>
            </CardTitle>
            <CardDescription>
              Uploadez un menu au format PDF pour extraction automatique
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-orange-300 rounded-lg p-8 text-center hover:border-orange-400 transition-colors">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
                id="pdf-upload"
                disabled={isScanning}
              />
              <label htmlFor="pdf-upload" className="cursor-pointer">
                <FileText className="h-12 w-12 text-orange-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Cliquez pour sélectionner un PDF</p>
                <p className="text-sm text-gray-400">PDF jusqu'à 10MB</p>
              </label>
            </div>
          </CardContent>
        </Card>
      </div>

      {isScanning && (
        <Card className="bg-white/80 backdrop-blur-sm border-orange-200">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Analyse en cours...</h3>
            <p className="text-gray-600">Notre IA analyse votre menu pour détecter les items et leurs prix</p>
          </CardContent>
        </Card>
      )}

      {scannedItems.length > 0 && (
        <Card className="bg-white/80 backdrop-blur-sm border-orange-200">
          <CardHeader>
            <CardTitle>Items détectés</CardTitle>
            <CardDescription>
              Vérifiez et confirmez les items détectés avant de les ajouter à votre menu
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {scannedItems.map((item: any, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-semibold">{item.name}</h4>
                    <p className="text-gray-600">{item.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-orange-600">{item.price}€</p>
                    <Button size="sm" className="mt-2">
                      Ajouter
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MenuScanner;
