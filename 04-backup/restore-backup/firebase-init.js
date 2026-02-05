/**
 * Firebase initialization for restore-backup
 */

const fs = require('fs');
const path = require('path');

async function initializeFirebase(clientName, projectId) {
  const admin = require('firebase-admin');

  const credentialsPath = path.join(
    process.cwd(),
    'credentials',
    `${clientName}.json`
  );

  if (!fs.existsSync(credentialsPath)) {
    throw new Error(`Credenciais nao encontradas: ${credentialsPath}`);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

  const appName = `restore-${clientName}-${Date.now()}`;

  const app = admin.initializeApp(
    {
      credential: admin.credential.cert(serviceAccount),
      storageBucket: `${projectId}.appspot.com`,
    },
    appName
  );

  return {
    app,
    firestore: admin.firestore(app),
    storage: admin.storage(app).bucket(),
  };
}

module.exports = {
  initializeFirebase,
};
