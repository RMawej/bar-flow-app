import React, { useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const bars = [
  { id: 1, name: "Bar des Amis", lat: 48.8566, lng: 2.3522, music: "Jazz", price: "€€" },
  { id: 2, name: "Chez Marcel", lat: 48.857, lng: 2.35, music: "Électro", price: "€€€" },
  { id: 3, name: "Le Repaire", lat: 48.855, lng: 2.353, music: "Rock", price: "€" },
];

// Fix default marker icon for leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const PublicMap = () => {
  const [filter, setFilter] = useState("all");

  const filteredBars = bars.filter(
    bar => filter === "all" || bar.music.toLowerCase() === filter
  );

  return (
    <div className="h-screen w-full flex flex-col">
      <div className="p-2 bg-white shadow-md z-10">
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="border rounded px-2 py-1"
        >
          <option value="all">Tous</option>
          <option value="jazz">Jazz</option>
          <option value="rock">Rock</option>
          <option value="électro">Électro</option>
        </select>
      </div>
      <div className="flex-1">
        <MapContainer center={[48.8566, 2.3522]} zoom={14} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          {filteredBars.map(bar => (
            <Marker key={bar.id} position={[bar.lat, bar.lng]}>
              <Popup>
                <h2>{bar.name}</h2>
                <p>Musique : {bar.music}</p>
                <p>Prix : {bar.price}</p>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default PublicMap;
