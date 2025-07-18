import { useEffect } from "react";
import axios from "axios";

const Callback = () => {
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) return;

    axios
      .post("https://kpsule.app/api/spotify/callback", { code })
      .then((res) => {
        const token = res.data.access_token;
        localStorage.setItem("spotify_user_token", token);
        window.location.href = "/dashboard?tab=playlist";
      })
      .catch((err) => {
        console.error("Erreur de callback Spotify :", err);
      });
  }, []);

  return <p>Connexion à Spotify...</p>;
};

export default Callback;
