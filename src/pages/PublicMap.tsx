import { useState, useEffect, useRef } from "react";
import {
  MapContainer, TileLayer, Marker, Popup,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const getCustomIcon = (music) =>
  new L.Icon({
    iconUrl:
      music?.toLowerCase() === "jazz"
        ? "https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
        : music?.toLowerCase() === "rock"
        ? "https://maps.google.com/mapfiles/ms/icons/red-dot.png"
        : "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
    iconSize: [50, 50],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

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
  const [searchType, setSearchType] = useState("item"); // "item" ou "music"
  
  useEffect(() => {
    fetch("https://kpsule.app/api/bars/locations")
      .then(res => res.json())
      .then(data => setBars(data?.locations ?? []));
      }, []);

  const openItemsModal = async (bar_id) => {
    const res = await fetch(`https://kpsule.app/api/bars/${bar_id}/items`);
    const data = await res.json();
    setModalItems(data.items);
    setShowItemsModal(true);
  };

  useEffect(() => {
    console.log("Tous les markers enregistrés :", markerRefs.current);
  }, [bars]);
  

  const openPlaylistModal = async (bar_id) => {
    const res = await fetch(`https://kpsule.app/api/public/bars/${bar_id}/playlist`, {
      headers: {
        "x-user-id": "PUBLIC", // modifie si besoin
      },
    });
    if (res.status === 403) {
      alert("Accès interdit à la playlist");
      return;
    }
    const data = await res.json();
    setPlaylistModal(data);
    setShowPlaylistModal(true);
  };
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (searchTerm.trim()) {
        const res = await fetch(`https://kpsule.app/api/bars/search?${searchType}=${encodeURIComponent(searchTerm)}`);
        const data = await res.json();
        setSuggestions(data.results ?? []);
      } else {
        const res = await fetch("https://kpsule.app/api/bars/locations");
        const data = await res.json();
        setBars(data.locations ?? []);
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [searchTerm, searchType]);
  
  

  const filteredBars = bars.filter(
    bar => filter === "all" || bar.music?.toLowerCase() === filter
  );

  return (
    <div className="h-screen w-full flex flex-col relative">
      <div className="flex gap-2 flex-wrap relative">

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
        <div className="absolute bg-white border mt-1 rounded shadow z-50 max-h-60 overflow-auto w-[300px] left-0 top-full">
        {suggestions.map((sug, idx) => (
            <div
              key={idx}
              onClick={() => {
                console.log("Suggestion cliquée :", sug);
                const ref = markerRefs.current[sug.bar_id];
                console.log("Ref récupéré :", ref);
              
                if (ref && ref.openPopup) {
                  console.log("Popup ouverte pour le marker :", sug.bar_id);
                  ref.openPopup(); // ✅ simple, suffisant
                } else {
                  console.warn("Aucune ref ou méthode openPopup non disponible pour :", sug.bar_id);
                }
              
                setSearchTerm("");
                setSuggestions([]);
              }}
              
              
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
            >
              {sug.match_term} – {sug.bar_id}
            </div>
          ))}
        </div>
      )}

      </div>
      <div className="flex-1 z-0">
        <MapContainer center={[45.5088, -73.561]} zoom={13} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          
          {filteredBars.map(bar => (
            <Marker
              key={bar.id}
              position={[bar.lat, bar.lng]}
              icon={getCustomIcon(bar.music)}
              ref={(ref) => {
                console.log("Marker ref →", bar.bar_id, ref);
                if (ref) markerRefs.current[bar.bar_id] = ref;
              }}              
              eventHandlers={{
                click: () => {
                  console.log("Marker clicked manually →", bar.id);
                },
              }}
            >

              <Popup>
                <h2 className="font-bold">{bar.name || "Bar"}</h2>
                <p>Musique : {bar.music}</p>
                <p>Prix : {bar.price}</p>
                {bar.url && (
                  <button
                    className="text-blue-600 underline mt-2"
                    onClick={() => window.open(bar.url, "_blank")}
                  >
                    Voir le site
                  </button>
                )}
                <br />
                <button
                  className="text-green-600 underline mt-2"
                  onClick={() => openItemsModal(bar.bar_id)}
                >
                  Voir les items
                </button>
                <br />
                <button
                  className="text-purple-600 underline mt-1"
                  onClick={() => openPlaylistModal(bar.bar_id)}
                >
                  Voir les musiques
                </button>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Modal Items */}
      {showItemsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white w-[90%] h-[90%] rounded-lg overflow-auto p-4 relative">
            <button
              onClick={() => setShowItemsModal(false)}
              className="absolute top-2 right-4 text-gray-700 text-xl"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold mb-4">Items disponibles</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {modalItems.map(item => (
                <div key={item.id} className="border rounded shadow p-2">
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-40 object-cover rounded mb-2"
                    />
                  )}
                  <h3 className="font-semibold">{item.name}</h3>
                  <p className="text-sm text-gray-700">{item.description}</p>
                  <p className="mt-1 text-green-600 font-bold">{item.price} $</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Playlist */}
      {showPlaylistModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white w-[90%] h-[90%] rounded-lg overflow-auto p-4 relative">
            <button
              onClick={() => setShowPlaylistModal(false)}
              className="absolute top-2 right-4 text-gray-700 text-xl"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold mb-4">Playlist du bar</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {playlistModal.map(track => (
                <div key={track.id} className="border rounded shadow p-2 flex flex-col">
                  {track.image_url && (
                    <img
                      src={track.image_url}
                      alt={track.track_name}
                      className="w-full h-40 object-cover rounded mb-2"
                    />
                  )}
                  <h3 className="font-semibold">{track.track_name}</h3>
                  <p className="text-sm text-gray-700">
                    {track.artist_name} – {track.album_name}
                  </p>
                  <p className="mt-1 text-blue-600">Votes : {track.votes}</p>
                  {track.spotify_url && (
                    <a
                      href={track.spotify_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 underline mt-2"
                    >
                      Écouter sur Spotify
                    </a>
                  )}
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
