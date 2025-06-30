
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/hooks/use-toast";
import { Music, ThumbsUp, Plus, ExternalLink } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Trash2 } from "lucide-react"

interface Track {
  id: number;
  track_name: string;
  spotify_url?: string;
  votes: number;
  suggested_by?: string;
}

const getSpotifyToken = async () => {
  const clientId = "69b62c73c32e4e18bc6e3e8a8bd96171";
  const clientSecret = "91af69e5066948f5acf772ee116446d2";
  const credentials = btoa(`${clientId}:${clientSecret}`);

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await res.json();
  return data.access_token;
};

const fetchTracksFromPlaylist = async (playlistId: string) => {
  const token = await getSpotifyToken();
  const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=20`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.items
    .filter((i) => i.track)
    .map((i) => i.track)
    .filter((t) => t); // filtre les éventuels null
};


const mapTrackToDbFormat = (track: any) => ({
  name: track.name,
  artist_name: track.artists?.[0]?.name || "",
  album_name: track.album?.name || "",
  spotify_url: track.external_urls?.spotify || "",
  image_url: track.album?.images?.[0]?.url || "",
  spotify_id: track.id,
});


const searchSpotifyPlaylists = async (query: string) => {
  const token = await getSpotifyToken();
  const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=playlist&limit=5`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json();
  console.log(data)
  return data.playlists.items.filter((item) => item !== null);
};

const searchSpotifyTracks = async (query: string) => {
  const token = await getSpotifyToken();
  const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json();
  return data.tracks.items.filter((item) => item !== null);
};

const addTrackToPlaylist = async (  barId: string,
  userId: string,
  tracks: any[]
) => {
  await fetch(`https://kpsule.app/api/bars/${barId}/playlist/add`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": userId,
    },
    body: JSON.stringify({ tracks }),
  });
};

const deleteTrack = async (barId: string, userId: string, trackId: string) => {
  await fetch(`https://kpsule.app/api/bars/${barId}/playlist/${trackId}`, {
    method: "DELETE",
    headers: { "x-user-id": userId },
  });
};

const deleteAllTracks = async (barId: string, userId: string) => {
  await fetch(`https://kpsule.app/api/bars/${barId}/playlist`, {
    method: "DELETE",
    headers: { "x-user-id": userId },
  });
};

const PlaylistManager = () => {
  const { token, userId, barId } = useAuthStore();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [playlistResults, setPlaylistResults] = useState<any[]>([]);
  const [trackResults, setTrackResults] = useState<any[]>([]);
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
          "Content-Type": "application/json",
          'x-user-id': userId,
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
    const delay = setTimeout(() => {
      if (formData.track_name.length > 2) {
        Promise.all([
          searchSpotifyTracks(formData.track_name),
          searchSpotifyPlaylists(formData.track_name),
        ]).then(([tracks, playlists]) => {
          setTrackResults(tracks);
          setPlaylistResults(playlists);
        });
      } else {
        setTrackResults([]);
        setPlaylistResults([]);
      }
    }, 500);
    return () => clearTimeout(delay);
  }, [formData.track_name]);
  

  useEffect(() => {
    fetchPlaylist();
  }, []);
  

  const handleAddTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !barId || !userId) return;
  
    try {
      const track = {
        name: formData.track_name,
        spotify_url: formData.spotify_url || "",
      };
      await addTrackToPlaylist(barId, userId, [track]);
  
      toast({
        title: "Succès",
        description: "Musique ajoutée à la playlist",
      });
      setFormData({ track_name: "", spotify_url: "" });
      setShowAddForm(false);
      fetchPlaylist();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter la musique",
        variant: "destructive",
      });
    }
  };
  

  return (
    <>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gestion de la Playlist</h2>
          <p className="text-gray-600">Gérez les musiques et consultez les votes de vos clients</p>
        </div>
        <Button
          variant="destructive"
          className="flex items-center gap-2 px-4 py-2 text-white bg-red-600 hover:bg-red-700"
          onClick={async () => {
            if (confirm("Supprimer toute la playlist ?")) {
              await deleteAllTracks(barId, userId);
              toast({ title: "🧹 Playlist vidée" });
              fetchPlaylist();
            }
          }}
        >
          <Trash2 className="w-4 h-4" />
          Supprimer toute la playlist
        </Button>

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
            <CardDescription>Ajoutez des musiques à votre playlist</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddTrack} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="track_name">Que cherchez-vous ?</Label>
                <Input
                  id="track_name"
                  value={formData.track_name}
                  onChange={(e) => setFormData({ ...formData, track_name: e.target.value })}
                  placeholder="Ex: Bohemian Rhapsody - Queen"
                  required
                />
              </div>

              {(trackResults.length > 0 || playlistResults.length > 0) && (
                <div className="space-y-2 border rounded p-2 bg-white max-h-72 overflow-y-auto mt-2">
                  {trackResults.map((track) => (
                    <div
                      key={track.id}
                      className="flex items-center justify-between hover:bg-orange-100 rounded px-2 py-1 group cursor-pointer"
                      onClick={() => setPreviewUrl(track.external_urls.spotify)}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={track.album?.images?.[2]?.url || track.album?.images?.[0]?.url}
                          alt={track.name}
                          className="w-10 h-10 rounded"
                        />
                        <div>
                          <p className="font-medium text-sm">{track.name}</p>
                          <p className="text-xs text-gray-500">{track.artists.map((a) => a.name).join(", ")}</p>
                        </div>
                      </div>
                      <Plus
                        className="h-4 w-4 text-green-600 opacity-0 group-hover:opacity-100 transition"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await addTrackToPlaylist(barId, userId, [mapTrackToDbFormat(track)]);
                          toast({ title: "✅ Ajouté à la playlist" });
                          fetchPlaylist();
                        }}
                      />

                    </div>
                  ))}

                  {playlistResults.map((pl) => (
                    <div
                      key={pl.id}
                      className="flex items-center justify-between hover:bg-orange-100 rounded px-2 py-1 group cursor-pointer"
                      onClick={() => setPreviewUrl(pl.external_urls.spotify)}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={pl.images?.[0]?.url}
                          alt={pl.name}
                          className="w-10 h-10 rounded"
                        />
                        <div>
                          <p className="font-medium text-sm">{pl.name}</p>
                          <p className="text-xs text-gray-500">Playlist – par {pl.owner.display_name}</p>
                        </div>
                      </div>
                      <Plus
                      className="h-4 w-4 text-green-600 opacity-0 group-hover:opacity-100 transition"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const tracks = await fetchTracksFromPlaylist(pl.id);
                        const mapped = tracks.map(mapTrackToDbFormat);
                        await addTrackToPlaylist(barId, userId, mapped);
                        toast({ title: "✅ Playlist ajoutée" });
                        fetchPlaylist();
                      }}                      
                    />
                    </div>
                  ))}
                </div>
              )}



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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tracks.map((track) => (
            <Card key={track.id} className="bg-white/80 backdrop-blur-sm border-orange-200 hover:bg-orange-100 transition-shadow">
              <CardContent className="p-3 flex items-center gap-3">
                <img
                  src={track.image_url || "https://via.placeholder.com/40"}
                  alt={track.track_name}
                  className="w-12 h-12 rounded"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{track.track_name}</p>
                  <p className="text-xs text-gray-500">{track.artist_name}</p>
                </div>
                <div className="flex items-end justify-between">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    await deleteTrack(barId, userId, track.id);
                    toast({ title: "🎵 Supprimée avec succès" });
                    fetchPlaylist();
                  }}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>

                  {track.spotify_url && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPreviewUrl(track.spotify_url)}
                    >
                      <ExternalLink className="h-4 w-4 text-green-600" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

      )}
    </div>
    <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
      <DialogContent className="w-full max-w-xl p-0 overflow-hidden">
        {previewUrl && (
          <iframe
            src={`https://open.spotify.com/embed${new URL(previewUrl).pathname}`}
            width="100%"
            height="380"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
        )}
      </DialogContent>
    </Dialog>
    </>
    
  );
};

export default PlaylistManager;
