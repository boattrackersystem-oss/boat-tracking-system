let map;
let boatMarker = null;
let historyVisible = false;

function initMap() {
  map = L.map("map").setView([7.457398, 125.772873], 12);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);
}

// Boat icons: normal vs SOS
const boatIconNormal = L.icon({
  iconUrl: "/assets/boat.png", // your local boat icon
  iconSize: [48, 48],
  iconAnchor: [24, 24],
  popupAnchor: [0, -24],
});

const boatIconSos = L.icon({
  iconUrl: "/assets/boat.png", // same icon, but we can visually distinguish via popup / banner
  iconSize: [52, 52],
  iconAnchor: [26, 26],
  popupAnchor: [0, -26],
});

// ---------- UI UPDATE FOR CURRENT DATA ----------
function updateUI(data) {
  const bat1El = document.getElementById("bat1-pct");
  const bat2El = document.getElementById("bat2-pct");
  const statusTextEl = document.getElementById("status-text");
  const lastUpdateEl = document.getElementById("last-update");
  const locationTextEl = document.getElementById("location-text");
  const sosBannerEl = document.getElementById("sos-banner");

  const hasLocation = !!data.hasLocation;
  const lat = data.lat;
  const lon = data.lon;
  const sos = data.sos === 1;

  bat1El.textContent = data.bat1 != null ? `${data.bat1.toFixed(1)}%` : "--%";
  bat2El.textContent = data.bat2 != null ? `${data.bat2.toFixed(1)}%` : "--%";

  if (data.updatedAt) {
    const d = new Date(data.updatedAt);
    lastUpdateEl.textContent = d.toLocaleString();
  } else {
    lastUpdateEl.textContent = "--";
  }

  // SOS banner
  if (sos) {
    sosBannerEl.style.display = "flex";
  } else {
    sosBannerEl.style.display = "none";
  }

  if (hasLocation && typeof lat === "number" && typeof lon === "number") {
    statusTextEl.textContent = sos
      ? "Boat is online. SOS is ACTIVE."
      : "Boat is online and location is active.";

    locationTextEl.textContent = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;

    if (!boatMarker) {
      boatMarker = L.marker([lat, lon], {
        icon: sos ? boatIconSos : boatIconNormal,
      }).addTo(map);
      boatMarker.bindPopup("");
    } else {
      boatMarker.setLatLng([lat, lon]);
      boatMarker.setIcon(sos ? boatIconSos : boatIconNormal);
    }

    const popupHtml = `
      <strong>Boat Status</strong><br/>
      Light Battery: ${data.bat1 != null ? data.bat1.toFixed(1) + "%" : "--%"}<br/>
      Transmitter Battery: ${
        data.bat2 != null ? data.bat2.toFixed(1) + "%" : "--%"
      }<br/>
      SOS: ${sos ? "<span style='color:#b91c1c;font-weight:700;'>ACTIVE</span>" : "Normal"}
    `;
    boatMarker.setPopupContent(popupHtml);
  } else {
    statusTextEl.textContent =
      "Boat is sending status, but location is not established yet.";
    locationTextEl.textContent = "No GPS fix yet.";

    if (boatMarker) {
      map.removeLayer(boatMarker);
      boatMarker = null;
    }
  }
}

// ---------- HISTORY UI ----------
function renderHistory(items) {
  const tbody = document.getElementById("history-body");
  tbody.innerHTML = "";

  items.forEach((item) => {
    const tr = document.createElement("tr");

    const createdAt = item.createdAt ? new Date(item.createdAt) : null;
    const timeText = createdAt ? createdAt.toLocaleString() : "--";

    const sosActive = item.sos === 1;

    tr.innerHTML = `
      <td>${timeText}</td>
      <td>${item.lat != null ? item.lat.toFixed(5) : "--"}</td>
      <td>${item.lon != null ? item.lon.toFixed(5) : "--"}</td>
      <td>${item.bat1 != null ? item.bat1.toFixed(1) + "%" : "--"}</td>
      <td>${item.bat2 != null ? item.bat2.toFixed(1) + "%" : "--"}</td>
      <td class="sos-cell ${sosActive ? "active" : ""}">${
      sosActive ? "SOS" : "-"
    }</td>
    `;

    tbody.appendChild(tr);
  });
}

// ---------- FETCHERS ----------
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

async function fetchBoatHistory() {
  try {
    const res = await fetch("/api/boat/history?limit=30");
    if (!res.ok) throw new Error("Failed to fetch /api/boat/history");
    const data = await res.json();
    renderHistory(data.items || []);
  } catch (err) {
    console.error(err);
  }
}

// ---------- DOM INIT ----------
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  fetchBoatData();
  fetchBoatHistory();

  setInterval(fetchBoatData, 5000);     // live
  setInterval(fetchBoatHistory, 15000); // history refresh

  const toggleBtn = document.getElementById("toggle-history-btn");
  const historyContainer = document.getElementById("history-container");

  toggleBtn.addEventListener("click", () => {
    historyVisible = !historyVisible;
    historyContainer.style.display = historyVisible ? "block" : "none";
    toggleBtn.textContent = historyVisible ? "Hide history" : "Show history";
  });
});
