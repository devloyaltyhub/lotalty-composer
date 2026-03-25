/**
 * Migração: Adiciona storeName ao App_Config de cada cliente.
 *
 * Lê clientName do config.json local e grava storeName no
 * App_Config/config do Firestore de cada cliente.
 *
 * Uso:
 *   node 03-data-management/migrate-store-name.js
 *   node 03-data-management/migrate-store-name.js --dry-run
 */

const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

const CLIENTS_DIR = path.resolve(__dirname, "../../loyalty-app/clients");
const CREDENTIALS_DIR = path.resolve(
  __dirname,
  "../../loyalty-cloud-service/credentials",
);

const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(
    dryRun
      ? "🔍 DRY RUN — nenhuma alteração será feita"
      : "🚀 Migrando storeName para App_Config...",
  );

  const clientDirs = fs
    .readdirSync(CLIENTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const clientCode of clientDirs) {
    const configPath = path.join(CLIENTS_DIR, clientCode, "config.json");
    if (!fs.existsSync(configPath)) {
      console.log(`  ⚠ ${clientCode}: config.json não encontrado, pulando`);
      continue;
    }

    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const clientName = config.clientName;
    const projectId = config.firebaseProjectId;

    if (!clientName || !projectId) {
      console.log(
        `  ⚠ ${clientCode}: clientName ou projectId ausente, pulando`,
      );
      continue;
    }

    const credentialFile = findCredential(projectId);
    if (!credentialFile) {
      console.log(
        `  ⚠ ${clientCode}: credencial não encontrada para ${projectId}, pulando`,
      );
      continue;
    }

    if (dryRun) {
      console.log(
        `  ✓ ${clientCode}: gravaria storeName="${clientName}" em ${projectId}`,
      );
      continue;
    }

    try {
      const serviceAccount = JSON.parse(fs.readFileSync(credentialFile, "utf-8"));
      const appName = `migrate-${projectId}`;
      const existingApp = admin.apps.find((a) => a?.name === appName);
      const app =
        existingApp ||
        admin.initializeApp(
          { credential: admin.credential.cert(serviceAccount), projectId },
          appName,
        );

      const db = admin.firestore(app);
      const docRef = db.collection("App_Config").doc("config");
      const snap = await docRef.get();

      if (snap.exists && snap.data()?.storeName) {
        console.log(
          `  ⏭ ${clientCode}: storeName já existe (${snap.data().storeName})`,
        );
        continue;
      }

      await docRef.set({ storeName: clientName }, { merge: true });
      console.log(
        `  ✅ ${clientCode}: storeName="${clientName}" gravado em ${projectId}`,
      );
    } catch (error) {
      console.error(
        `  ❌ ${clientCode}: erro ao gravar — ${error.message}`,
      );
    }
  }

  console.log("\n✅ Migração concluída");
  process.exit(0);
}

function findCredential(projectId) {
  if (!fs.existsSync(CREDENTIALS_DIR)) return null;
  const files = fs.readdirSync(CREDENTIALS_DIR).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const filePath = path.join(CREDENTIALS_DIR, file);
    try {
      const sa = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (sa.project_id === projectId) return filePath;
    } catch {
      // ignora arquivos malformados
    }
  }
  return null;
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
