import { useEffect, useState } from "react";

const AdminBars = () => {
  const [bars, setBars] = useState<any[]>([]);

  const fetchBars = async () => {
    const res = await fetch("https://kpsule.app/api/public/bars/locations");
    const data = await res.json();
    console.log("✅ Bars récupérés :", data);
    setBars(data.locations ?? []);
  };

  const deleteBar = async (bar_id: string) => {
    const confirmed = confirm("Supprimer ce bar ?");
    if (!confirmed) return;

    const res = await fetch(`https://kpsule.app/api/bars/${bar_id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setBars(prev => prev.filter(b => b.bar_id !== bar_id));
    } else {
      alert("Erreur lors de la suppression");
    }
  };

  useEffect(() => {
    fetchBars();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Liste des bars</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {bars.map(bar => (
          <div key={bar.id} className="border p-4 rounded shadow">
            <h2 className="font-semibold text-lg">{bar.name || "Nom inconnu"}</h2>
            <p className="text-sm italic mb-2">{bar.description_fr || bar.description}</p>
            <p className="text-sm mb-1">🎶 {bar.music}</p>
            <p className="text-sm">🏷️ {Array.isArray(bar.tags_fr) ? bar.tags_fr.join(", ") : ""}</p>
            <button
              onClick={() => deleteBar(bar.bar_id)}
              className="mt-2 bg-red-600 text-white px-3 py-1 rounded"
            >
              Supprimer
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminBars;
