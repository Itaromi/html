const express = require("express");
const cors = require("cors");
const fetch = globalThis.fetch;

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Fonction pour formater l'heure en HH:MM:SS
const formatTime = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

// Fonction pour calculer la durée totale de l'événement en HH:MM:SS
const calculateDuration = (start, stop) => {
  const startTime = new Date(start);
  const stopTime = new Date(stop);
  const durationSeconds = Math.max(0, Math.round((stopTime - startTime) / 1000));
  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.floor((durationSeconds % 3600) / 60);
  const seconds = durationSeconds % 60;
  return `${hours}h ${minutes}min ${seconds}s`;
};

// Fonction principale pour récupérer les événements depuis Odoo
const fetchEvents = async () => {
  try {
    const response = await fetch("https://funlabrennes-teste-19048326.dev.odoo.com/jsonrpc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        id: 2,
        params: {
          service: "object",
          method: "execute_kw",
          args: [
            "funlabrennes-teste-19048326",
            45,
            "test123456789@.",
            "calendar.event",
            "search_read",
            [[]],
            { fields: ["name", "start", "stop", "partner_id"] },
          ],
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const jsonResponse = await response.json();
    console.log("Réponse Odoo:", jsonResponse);

    const now = new Date();
    const today = now.toISOString().split("T")[0]; // Date d'aujourd'hui en format YYYY-MM-DD

    return (jsonResponse.result || [])
      .filter(event => event.partner_id)
      .filter(event => {
        const eventDate = new Date(event.start).toISOString().split("T")[0];
        return eventDate === today;
      })
      .map(event => {
        const startTime = new Date(event.start);
        const stopTime = new Date(event.stop);

        let remainingSeconds = 0;
        if (now >= startTime && now < stopTime) {
          remainingSeconds = Math.max(0, Math.round((stopTime - now) / 1000));
        }

        const totalSeconds = Math.max(0, Math.round((stopTime - startTime) / 1000)); // Durée totale
        const totalHours = Math.floor(totalSeconds / 3600);
        const totalMinutes = Math.floor((totalSeconds % 3600) / 60);
        const totalSec = totalSeconds % 60;
        
        const hours = Math.floor(remainingSeconds / 3600);
        const minutes = Math.floor((remainingSeconds % 3600) / 60);
        const seconds = remainingSeconds % 60;

        const remainingTime = remainingSeconds > 0 ? `${hours}h ${minutes}min ${seconds}s` : "";
        const totalDuration = `${totalHours}h ${totalMinutes}min ${totalSec}s`;

        console.log(`✅ Événement: ${event.name} - Début: ${startTime} - Fin: ${stopTime} - Temps restant: ${remainingTime}`);

        return {
          ...event,
          start: formatTime(startTime), // Formater l'heure de début
          stop: formatTime(stopTime),   // Formater l'heure de fin
          remainingTime,
          duration: totalDuration, // Durée totale de l'événement
        };
      });
  } catch (error) {
    console.error("❌ Erreur lors de la requête :", error);
    return [];
  }
};

// Route API pour récupérer les événements
app.get("/api/events", async (req, res) => {
  const events = await fetchEvents();
  res.json(events);
});

// Rafraîchir les événements toutes les 30 secondes
setInterval(async () => {
  try {
    console.log("🔄 Vérification des nouveaux événements...");
    await fetchEvents();
  } catch (error) {
    console.error("⚠️ Erreur lors de l'actualisation des événements :", error);
  }
}, 30000);

// Lancer le serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});
