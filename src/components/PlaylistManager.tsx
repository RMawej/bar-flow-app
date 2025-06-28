
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/hooks/use-toast";
import { Music, ThumbsUp, Plus, ExternalLink } from "lucide-react";

interface Track {
  id: number;
  track_name: string;
  spotify_url?: string;
  votes: number;
  suggested_by?: string;
}

const PlaylistManager = () => {
  const { token, barId } = useAuthStore();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    track_name: "",
    spotify_url: "",
  });

  const fetchPlaylist = async () => {
    if (!token || !barId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`https://kpsule.app/api/bars/${barId}/playlist`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setTracks(data);
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la playlist:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger la playlist",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaylist();
    // Refresh playlist every 30 seconds
    const interval = setInterval(fetchPlaylist, 30000);
    return () => clearInterval(interval);
  }, [token, barId]);

  const handleAddTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !barId) return;

    try {
      const response = await fetch(`https://kpsule.app/api/bars/${barId}/playlist/suggest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          track_name: formData.track_name,
          spotify_url: formData.spotify_url || undefined,
        }),
      });

      if (response.ok) {
        toast({
          title: "Succès",
          description: "Musique ajoutée à la playlist",
        });
        setFormData({ track_name: "", spotify_url: "" });
        setShowAddForm(false);
        fetchPlaylist();
      } else {
        throw new Error('Erreur lors de l\'ajout');
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter la musique",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gestion de la Playlist</h2>
          <p className="text-gray-600">Gérez les musiques et consultez les votes de vos clients</p>
        </div>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
        >
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une musique
        </Button>
      </div>

      {showAddForm && (
        <Card className="bg-white/80 backdrop-blur-sm border-orange-200">
          <CardHeader>
            <CardTitle>Nouvelle Musique</CardTitle>
            <CardDescription>Ajoutez une musique à votre playlist</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddTrack} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="track_name">Nom de la musique *</Label>
                <Input
                  id="track_name"
                  value={formData.track_name}
                  onChange={(e) => setFormData({ ...formData, track_name: e.target.value })}
                  placeholder="Ex: Bohemian Rhapsody - Queen"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="spotify_url">Lien Spotify (optionnel)</Label>
                <Input
                  id="spotify_url"
                  value={formData.spotify_url}
                  onChange={(e) => setFormData({ ...formData, spotify_url: e.target.value })}
                  placeholder="https://open.spotify.com/track/..."
                />
              </div>
              <div className="flex space-x-2">
                <Button type="submit" className="bg-green-600 hover:bg-green-700">
                  Ajouter
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddForm(false)}
                >
                  Annuler
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
          <p className="text-gray-600 mt-2">Chargement de la playlist...</p>
        </div>
      ) : tracks.length === 0 ? (
        <Card className="bg-white/80 backdrop-blur-sm border-orange-200">
          <CardContent className="p-8 text-center">
            <Music className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">Aucune musique</h3>
            <p className="text-gray-500">Ajoutez des musiques à votre playlist ou attendez les suggestions de vos clients</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tracks
            .sort((a, b) => b.votes - a.votes)
            .map((track) => (
              <Card key={track.id} className="bg-white/80 backdrop-blur-sm border-orange-200 hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800 leading-tight">{track.track_name}</h3>
                      {track.suggested_by && (
                        <p className="text-sm text-gray-500 mt-1">Suggéré par {track.suggested_by}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-1 bg-orange-100 px-2 py-1 rounded-full">
                      <ThumbsUp className="h-4 w-4 text-orange-600" />
                      <span className="text-sm font-semibold text-orange-700">{track.votes}</span>
                    </div>
                  </div>
                  
                  {track.spotify_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-green-300 text-green-700 hover:bg-green-50"
                      onClick={() => window.open(track.spotify_url, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3 mr-2" />
                      Écouter sur Spotify
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
};

export default PlaylistManager;
