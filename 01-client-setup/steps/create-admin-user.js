const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const logger = require('../../shared/utils/logger');
const telegram = require('../../shared/utils/telegram');

class AdminUserCreator {
  constructor(firebaseApp) {
    this.app = firebaseApp;
    this.firestore = admin.firestore(firebaseApp);
  }

  // Generate random password
  generatePassword(length = 12) {
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';

    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      password += charset[randomIndex];
    }

    return password;
  }

  // Hash password with SHA-256 (matching admin app)
  hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  // Create admin user in Firebase Auth and Firestore
  async createAdminUser(email, name, clientCode) {
    logger.startSpinner('Creating admin user...');

    try {
      // Generate password
      const password = this.generatePassword();

      // Step 1: Create user in Firebase Auth
      logger.updateSpinner('Creating user in Firebase Auth...');
      let userRecord;
      try {
        userRecord = await admin.auth(this.app).createUser({
          email: email,
          password: password,
          displayName: name || 'Administrador',
        });
      } catch (authError) {
        // If user already exists in Auth, get their uid
        if (authError.code === 'auth/email-already-exists') {
          logger.info(`User ${email} already exists in Auth, fetching uid...`);
          userRecord = await admin.auth(this.app).getUserByEmail(email);
        } else {
          throw authError;
        }
      }

      // Step 2: Use Firebase Auth uid as document ID
      const docId = userRecord.uid;

      // Step 3: Create user document in Firestore (without passwordHash - password is in Auth)
      logger.updateSpinner('Creating admin document in Firestore...');
      const userData = {
        id: docId,
        name: name || 'Administrador',
        email: email,
        // passwordHash removed - password is managed by Firebase Auth
        isActive: true,
        permissions: [
          'viewStoreConfigs',
          'editStoreConfigs',
          'viewProducts',
          'createProducts',
          'editProducts',
          'deleteProducts',
          'viewConsumptions',
          'createConsumptions',
          'editConsumptions',
          'deleteConsumptions',
          'viewOrders',
          'updateOrderStatus',
          'viewTeamMembers',
          'createTeamMembers',
          'editTeamMembers',
          'deleteTeamMembers',
          'viewDashboardReport',
          'viewConsumptionsReport',
          'viewClientsReport',
          'viewAgeismReport',
          'viewCampaigns',
          'editCampaigns',
          'deleteCampaigns',
          'viewHappyHours',
          'createHappyHours',
          'editHappyHours',
          'deleteHappyHours',
          'viewSuggestions',
          'createSuggestions',
          'validateSuggestions',
          'deleteSuggestions',
          'viewOurStory',
          'editOurStory',
          'manageAdminUsers',
          'viewUsers',
          'editUsers',
          'deleteUsers',
        ],
        role: 'superAdmin',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: null,
        lastLoginAt: null,
      };

      // Add to Firestore with Firebase Auth uid as document ID
      const docRef = this.firestore.collection('Users_Admin').doc(docId);
      await docRef.set(userData);

      logger.succeedSpinner(`Admin user created: ${email} (uid: ${docId})`);

      return {
        success: true,
        userId: docId,
        email: email,
        password: password, // Plain password for display
        clientCode: clientCode,
      };
    } catch (error) {
      logger.failSpinner('Failed to create admin user');
      throw error;
    }
  }

  // Save credentials to file
  saveCredentialsToFile(clientFolder, clientCode, email, password) {
    const credentialsPath = path.join(clientFolder, 'admin-credentials.txt');

    const content = `
═══════════════════════════════════════════
  LOYALTYHUB - ADMIN APP CREDENTIALS
═══════════════════════════════════════════

Client Code: ${clientCode}
Email: ${email}
Temporary Password: ${password}

═══════════════════════════════════════════
  IMPORTANT INSTRUCTIONS
═══════════════════════════════════════════

1. Download the Admin App from:
   https://loyaltyhub.com/downloads

2. Open the app and login with:
   - Client Code: ${clientCode}
   - Email: ${email}
   - Password: ${password}

3. CHANGE YOUR PASSWORD immediately after
   first login for security.

4. Keep these credentials SECURE and do not
   share them with unauthorized persons.

═══════════════════════════════════════════
  Generated: ${new Date().toISOString()}
═══════════════════════════════════════════
    `.trim();

    try {
      // Ensure directory exists
      if (!fs.existsSync(clientFolder)) {
        fs.mkdirSync(clientFolder, { recursive: true });
      }

      fs.writeFileSync(credentialsPath, content, 'utf8');
      logger.info(`Credentials saved to: ${credentialsPath}`);

      return credentialsPath;
    } catch (error) {
      logger.warn(`Failed to save credentials to file: ${error.message}`);
      return null;
    }
  }

  // Display credentials in console
  displayCredentials(clientCode, email, password, clientName) {
    logger.blank();
    logger.credentialsBox(clientCode, email, password);

    logger.info(`📄 Credentials saved to: clients/${clientName}/admin-credentials.txt`);
    logger.blank();
  }

  // Send credentials via Telegram
  async sendCredentialsViaTelegram(clientName, clientCode, email, password) {
    try {
      await telegram.adminCredentials(clientName, clientCode, email, password);
    } catch (error) {
      logger.warn(`Failed to send credentials via Telegram: ${error.message}`);
    }
  }

  // Complete admin user creation flow
  async createAndNotify(config) {
    const {
      email,
      name,
      clientCode,
      clientName,
      clientFolder,
      sendTelegram = true,
      displayNow = false, // NEW: option to display credentials immediately or defer
    } = config;

    try {
      // Create admin user
      const result = await this.createAdminUser(email, name, clientCode);

      // Save to file
      this.saveCredentialsToFile(clientFolder, clientCode, email, result.password);

      // Display in console (only if displayNow is true)
      if (displayNow) {
        this.displayCredentials(clientCode, email, result.password, clientName);
      }

      // Send via Telegram (optional)
      if (sendTelegram) {
        await this.sendCredentialsViaTelegram(clientName, clientCode, email, result.password);
      }

      return {
        ...result,
        credentialsFile: path.join(clientFolder, 'admin-credentials.txt'),
      };
    } catch (error) {
      logger.error(`Admin user creation failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = AdminUserCreator;

// Allow running directly for testing
if (require.main === module) {
  const testCreate = async () => {
    try {
      require('dotenv').config({ path: path.join(__dirname, '../../.env') });

      let credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

      // Expand environment variables like $HOME
      credPath = credPath.replace(/\$([A-Z_][A-Z0-9_]*)/g, (match, varName) => {
        return process.env[varName] || match;
      });

      const serviceAccount = require(credPath);
      const projectId = process.argv[2] || 'test-project';
      const email = process.argv[3] || 'admin@test.com';

      const app = admin.initializeApp(
        {
          credential: admin.credential.cert(serviceAccount),
          projectId: projectId,
        },
        'admin-creator-test'
      );

      const creator = new AdminUserCreator(app);
      await creator.createAndNotify({
        email: email,
        name: 'Admin Test',
        clientCode: '101',
        clientName: 'test-client',
        clientFolder: './test-output',
        sendTelegram: false,
        displayNow: true, // Show credentials immediately for testing
      });

      logger.success('Admin user creation test completed!');
      process.exit(0);
    } catch (error) {
      logger.error(`Test failed: ${error.message}`);
      process.exit(1);
    }
  };

  testCreate();
}
