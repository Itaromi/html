const express = require("express");
const cors = require("cors");
const fetch = globalThis.fetch;

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Fonction pour formater l'heure en HH:MM:SS
const formatTime = (date) => {
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

// Fonction pour calculer la durée totale de l'événement en HH:MM:SS
const calculateDuration = (start, stop) => {
  const durationSeconds = Math.max(0, Math.round((stop - start) / 1000));
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

    let events = (jsonResponse.result || [])
      .filter(event => event.partner_id)
      .filter(event => {
        const eventDate = new Date(event.start).toISOString().split("T")[0];
        return eventDate === today;
      })
      .filter(event => {
        const stopTime = new Date(new Date(event.stop).getTime() + 3600000);
        return stopTime > now; // Exclure les événements déjà terminés
      })
      .map(event => {
        // Ajouter 1h pour la gestion serveur
        const startTime = new Date(new Date(event.start).getTime() + 3600000);
        const stopTime = new Date(new Date(event.stop).getTime() + 3600000);

        // Affichage frontend avec une heure en plus
        const displayStartTime = new Date(startTime.getTime() + 3600000);
        const displayStopTime = new Date(stopTime.getTime() + 3600000);

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

        return {
          ...event,
          start: formatTime(displayStartTime), // Afficher avec une heure en plus
          stop: formatTime(displayStopTime),   // Afficher avec une heure en plus
          remainingTime,
          duration: totalDuration, // Durée totale de l'événement
          timestamp: startTime.getTime(), // Ajouter un timestamp pour le tri
        };
      });

    // Trier les événements par ordre chronologique
    events.sort((a, b) => a.timestamp - b.timestamp);

    // Sélectionner le premier événement en cours ou le plus proche et celui qui suit
    const upcomingEvents = events.slice(0, 2);
    
    return upcomingEvents;
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