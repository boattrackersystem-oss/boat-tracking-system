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

    const docRef = db.collection("boats").doc("boat_1");

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
app.get("/api/boat", async (req, res) => {
  try {
    const docRef = db.collection("boats").doc("boat_1");
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.json({
        hasLocation: false,
        lat: null,
        lon: null,
        bat1: null,
        bat2: null,
        sos: 0,
        updatedAt: null,
      });
    }

    const data = doc.data();
    const hasLocation =
      typeof data.lat === "number" && typeof data.lon === "number";

    res.json({
      hasLocation,
      lat: hasLocation ? data.lat : null,
      lon: hasLocation ? data.lon : null,
      bat1: data.bat1 ?? null,
      bat2: data.bat2 ?? null,
      sos: data.sos === 1 ? 1 : 0,
      updatedAt: data.updatedAt ? data.updatedAt.toDate() : null,
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

    const docRef = db.collection("boats").doc("boat_1");
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

    res.json({ items });
  } catch (err) {
    console.error("Error in /api/boat/history:", err);
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
