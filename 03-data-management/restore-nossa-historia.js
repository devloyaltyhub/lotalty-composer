#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const admin = require('firebase-admin');
const { WHITE_LABEL_APP_ROOT } = require('../shared/utils/paths');

const FILES = [
  { local: path.join(os.homedir(), 'Desktop/na-rede/1.jpg'), remote: 'gallery/nossa-historia-1.jpg' },
  { local: path.join(os.homedir(), 'Desktop/na-rede/2.jpg'), remote: 'gallery/nossa-historia-2.jpg' },
  { local: path.join(os.homedir(), 'Desktop/na-rede/3.jpg'), remote: 'gallery/nossa-historia-3.jpg' },
];

async function main() {
  const projectId = 'na-rede-loyalty-hub-club-4948';
  const storageBucket = 'na-rede-loyalty-hub-club-4948.firebasestorage.app';

  const serviceAccount = require(path.join(WHITE_LABEL_APP_ROOT, 'service-account.json'));

  const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId,
    storageBucket,
  });

  const bucket = admin.storage(app).bucket();

  console.log('Restaurando fotos Nossa História...\n');

  for (const { local, remote } of FILES) {
    const buffer = fs.readFileSync(local);
    const file = bucket.file(remote);

    await file.save(buffer, { metadata: { contentType: 'image/jpeg' } });
    console.log(`  OK  ${remote} (${(buffer.length / 1024).toFixed(1)} KB)`);
  }

  console.log('\nAtualizando tokens e URLs no Firestore...\n');

  const { v4: uuidv4 } = require('uuid');
  const db = admin.firestore(app);

  const storySnapshot = await db.collection('Our_Story').doc('story').get();
  if (!storySnapshot.exists) {
    console.log('  Doc Our_Story/story não encontrado');
    await app.delete();
    return;
  }

  const storyData = storySnapshot.data();
  const updatedPhotos = [];

  for (const photoUrl of storyData.photos) {
    const match = FILES.find(f => photoUrl.includes(f.remote.replace('gallery/', '')));

    if (match) {
      const file = bucket.file(match.remote);
      const token = uuidv4();
      await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });

      const encodedPath = encodeURIComponent(match.remote);
      const newUrl = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${encodedPath}?alt=media&token=${token}`;
      updatedPhotos.push(newUrl);
      console.log(`  OK  ${match.remote} -> nova URL com token`);
    } else {
      updatedPhotos.push(photoUrl);
    }
  }

  await db.collection('Our_Story').doc('story').update({ photos: updatedPhotos });
  console.log('\n  Firestore Our_Story/story atualizado');

  await app.delete();
  console.log('\nRestauração completa!');
}

main().catch(console.error);
