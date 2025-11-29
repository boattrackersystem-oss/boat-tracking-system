const fs = require('fs');
const path = require('path');
const admin = require("firebase-admin");
require('dotenv').config();

const isRender = process.env.DEV_ENV === 'production';

let serviceAccount;

if (isRender) {
    serviceAccount = JSON.parse(fs.readFileSync('/etc/secrets/sak.json', 'utf8'));
} else {
    serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, './sak.json')));
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

module.exports = { admin, db };
