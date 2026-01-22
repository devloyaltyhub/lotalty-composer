const admin = require('firebase-admin');
const logger = require('../../shared/utils/logger');

/**
 * Save client credentials to Master Firebase.
 * @param {FirebaseFirestore.Firestore} firestore - Master Firestore instance
 * @param {string} clientCode - Client identifier
 * @param {Object} firebaseOptions - Firebase configuration options
 * @param {boolean} isActive - Whether the client is active
 * @param {string|null} tinifyApiKey - Optional Tinify API key
 * @returns {Promise<boolean>} True if save succeeded
 */
async function saveClientToMaster(
  firestore,
  clientCode,
  firebaseOptions,
  isActive = true,
  tinifyApiKey = null
) {
  logger.startSpinner('Saving client to Master Firebase...');

  try {
    const clientData = {
      isActive: isActive,
      firebase_options: firebaseOptions,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (tinifyApiKey) {
      clientData.tinifyApiKey = tinifyApiKey;
    }

    await firestore.collection('clients').doc(clientCode).set(clientData);

    logger.succeedSpinner(`Client ${clientCode} saved to Master Firebase`);
    return true;
  } catch (error) {
    logger.failSpinner(`Failed to save client: ${error.message}`);
    throw error;
  }
}

/**
 * Get client data from Master Firebase.
 * @param {FirebaseFirestore.Firestore} firestore - Master Firestore instance
 * @param {string} clientCode - Client identifier
 * @returns {Promise<Object|null>} Client data or null if not found
 */
async function getClientFromMaster(firestore, clientCode) {
  try {
    const doc = await firestore.collection('clients').doc(clientCode).get();

    if (!doc.exists) {
      return null;
    }

    return doc.data();
  } catch (error) {
    logger.error(`Failed to get client: ${error.message}`);
    throw error;
  }
}

/**
 * Check if client code exists in Master Firebase.
 * @param {FirebaseFirestore.Firestore} firestore - Master Firestore instance
 * @param {string} clientCode - Client identifier
 * @returns {Promise<boolean>} True if client exists
 */
async function clientExists(firestore, clientCode) {
  const client = await getClientFromMaster(firestore, clientCode);
  return client !== null;
}

/**
 * Seed data to client Firestore.
 * @param {FirebaseFirestore.Firestore} firestore - Client Firestore instance
 * @param {Object} data - Data to seed { collection: { docId: docData } }
 * @returns {Promise<boolean>} True if seeding succeeded
 */
async function seedClientData(firestore, data) {
  logger.startSpinner('Seeding default data to client Firestore...');

  try {
    const batch = firestore.batch();

    for (const [collection, documents] of Object.entries(data)) {
      for (const [docId, docData] of Object.entries(documents)) {
        const ref = firestore.collection(collection).doc(docId);
        batch.set(ref, docData);
      }
    }

    await batch.commit();
    logger.succeedSpinner('Default data seeded successfully');
    return true;
  } catch (error) {
    logger.failSpinner(`Failed to seed data: ${error.message}`);
    throw error;
  }
}

/**
 * Create admin user in client Firestore.
 * @param {FirebaseFirestore.Firestore} firestore - Client Firestore instance
 * @param {Object} adminData - Admin user data
 * @returns {Promise<boolean>} True if creation succeeded
 */
async function createAdminUser(firestore, adminData) {
  logger.startSpinner('Creating admin user...');

  try {
    await firestore.collection('Admin_Users').add({
      ...adminData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.succeedSpinner('Admin user created successfully');
    return true;
  } catch (error) {
    logger.failSpinner(`Failed to create admin user: ${error.message}`);
    throw error;
  }
}

module.exports = {
  saveClientToMaster,
  getClientFromMaster,
  clientExists,
  seedClientData,
  createAdminUser,
};
