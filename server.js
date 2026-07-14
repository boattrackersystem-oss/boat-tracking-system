// ===== CREDENTIALS =====
/**
 * Email: BoatTrackerSystem@gmail.com
 * Password: BoatTrackerSystem123!
 */

const express = require("express");
const path = require("path");
const { admin, db } = require("./config/firestore_config");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve front-end
app.use(express.static(path.join(__dirname, "public")));

// Only one physical tracker exists and its firmware can't send a real
// serial, so every upload is assumed to come from serial "123".
const DEVICE_SERIAL = "123";

// ========== API: upload boat info from NodeMCU / ESP ==========
// POST /api/upload-boat-info
// expected JSON body: { lat, lon, bat1, bat2, sos }
app.post("/api/upload-boat-info", async (req, res) => {
  try {
    const { lat, lon, bat1, bat2, sos } = req.body;

    const data = {
      lat: typeof lat === "number" ? lat : null,
      lon: typeof lon === "number" ? lon : null,
      bat1: typeof bat1 === "number" ? bat1 : null,
      bat2: typeof bat2 === "number" ? bat2 : null,
      sos: sos === 1 || sos === "1" ? 1 : 0,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Always stored, whether or not this serial has been registered yet.
    const docRef = db.collection("boats").doc(DEVICE_SERIAL);

    // Save current snapshot
    await docRef.set(data, { merge: true });

    // Also push to history
    await docRef.collection("history").add({
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Error in /api/upload-boat-info:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ========== API: latest boat info ==========
// GET /api/boat
// Telemetry is withheld until the serial has been registered, even if
// data already exists in Firestore for it.
app.get("/api/boat", async (req, res) => {
  try {
    const docRef = db.collection("boats").doc(DEVICE_SERIAL);
    const doc = await docRef.get();
    const data = doc.exists ? doc.data() : null;

    if (!data || data.registered !== true) {
      return res.json({
        registered: false,
        serial: DEVICE_SERIAL,
        hasLocation: false,
        lat: null,
        lon: null,
        bat1: null,
        bat2: null,
        sos: 0,
        updatedAt: null,
        name: null,
        owner: null,
        type: null,
      });
    }

    const hasLocation =
      typeof data.lat === "number" && typeof data.lon === "number";

    res.json({
      registered: true,
      serial: DEVICE_SERIAL,
      hasLocation,
      lat: hasLocation ? data.lat : null,
      lon: hasLocation ? data.lon : null,
      bat1: data.bat1 ?? null,
      bat2: data.bat2 ?? null,
      sos: data.sos === 1 ? 1 : 0,
      updatedAt: data.updatedAt ? data.updatedAt.toDate() : null,
      name: data.name ?? null,
      owner: data.owner ?? null,
      type: data.type ?? null,
    });
  } catch (err) {
    console.error("Error in /api/boat:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ========== API: boat history ==========
// GET /api/boat/history?limit=30
app.get("/api/boat/history", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || "30", 10);

    const docRef = db.collection("boats").doc(DEVICE_SERIAL);
    const boatDoc = await docRef.get();

    if (!boatDoc.exists || boatDoc.data().registered !== true) {
      return res.json({ registered: false, items: [] });
    }

    const colRef = docRef.collection("history");

    const snap = await colRef
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const items = [];
    snap.forEach((doc) => {
      const d = doc.data();
      items.push({
        lat: typeof d.lat === "number" ? d.lat : null,
        lon: typeof d.lon === "number" ? d.lon : null,
        bat1: d.bat1 ?? null,
        bat2: d.bat2 ?? null,
        sos: d.sos === 1 ? 1 : 0,
        createdAt: d.createdAt ? d.createdAt.toDate() : null,
      });
    });

    res.json({ registered: true, items });
  } catch (err) {
    console.error("Error in /api/boat/history:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ========== API: register a boat ==========
// POST /api/register-boat
// expected JSON body: { serial, name, owner, type }
app.post("/api/register-boat", async (req, res) => {
  try {
    const { serial, name, owner, type } = req.body;

    if (typeof serial !== "string" || !serial.trim()) {
      return res.status(400).json({ success: false, error: "Serial is required" });
    }
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, error: "Name is required" });
    }

    const docRef = db.collection("boats").doc(serial.trim());
    const existing = await docRef.get();

    if (existing.exists && existing.data().registered === true) {
      return res.status(409).json({ success: false, error: "Serial already registered" });
    }

    await docRef.set(
      {
        registered: true,
        name: name.trim(),
        owner: typeof owner === "string" ? owner.trim() : "",
        type: typeof type === "string" ? type.trim() : "",
        registeredAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Error in /api/register-boat:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ========== API: remove a boat's registration ==========
// DELETE /api/boats/:serial
// Clears the name/owner/type/registered flag but leaves any telemetry
// (lat, lon, bat1, bat2, sos, updatedAt, history) untouched.
app.delete("/api/boats/:serial", async (req, res) => {
  try {
    const serial = req.params.serial.trim();
    const docRef = db.collection("boats").doc(serial);
    const existing = await docRef.get();

    if (!existing.exists || existing.data().registered !== true) {
      return res.status(404).json({ success: false, error: "Boat is not registered" });
    }

    await docRef.set(
      {
        registered: false,
        name: admin.firestore.FieldValue.delete(),
        owner: admin.firestore.FieldValue.delete(),
        type: admin.firestore.FieldValue.delete(),
        registeredAt: admin.firestore.FieldValue.delete(),
      },
      { merge: true }
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Error in DELETE /api/boats/:serial:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ========== API: list registered boats ==========
// GET /api/boats
app.get("/api/boats", async (req, res) => {
  try {
    const snap = await db
      .collection("boats")
      .where("registered", "==", true)
      .get();

    const boats = [];
    snap.forEach((doc) => {
      const d = doc.data();
      const hasLocation =
        typeof d.lat === "number" && typeof d.lon === "number";

      boats.push({
        serial: doc.id,
        name: d.name ?? null,
        owner: d.owner ?? null,
        type: d.type ?? null,
        registeredAt: d.registeredAt ? d.registeredAt.toDate() : null,
        hasLocation,
        lat: hasLocation ? d.lat : null,
        lon: hasLocation ? d.lon : null,
        updatedAt: d.updatedAt ? d.updatedAt.toDate() : null,
      });
    });

    res.json({ boats });
  } catch (err) {
    console.error("Error in /api/boats:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Fallback to index.html
// app.get("*", (req, res) => {
//   res.sendFile(path.join(__dirname, "public", "index.html"));
// });

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
