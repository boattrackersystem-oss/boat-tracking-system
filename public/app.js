// Simple Leaflet map with a boat marker
let map;
let boatMarker = null;

function initMap() {
  map = L.map("map").setView([7.457398, 125.772873], 12);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);
}

// Custom boat icon
const boatIcon = L.icon({
  iconUrl:
    "/assets/boat.png",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

// Update UI with data from API
function updateUI(data) {
  const bat1El = document.getElementById("bat1-pct");
  const bat2El = document.getElementById("bat2-pct");
  const statusTextEl = document.getElementById("status-text");
  const lastUpdateEl = document.getElementById("last-update");
  const locationTextEl = document.getElementById("location-text");
  const pendingCardEl = document.getElementById("pending-card");

  const hasLocation = !!data.hasLocation;
  const lat = data.lat;
  const lon = data.lon;

  bat1El.textContent = data.bat1 != null ? `${data.bat1.toFixed(1)}%` : "--%";
  bat2El.textContent = data.bat2 != null ? `${data.bat2.toFixed(1)}%` : "--%";

  if (data.updatedAt) {
    const d = new Date(data.updatedAt);
    lastUpdateEl.textContent = d.toLocaleString();
  } else {
    lastUpdateEl.textContent = "--";
  }

  if (hasLocation && typeof lat === "number" && typeof lon === "number") {
    statusTextEl.textContent = "Boat is online and location is active.";
    locationTextEl.textContent = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    pendingCardEl.style.display = "none";

    // Place or move boat marker
    if (!boatMarker) {
      boatMarker = L.marker([lat, lon], { icon: boatIcon }).addTo(map);
      boatMarker.bindPopup("");
    } else {
      boatMarker.setLatLng([lat, lon]);
    }

    // Update popup content
    const popupHtml = `
      <strong>Boat Status</strong><br/>
      Light Battery: ${data.bat1 != null ? data.bat1.toFixed(1) + "%" : "--%"}<br/>
      Transmitter Battery: ${
        data.bat2 != null ? data.bat2.toFixed(1) + "%" : "--%" 
      }
    `;
    boatMarker.setPopupContent(popupHtml);

  } else {
    // No location, show pending card and put boat "off-map"
    statusTextEl.textContent =
      "Boat is sending status, but location is not established yet.";
    locationTextEl.textContent = "No GPS fix yet.";
    pendingCardEl.style.display = "block";

    if (boatMarker) {
      map.removeLayer(boatMarker);
      boatMarker = null;
    }
  }
}

// Poll backend every 5 seconds
async function fetchBoatData() {
  try {
    const res = await fetch("/api/boat");
    if (!res.ok) throw new Error("Failed to fetch /api/boat");
    const data = await res.json();
    updateUI(data);
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initMap();
  fetchBoatData();
  setInterval(fetchBoatData, 5000); // every 5 seconds
});
