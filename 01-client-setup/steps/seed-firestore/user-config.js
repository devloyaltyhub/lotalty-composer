const { v4: uuidv4 } = require('uuid');
const admin = require('firebase-admin');
const logger = require('../../../shared/utils/logger');

class UserConfig {
  constructor(app, firestore, targetBucket) {
    this.app = app;
    this.firestore = firestore;
    this.targetBucket = targetBucket;
  }

  async configureTestUser(testUserUid) {
    if (!testUserUid) {
      logger.warn('UID do usuario de teste nao fornecido, pulando configuracao');
      return { success: false, reason: 'no_uid' };
    }

    const demoUserUid = '2GJwqHeoKGgYJTCEjYrbbnydflg1';
    const bucket = admin.storage(this.app).bucket(this.targetBucket);

    logger.startSpinner('Configurando usuario de teste...');

    try {
      const oldPhotoPath = `profile_photos/${demoUserUid}.jpg`;
      const newPhotoPath = `profile_photos/${testUserUid}.jpg`;

      const oldFile = bucket.file(oldPhotoPath);
      const newFile = bucket.file(newPhotoPath);

      const [oldExists] = await oldFile.exists();

      let profilePhotoUrl = null;

      if (oldExists) {
        await oldFile.copy(newFile);

        const token = uuidv4();
        await newFile.setMetadata({
          metadata: {
            firebaseStorageDownloadTokens: token,
          },
        });

        const encodedPath = encodeURIComponent(newPhotoPath);
        profilePhotoUrl = `https://firebasestorage.googleapis.com/v0/b/${this.targetBucket}/o/${encodedPath}?alt=media&token=${token}`;

        await oldFile.delete();

        logger.updateSpinner('Foto de perfil migrada para novo UID');
      }

      const oldUserRef = this.firestore.collection('Users').doc(demoUserUid);
      const oldUserDoc = await oldUserRef.get();

      if (oldUserDoc.exists) {
        const userData = oldUserDoc.data();

        userData.userId = testUserUid;

        if (profilePhotoUrl) {
          userData.profilePhoto = profilePhotoUrl;
        }

        const newUserRef = this.firestore.collection('Users').doc(testUserUid);
        await newUserRef.set(userData);

        await oldUserRef.delete();

        logger.succeedSpinner(`Usuario de teste configurado: ${testUserUid}`);

        return {
          success: true,
          oldUid: demoUserUid,
          newUid: testUserUid,
          profilePhotoUrl,
        };
      } else {
        logger.warnSpinner('Documento do usuario demo nao encontrado');
        return { success: false, reason: 'demo_user_not_found' };
      }
    } catch (error) {
      logger.failSpinner(`Erro ao configurar usuario de teste: ${error.message}`);
      throw error;
    }
  }
}

module.exports = UserConfig;
