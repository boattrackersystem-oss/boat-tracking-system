let map;
let boatMarker = null;

let historyItems = [];
let historyVisible = false;
let showHistoryOnMap = false;
let historyPolyline = null;
let historyMarkers = [];

// ---------- MAP INIT ----------
function initMap() {
  map = L.map("map").setView([7.457398, 125.772873], 12);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);
}

// Boat icons
const boatIconNormal = L.icon({
  iconUrl: "/assets/boat.png", // your local icon
  iconSize: [48, 48],
  iconAnchor: [24, 24],
  popupAnchor: [0, -24],
});

const boatIconSos = L.icon({
  iconUrl: "/assets/boat.png",
  iconSize: [52, 52],
  iconAnchor: [26, 26],
  popupAnchor: [0, -26],
});

// ---------- CURRENT DATA UI ----------
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

  let lastUpdateText = "--";
  if (data.updatedAt) {
    const d = new Date(data.updatedAt);
    lastUpdateText = d.toLocaleString();
    lastUpdateEl.textContent = lastUpdateText;
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
      Last Update: ${lastUpdateText}<br/>
      Lat: ${lat.toFixed(6)}<br/>
      Lon: ${lon.toFixed(6)}<br/>
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

// ---------- HISTORY TABLE ----------
function renderHistory(items) {
  const tbody = document.getElementById("history-body");
  tbody.innerHTML = "";

  items.forEach((item, index) => {
    const tr = document.createElement("tr");
    tr.dataset.index = index;

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

  // Click on row -> focus that history point on map
  tbody.querySelectorAll("tr").forEach((row) => {
    row.addEventListener("click", () => {
      const idx = parseInt(row.dataset.index, 10);
      focusHistoryPoint(idx);
    });
  });
}

// ---------- HISTORY ON MAP ----------
function clearHistoryFromMap() {
  if (historyPolyline) {
    map.removeLayer(historyPolyline);
    historyPolyline = null;
  }
  historyMarkers.forEach((m) => {
    if (m) map.removeLayer(m);
  });
  historyMarkers = [];
}

function renderHistoryOnMap() {
  clearHistoryFromMap();

  const latlngs = [];

  historyItems.forEach((item, index) => {
    if (item.lat == null || item.lon == null) return;

    const latlng = [item.lat, item.lon];
    latlngs.push(latlng);

    const createdAt = item.createdAt ? new Date(item.createdAt) : null;
    const timeText = createdAt ? createdAt.toLocaleString() : "--";
    const sosActive = item.sos === 1;

    const marker = L.circleMarker(latlng, {
      radius: sosActive ? 6 : 4,
      weight: 1,
      color: sosActive ? "#b91c1c" : "#2563eb",
      fillColor: sosActive ? "#fecaca" : "#bfdbfe",
      fillOpacity: 0.9,
    }).addTo(map);

    marker.bindPopup(`
      <strong>History point</strong><br/>
      Time: ${timeText}<br/>
      Lat: ${item.lat.toFixed(5)}<br/>
      Lon: ${item.lon.toFixed(5)}<br/>
      Light Bat: ${item.bat1 != null ? item.bat1.toFixed(1) + "%" : "--"}<br/>
      Tx Bat: ${item.bat2 != null ? item.bat2.toFixed(1) + "%" : "--"}<br/>
      SOS: ${sosActive ? "ACTIVE" : "Normal"}
    `);

    historyMarkers[index] = marker;
  });

  if (latlngs.length >= 2) {
    historyPolyline = L.polyline(latlngs, {
      weight: 3,
      opacity: 0.7,
    }).addTo(map);
  }
}

// Focus map + popup to specific history index
function focusHistoryPoint(index) {
  const item = historyItems[index];
  if (!item || item.lat == null || item.lon == null) return;

  // Ensure history is visible on map
  if (!showHistoryOnMap) {
    showHistoryOnMap = true;
    const toggleMapBtn = document.getElementById("toggle-history-map-btn");
    toggleMapBtn.textContent = "Hide on map";
    renderHistoryOnMap();
  }

  const latlng = [item.lat, item.lon];
  map.setView(latlng, 14);

  if (historyMarkers[index]) {
    historyMarkers[index].openPopup();
  }

  // highlight row
  const tbody = document.getElementById("history-body");
  tbody.querySelectorAll("tr").forEach((r) => r.classList.remove("active"));
  const row = tbody.querySelector(`tr[data-index="${index}"]`);
  if (row) row.classList.add("active");
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

    historyItems = data.items || [];
    renderHistory(historyItems);

    if (showHistoryOnMap) {
      renderHistoryOnMap();
    }
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

  const toggleListBtn = document.getElementById("toggle-history-btn");
  const toggleMapBtn = document.getElementById("toggle-history-map-btn");
  const historyContainer = document.getElementById("history-container");

  toggleListBtn.addEventListener("click", () => {
    historyVisible = !historyVisible;
    historyContainer.style.display = historyVisible ? "block" : "none";
    toggleListBtn.textContent = historyVisible ? "Hide list" : "Show list";
  });

  toggleMapBtn.addEventListener("click", () => {
    showHistoryOnMap = !showHistoryOnMap;
    toggleMapBtn.textContent = showHistoryOnMap ? "Hide on map" : "Show on map";

    if (showHistoryOnMap) {
      renderHistoryOnMap();
    } else {
      clearHistoryFromMap();
    }
  });
});
