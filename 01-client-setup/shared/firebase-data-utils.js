const admin = require('firebase-admin');
const logger = require('../../shared/utils/logger');

/**
 * Save client credentials to Master Firebase.
 * @param {FirebaseFirestore.Firestore} firestore - Master Firestore instance
 * @param {string} clientCode - Client identifier
 * @param {Object} firebaseOptions - Firebase configuration options
 * @param {boolean} isActive - Whether the client is active
 * @param {string|null} tinifyApiKey - Optional Tinify API key
 * @param {string} planType - Subscription plan type (essencial, profissional, ilimitado)
 * @returns {Promise<boolean>} True if save succeeded
 */
async function saveClientToMaster(
  firestore,
  clientCode,
  firebaseOptions,
  isActive = true,
  tinifyApiKey = null,
  planType = 'profissional'
) {
  logger.startSpinner('Saving client to Master Firebase...');

  try {
    const clientData = {
      isActive: isActive,
      firebase_options: firebaseOptions,
      planType: planType,
      planStartDate: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (tinifyApiKey) {
      clientData.tinifyApiKey = tinifyApiKey;
    }

    await firestore.collection('clients').doc(clientCode).set(clientData);

    logger.succeedSpinner(`Client ${clientCode} saved to Master Firebase (Plan: ${planType})`);
    return true;
  } catch (error) {
    logger.failSpinner(`Failed to save client: ${error.message}`);
    throw error;
  }
}

/**
 * Update client plan in Master Firebase.
 * @param {FirebaseFirestore.Firestore} firestore - Master Firestore instance
 * @param {string} clientCode - Client identifier
 * @param {string} newPlanType - New subscription plan type
 * @param {string} previousPlanType - Previous plan type (for history)
 * @returns {Promise<boolean>} True if update succeeded
 */
async function updateClientPlan(firestore, clientCode, newPlanType, previousPlanType = null) {
  logger.startSpinner(`Updating plan for ${clientCode}...`);

  try {
    const updateData = {
      planType: newPlanType,
      planStartDate: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (previousPlanType) {
      updateData.planHistory = admin.firestore.FieldValue.arrayUnion({
        planType: previousPlanType,
        changedAt: new Date().toISOString(),
        changedTo: newPlanType,
      });
    }

    await firestore.collection('clients').doc(clientCode).update(updateData);

    logger.succeedSpinner(`Plan updated: ${previousPlanType || 'unknown'} → ${newPlanType}`);
    return true;
  } catch (error) {
    logger.failSpinner(`Failed to update plan: ${error.message}`);
    throw error;
  }
}

/**
 * Get all clients from Master Firebase.
 * @param {FirebaseFirestore.Firestore} firestore - Master Firestore instance
 * @param {boolean} activeOnly - Filter only active clients
 * @returns {Promise<Array>} Array of client data with clientCode
 */
async function getAllClients(firestore, activeOnly = true) {
  try {
    let query = firestore.collection('clients');

    if (activeOnly) {
      query = query.where('isActive', '==', true);
    }

    const snapshot = await query.get();
    const clients = [];

    snapshot.forEach((doc) => {
      clients.push({
        clientCode: doc.id,
        ...doc.data(),
      });
    });

    return clients;
  } catch (error) {
    logger.error(`Failed to get clients: ${error.message}`);
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
  updateClientPlan,
  getAllClients,
};
