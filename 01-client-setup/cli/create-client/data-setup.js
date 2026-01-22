const admin = require("firebase-admin");
const logger = require("../../../shared/utils/logger");
const DataSeeder = require("../../steps/seed-firestore-data");
const { StorageImporter } = require("../../../03-data-management");

async function seedDefaultData(config, firebaseClient) {
  logger.section("Seeding Default Data");

  await firebaseClient.initializeClientFirebase(
    config.clientCode,
    config.firebaseOptions,
    config.serviceAccountPath,
  );

  const clientApp = firebaseClient.apps.get(config.clientCode);
  const targetBucket = config.firebaseOptions.storageBucket;
  const seeder = new DataSeeder(clientApp, targetBucket);

  let seederReference = null;

  if (seeder.hasSnapshot()) {
    logger.info("Usando snapshot do demo project...");

    let urlMapping = {};
    logger.startSpinner("Importando arquivos do Storage...");
    try {
      const storageImporter = new StorageImporter(clientApp, targetBucket);
      urlMapping = await storageImporter.importAll();
      logger.succeedSpinner("Arquivos do Storage importados");
    } catch (error) {
      logger.failSpinner(`Erro ao importar Storage: ${error.message}`);
    }

    await seeder.seedFromSnapshot(urlMapping);
    seederReference = seeder;
  } else {
    logger.warn("Snapshot nao encontrado. Usando dados basicos...");
    await seeder.seedWithDefaults(config.clientName, config.businessType, config.primaryColor);
  }

  logger.success("Default data seeded");
  return seederReference;
}

async function createTestUser(config, firebaseClient, seeder) {
  logger.section("Creating Test User");

  const testEmail = "contato@loyaltyhub.club";
  const testPassword = "LoyaltyHub2024!";

  const clientApp = firebaseClient.apps.get(config.clientCode);
  const auth = admin.auth(clientApp);

  let testUserUid = null;

  try {
    const existingUser = await auth.getUserByEmail(testEmail);
    testUserUid = existingUser.uid;
    logger.info(`Usuario de teste existente encontrado: ${testUserUid}`);
  } catch {
    try {
      const newUser = await auth.createUser({
        email: testEmail,
        password: testPassword,
        displayName: "Loyalty Hub User",
        emailVerified: true,
      });
      testUserUid = newUser.uid;
      logger.info(`Usuario de teste criado: ${testUserUid}`);
    } catch (createError) {
      logger.warn(`Falha ao criar usuario de teste: ${createError.message}`);
      return null;
    }
  }

  if (testUserUid && seeder) {
    await seeder.configureTestUser(testUserUid);
  }

  logger.success("Test user configured");

  return {
    email: testEmail,
    password: testPassword,
    uid: testUserUid,
  };
}

async function createAdminUser(config, firebaseClient) {
  logger.section("Creating Admin User");

  const AdminUserCreator = require("../../steps/create-admin-user");

  const creator = new AdminUserCreator(firebaseClient.apps.get(config.clientCode));
  const result = await creator.createAndNotify({
    email: config.adminEmail,
    name: "Admin",
    clientCode: config.clientCode,
    clientName: config.folderName,
    clientFolder: config.clientFolder,
    sendTelegram: true,
    displayNow: false,
  });

  logger.success("Admin user created");

  return {
    email: result.email,
    password: result.password,
  };
}

module.exports = {
  seedDefaultData,
  createTestUser,
  createAdminUser,
};
