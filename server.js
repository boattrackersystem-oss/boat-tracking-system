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
// expected JSON body: { lat, lon, bat1, bat2 }
app.post("/api/upload-boat-info", async (req, res) => {
  try {
    const { lat, lon, bat1, bat2 } = req.body;

    const data = {
      lat: typeof lat === "number" ? lat : null,
      lon: typeof lon === "number" ? lon : null,
      bat1: typeof bat1 === "number" ? bat1 : null, // light battery
      bat2: typeof bat2 === "number" ? bat2 : null, // transmitter battery
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Save current snapshot
    const docRef = db.collection("boats").doc("boat_1");
    await docRef.set(data, { merge: true });

    // Optional: also store in history subcollection
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

// ========== API: fetch latest boat info for front-end ==========
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
      updatedAt: data.updatedAt ? data.updatedAt.toDate() : null,
    });
  } catch (err) {
    console.error("Error in /api/boat:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Fallback to index.html for root
// app.get("*", (req, res) => {
//   res.sendFile(path.join(__dirname, "public", "index.html"));
// });

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
