
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'


createRoot(document.getElementById("root")!).render(<App />);
if ('serviceWorker' in navigator && 'PushManager' in window) {
    navigator.serviceWorker.register('/sw.js').then(async (registration) => {
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: 'BDwFtxs1cVZj0zuFZveuoQbQzZ36RjOhU6ljtsWxQvesjfWLZL9et5VSFVfSwmyHqsGGyG1E8fG_6Bs8oCFOpRo'
      });
      console.log("Push subscription :", subscription);
      localStorage.setItem("pushSubscription", JSON.stringify(subscription));
    });
  }
  