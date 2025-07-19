import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const tick = "✅";
const spinner = "⏳";

const defaultPos: [number, number] = [45.5088, -73.561]; // Montréal fallback

export default function SettingsForm() {
  const { barId, userId } = useAuthStore();
  const [form, setForm] = useState({
    address: "",
    lat: "",
    lng: "",
    music: "",
    price: "",
    url: ""
  });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch(`https://kpsule.app/api/bars/${barId}/location`)
      .then(res => res.json())
      .then(data => {
        if (data.location) {
          setForm({ ...data.location, address: "" });
          setEditing(true);
        }
      });
  }, [barId]);

  const geocodeAddress = async () => {
    if (!form.address) return;
    setLoading(true);
    setSuccess(false);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(form.address)}`);
    const results = await res.json();
    if (results.length > 0) {
      setForm(f => ({
        ...f,
        lat: results[0].lat,
        lng: results[0].lon
      }));
      setSuccess(true);
    } else {
      alert("Adresse introuvable.");
    }
    setLoading(false);
  };

  const save = async () => {
    const method = editing ? "PUT" : "POST";
    const res = await fetch(`https://kpsule.app/api/bars/${barId}/location`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId
      },
      body: JSON.stringify(form)
    });

    if (res.ok) alert("✅ Enregistré");
    else alert("❌ Erreur");
  };

  const parsedLat = parseFloat(form.lat);
  const parsedLng = parseFloat(form.lng);
  const isLatLngValid = !isNaN(parsedLat) && !isNaN(parsedLng);

  return (
    <div className="space-y-4 max-w-xl mx-auto mt-8">
      <h2 className="text-2xl font-semibold">Informations de localisation</h2>

      <div className="flex items-center gap-2">
        <input
          placeholder="Adresse"
          value={form.address}
          onChange={e => {
            setForm({ ...form, address: e.target.value });
            setSuccess(false);
          }}
          onBlur={geocodeAddress}
          className="w-full border rounded px-3 py-2"
        />
        {loading ? <span>{spinner}</span> : success && <span>{tick}</span>}
      </div>

      <input
        placeholder="Latitude"
        value={form.lat}
        readOnly
        className="w-full border rounded px-3 py-2 bg-gray-100"
      />
      <input
        placeholder="Longitude"
        value={form.lng}
        readOnly
        className="w-full border rounded px-3 py-2 bg-gray-100"
      />
      {isLatLngValid && (
        <MapContainer
          center={[parsedLat, parsedLng]}
          zoom={15}
          style={{ height: "200px", width: "100%" }}
          className="rounded overflow-hidden"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap"
          />
          <Marker position={[parsedLat, parsedLng]} icon={
            new L.Icon({
              iconUrl: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
              iconSize: [32, 32],
              iconAnchor: [16, 32],
              popupAnchor: [0, -32]
            })
          }>
            <Popup>{form.address || "Position choisie"}</Popup>
          </Marker>
        </MapContainer>
      )}

      <input
        placeholder="Musique (ex: Jazz)"
        value={form.music}
        onChange={e => setForm({ ...form, music: e.target.value })}
        className="w-full border rounded px-3 py-2"
      />
      <input
        placeholder="Prix (ex: $$)"
        value={form.price}
        onChange={e => setForm({ ...form, price: e.target.value })}
        className="w-full border rounded px-3 py-2"
      />
      <input
        placeholder="URL du site"
        value={form.url}
        onChange={e => setForm({ ...form, url: e.target.value })}
        className="w-full border rounded px-3 py-2"
      />
      <Button onClick={save}>Sauvegarder</Button>
    </div>
  );
}
