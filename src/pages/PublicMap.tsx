import { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Icône utilisateur personnalisée : cercle bleu/blanc avec animation pulse
const userIcon = L.divIcon({
  html: `
    <div style="position: relative; width: 20px; height: 20px;">
      <div style="width: 100%; height: 100%; background: rgba(0,122,255,0.3); border: 3px solid white; border-radius: 50%; animation: ripple 1.5s infinite;"></div>
      <div style="position: absolute; top: 4px; left: 4px; width: 12px; height: 12px; background: #007AFF; border: 2px solid white; border-radius: 50%;"></div>
    </div>
    <style>
      @keyframes ripple {
        0% { transform: scale(0.7); opacity: 1; }
        100% { transform: scale(2); opacity: 0; }
      }
    </style>
  `,
  className: "",
  iconSize: [20, 20],
  iconAnchor: [10, 20],
  popupAnchor: [0, -20],
});

const getCustomIcon = (music, tags) => {
  let tagArray = [];
  try {
    tagArray = typeof tags === "string" ? JSON.parse(tags) : tags;
  } catch {
    tagArray = [];
  }
  return new L.Icon({
    iconUrl:
      tagArray?.some(tag =>
        typeof tag === "string" && ["karaoke", "lounge"].includes(tag.toLowerCase())
      )
        ? "/karaoke.png"
        : music?.toLowerCase().includes("jazz")
        ? "/saxophone.png"
        : music?.toLowerCase().includes("rock")
        ? music
        : "/cocktail.png",
    iconSize: [40, 40],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

// Calcule la distance en km entre deux coordonnées
const haversine = ([lat1, lon1], [lat2, lon2]) => {
  const toRad = x => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
};

const PublicMap = () => {
  const [bars, setBars] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const markerRefs = useRef({});
  const [modalItems, setModalItems] = useState([]);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [playlistModal, setPlaylistModal] = useState([]);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchType, setSearchType] = useState("item");

  const mapRef = useRef(null);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);

  // Récupère la position de l'utilisateur
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setUserPos([coords.latitude, coords.longitude]),
      err => console.error(err)
    );
  }, []);

  // Charge les bars
  useEffect(() => {
    const loadBars = async () => {
      const url =
        searchTerm.trim()
          ? `https://kpsule.app/api/public/bars/search?${searchType}=${encodeURIComponent(
              searchTerm
            )}`
          : "https://kpsule.app/api/public/bars/locations";
      const res = await fetch(url);
      const data = await res.json();
      if (searchTerm.trim()) setSuggestions(data.results ?? []);
      else {
        setBars(data.locations ?? []);
        setSuggestions([]);
      }
    };
    const to = setTimeout(loadBars, 300);
    return () => clearTimeout(to);
  }, [searchTerm, searchType]);

  const openItemsModal = async bar_id => {
    const res = await fetch(`https://kpsule.app/api/bars/${bar_id}/items`);
    const data = await res.json();
    setModalItems(data.items);
    setShowItemsModal(true);
  };

  const openPlaylistModal = async bar_id => {
    const res = await fetch(
      `https://kpsule.app/api/public/bars/${bar_id}/playlist`
    );
    if (res.status === 403) return alert("Accès interdit à la playlist");
    const data = await res.json();
    setPlaylistModal(data);
    setShowPlaylistModal(true);
  };

  const filteredBars = bars.filter(
    bar => filter === "all" || bar.music?.toLowerCase() === filter
  );

  return (
    <div className="h-screen w-full flex flex-col relative">
      {/* Recherche & filtres */}
      <div className="flex gap-2 flex-wrap p-2">
        <select
          value={searchType}
          onChange={e => setSearchType(e.target.value)}
          className="border rounded px-2 py-1"
        >
          <option value="item">Item</option>
          <option value="music">Musique</option>
        </select>
        <input
          type="text"
          placeholder={`Rechercher un ${searchType === "item" ? "item" : "titre/artiste"}...`}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="border rounded px-2 py-1 flex-1 min-w-[200px]"
        />
        {suggestions.length > 0 && (
          <div className="absolute bg-white border mt-1 rounded shadow z-50 max-h-60 overflow-auto w-[300px] left-2 top-full">
            {suggestions.map((sug, i) => {
              const m = bars.find(b => b.bar_id === sug.bar_id);
              return (
                <div
                  key={i}
                  onClick={() => {
                    const r = markerRefs.current[sug.bar_id];
                    if (r?.openPopup) r.openPopup();
                    setSearchTerm("");
                    setSuggestions([]);
                  }}
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                >
                  {sug.match_term} – {m?.name || sug.bar_id}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Carte */}
      <div className="flex-1 relative">
        <MapContainer
          whenCreated={map => (mapRef.current = map)}
          center={userPos || [45.5088, -73.561]}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />

          {/* Marqueur utilisateur animé */}
          {userPos && (
            <Marker position={userPos} icon={userIcon}>
              <Popup>Vous êtes ici</Popup>
            </Marker>
          )}

          {/* Bars avec distance */}
          {filteredBars.map(bar => {
            const dist = userPos ? haversine(userPos, [bar.lat, bar.lng]).toFixed(2) : null;
            return (
              <Marker
                key={bar.id}
                position={[bar.lat, bar.lng]}
                icon={getCustomIcon(bar.music, bar.tags_fr || bar.tags)}
                ref={ref => ref && (markerRefs.current[bar.bar_id] = ref)}
              >
                <Popup>
                  <h2 className="font-bold">{bar.name || "Bar"}</h2>
                  {bar.description_fr || bar.description ? <p className="italic text-sm mb-1">{bar.description_fr || bar.description}</p> : null}
                  {bar.music_fr || bar.music ? <p>🎶 Musique : {Array.isArray(bar.music_fr) ? bar.music_fr.join(", ") : Array.isArray(bar.music) ? bar.music.join(", ") : JSON.parse(bar.music||"[]").join(", ")}</p> : null}
                  {bar.tags_fr || bar.tags ? <p>🏷️ Tags : {(Array.isArray(bar.tags_fr)?bar.tags_fr:JSON.parse(bar.tags||"[]")).join(", ")}</p> : null}
                  {bar.price && <p>💰 Prix : {bar.price}</p>}
                  {bar.url && <button className="underline text-blue-600 mt-2" onClick={()=>window.open(bar.url,"_blank")}>Voir le site</button>}
                  <button className="underline text-green-600 mt-2 block" onClick={()=>openItemsModal(bar.bar_id)}>Voir les items</button>
                  <button className="underline text-purple-600 mt-1 block" onClick={()=>openPlaylistModal(bar.bar_id)}>Voir les musiques</button>
                  {dist && <p className="mt-1 font-semibold">📍 {dist} km</p>}
                </Popup>
              </Marker>
            );
          })}

          {/* Bouton centrer */}
          <button
            className="absolute top-4 right-4 bg-white p-2 rounded shadow"
            onClick={() => userPos && mapRef.current.setView(userPos, 13)}
          >
            Centrer sur moi
          </button>
        </MapContainer>
      </div>

      {/* Modals */}
      {showItemsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white w-[90%] h-[90%] rounded-lg overflow-auto p-4 relative">
            <button onClick={() => setShowItemsModal(false)} className="absolute top-2 right-4 text-gray-700 text-xl">✕</button>
            <h2 className="text-2xl font-bold mb-4">Items disponibles</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {modalItems.map(item => (
                <div key={item.id} className="border rounded shadow p-2">
                  {item.image_url && <img src={item.image_url} alt={item.name} className="w-full h-40 object-cover mb-2 rounded" />}
                  <h3 className="font-semibold">{item.name}</h3>
                  <p className="text-gray-700 text-sm">{item.description}</p>
                  <p className="mt-1 font-bold text-green-600">{item.price} $</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showPlaylistModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white w-[90%] h-[90%] rounded-lg overflow-auto p-4 relative">
            <button onClick={() => setShowPlaylistModal(false)} className="absolute top-2 right-4 text-gray-700 text-xl">✕</button>
            <h2 className="text-2xl font-bold mb-4">Playlist du bar</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {playlistModal.map(track => (
                <div key={track.id} className="border rounded shadow p-2 flex flex-col">
                  {track.image_url && <img src={track.image_url} alt={track.track_name} className="w-full h-40 object-cover mb-2 rounded" />}
                  <h3 className="font-semibold">{track.track_name}</h3>
                  <p className="text-gray-700 text-sm">{track.artist_name} – {track.album_name}</p>
                  <p className="mt-1 text-blue-600">Votes : {track.votes}</p>
                  {track.spotify_url && <a href={track.spotify_url} target="_blank" rel="noopener noreferrer" className="underline text-green-600 mt-2">Écouter sur Spotify</a>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicMap;
