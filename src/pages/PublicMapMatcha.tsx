import { useState, useEffect, useRef } from "react";
import {
  MapContainer, TileLayer, Marker, Popup,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const getCustomIcon = (music, tags) => {
  let tagArray = [];
  try {
    tagArray = typeof tags === "string" ? JSON.parse(tags) : tags;
  } catch {
    tagArray = [];
  }

  return new L.Icon({
    iconUrl:
      tagArray?.some(tag => typeof tag === "string" && ["karaoke", "lounge"].includes(tag.toLowerCase()))
        ? "https://maps.google.com/mapfiles/ms/icons/red-dot.png"
        : music?.toLowerCase().includes("jazz")
        ? "https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
        : music?.toLowerCase().includes("rock")
        ? "https://maps.google.com/mapfiles/ms/icons/red-dot.png"
        : "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
    iconSize: [50, 50],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};


const PublicMap = () => {
  const [matchas, setmatchas] = useState<any[]>([]);
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
    fetch("https://kpsule.app/api/public/matchas/locations", {
      headers: {}
    })
      .then(res => {
        console.log("Status :", res.status);
        return res.json();
      })
      .then(data => console.log(data))
      .catch(err => console.error(err));
    }, []);

  const openItemsModal = async (matcha_id) => {
    const res = await fetch(`https://kpsule.app/api/matchas/${matcha_id}/items`);
    const data = await res.json();
    setModalItems(data.items);
    setShowItemsModal(true);
  };


  

  const openPlaylistModal = async (matcha_id) => {
    const res = await fetch(`https://kpsule.app/api/public/matchas/${matcha_id}/playlist`, {
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
        const res = await fetch(`https://kpsule.app/api/public/matchas/search?${searchType}=${encodeURIComponent(searchTerm)}`);
        const data = await res.json();
        setSuggestions(data.results ?? []);
      } else {
        const res = await fetch("https://kpsule.app/api/public/matchas/locations");
        const data = await res.json();
        setmatchas(data.locations ?? []);
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [searchTerm, searchType]);
  
  

  const filteredmatchas = matchas.filter(
    matcha => filter === "all" || matcha.music?.toLowerCase() === filter
  );

  return (
    <div className="h-screen w-full flex flex-col relative">
      <div className="flex gap-2 flex-wrap relative">

      {suggestions.length > 0 && (
        <div className="absolute bg-white border mt-1 rounded shadow z-50 max-h-60 overflow-auto w-[300px] left-0 top-full">
        {suggestions.map((sug, idx) => 
        {
          const matchedmatcha = matchas.find(b => b.matcha_id === sug.matcha_id);
          const matchaName = matchedmatcha?.name || sug.matcha_id;
        return (
            <div
              key={idx}
              onClick={() => {
                console.log("Suggestion cliquée :", sug);
                const ref = markerRefs.current[sug.matcha_id];
                console.log("Ref récupéré :", ref);
              
                if (ref && ref.openPopup) {
                  console.log("Popup ouverte pour le marker :", sug.matcha_id);
                  ref.openPopup(); // ✅ simple, suffisant
                } else {
                  console.warn("Aucune ref ou méthode openPopup non disponible pour :", sug.matcha_id);
                }
              
                setSearchTerm("");
                setSuggestions([]);
              }}
              
              
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
            >
              {sug.match_term} – {matchaName}
            </div>
          )})}
        </div>
      )}

      </div>
      <div className="flex-1 z-0">
        <MapContainer center={[45.5088, -73.561]} zoom={13} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          
          {filteredmatchas.map(matcha => (
            <Marker
              key={matcha.id}
              position={[matcha.lat, matcha.lng]}
              icon={getCustomIcon(matcha.music, matcha.tags_fr || matcha.tags)}
              ref={(ref) => {
                if (ref) markerRefs.current[matcha.matcha_id] = ref;
              }}              
              eventHandlers={{
                click: () => {
                  console.log("Marker clicked manually →", matcha.id);
                },
              }}
            >

          <Popup>
            <h2 className="font-bold">{matcha.name || "matcha"}</h2>

            {matcha.description_fr || matcha.description ? (
              <p className="text-sm italic mb-1">
                {matcha.description_fr || matcha.description}
              </p>
            ) : null}

            {matcha.music_fr || matcha.music ? (
              <p>🎶 Musique : {
                Array.isArray(matcha.music_fr)
                  ? matcha.music_fr.join(", ")
                  : Array.isArray(matcha.music)
                  ? matcha.music.join(", ")
                  : (() => {
                      try {
                        const parsed = JSON.parse(matcha.music || "[]");
                        return Array.isArray(parsed) ? parsed.join(", ") : "";
                      } catch {
                        return matcha.music;
                      }
                    })()
              }</p>
            ) : null}

          {matcha.tags_fr || matcha.tags ? (
            <p>🏷️ Tags : {
              (() => {
                try {
                  const tags = JSON.parse(matcha.tags_fr || matcha.tags || "[]");
                  return Array.isArray(tags) ? tags.join(", ") : "";
                } catch {
                  return "";
                }
              })()
            }</p>
          ) : null}


            {matcha.price ? <p>💰 Prix : {matcha.price}</p> : null}

            {matcha.url && (
              <button
                className="text-blue-600 underline mt-2"
                onClick={() => window.open(matcha.url, "_blank")}
              >
                Voir le site
              </button>
            )}
            <br />
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
            <h2 className="text-2xl font-bold mb-4">Playlist du matcha</h2>
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
