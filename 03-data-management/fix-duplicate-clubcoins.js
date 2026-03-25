#!/usr/bin/env node

/**
 * Fix Duplicate ClubCoins - Reversao de creditacao duplicada
 *
 * Este script corrige consumptions duplicadas criadas pelo bug de
 * reprocessamento do PDV (cron a cada minuto sem idempotencia).
 *
 * O que faz:
 * 1. Busca todas Consumptions com source='pdv' do usuario afetado
 * 2. Agrupa por purchaseEventId
 * 3. Para cada grupo com >1: identifica duplicatas (mantém a 1a)
 * 4. Calcula excesso de ClubCoins, totalConsumed e clientScore
 * 5. Corrige Users/{userId}/club.* subtraindo o excesso
 * 6. Remove Consumptions e Clients_Score duplicados
 *
 * Usage:
 *   node fix-duplicate-clubcoins.js                    # Dry run (mostra o que faria)
 *   node fix-duplicate-clubcoins.js --execute          # Executa a reversao
 *   node fix-duplicate-clubcoins.js --cpf 16800749702  # Filtrar por CPF especifico
 */

const path = require('path');
const admin = require('firebase-admin');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const PROJECT_ID = 'na-rede-loyalty-hub-club-4948';
const APP_NAME = 'fix-duplicate-clubcoins';

function getServiceAccountPath() {
  let credPath =
    process.env.MASTER_FIREBASE_SERVICE_ACCOUNT ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!credPath) {
    throw new Error('No service account configured in .env');
  }

  credPath = credPath.replace(/\$([A-Z_][A-Z0-9_]*)/g, (_, varName) => {
    return process.env[varName] || _;
  });

  return credPath;
}

function initFirebase() {
  const serviceAccountPath = getServiceAccountPath();
  const serviceAccount = require(path.resolve(serviceAccountPath));

  try {
    return admin.initializeApp(
      {
        credential: admin.credential.cert(serviceAccount),
        projectId: PROJECT_ID,
      },
      APP_NAME,
    );
  } catch (e) {
    if (e.code === 'app/duplicate-app') {
      return admin.app(APP_NAME);
    }
    throw e;
  }
}

async function findDuplicateConsumptions(db, cpfFilter) {
  console.log('\n=== Buscando Consumptions com source=pdv ===\n');

  let query = db.collection('Consumptions').where('source', '==', 'pdv');

  if (cpfFilter) {
    query = query.where('userCpf', '==', cpfFilter);
  }

  const snapshot = await query.get();
  console.log(`Total de Consumptions PDV encontradas: ${snapshot.size}`);

  // Agrupar por externalSaleId (ID real da venda no PDV)
  // Usamos externalSaleId porque o purchaseEventId eh um UUID diferente
  // para cada PurchaseEvent duplicado da mesma venda
  const groups = {};
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const saleId = data.externalSaleId || data.purchaseEventId;
    if (!saleId) {
      continue;
    }

    if (!groups[saleId]) {
      groups[saleId] = [];
    }
    groups[saleId].push({ docId: doc.id, ...data });
  }

  // Encontrar grupos com duplicatas
  const duplicateGroups = {};
  for (const [eventId, consumptions] of Object.entries(groups)) {
    if (consumptions.length > 1) {
      // Ordenar por createdAt para manter a primeira
      consumptions.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() ?? a.createdAt ?? new Date(0);
        const dateB = b.createdAt?.toDate?.() ?? b.createdAt ?? new Date(0);
        return dateA - dateB;
      });
      duplicateGroups[eventId] = consumptions;
    }
  }

  return duplicateGroups;
}

async function calculateDamage(duplicateGroups) {
  console.log('\n=== Calculando danos ===\n');

  const damage = {
    totalDuplicateConsumptions: 0,
    excessClubCoins: 0,
    excessTotalConsumed: 0,
    excessClientScore: 0,
    consumptionIdsToRemove: [],
    scoreIdsToRemove: [],
    affectedUsers: new Set(),
  };

  for (const [eventId, consumptions] of Object.entries(duplicateGroups)) {
    const original = consumptions[0];
    const duplicates = consumptions.slice(1);

    console.log(
      `  purchaseEventId: ${eventId}` +
      ` | original: ${original.docId}` +
      ` | duplicatas: ${duplicates.length}` +
      ` | pontos/cada: ${original.clubCoinsPoints}` +
      ` | valor/cada: R$${original.amount}`
    );

    for (const dup of duplicates) {
      damage.totalDuplicateConsumptions++;
      damage.excessClubCoins += dup.clubCoinsPoints ?? 0;
      damage.excessTotalConsumed += dup.amount ?? 0;
      damage.excessClientScore += Math.round(dup.amount ?? 0);
      damage.consumptionIdsToRemove.push(dup.docId);
      damage.affectedUsers.add(dup.userId);
    }
  }

  return damage;
}

async function findOrphanScores(db, consumptionIds) {
  const scoreIds = [];

  // Buscar em batches de 10 (limite do Firestore 'in' query)
  for (let i = 0; i < consumptionIds.length; i += 10) {
    const batch = consumptionIds.slice(i, i + 10);
    const snapshot = await db
      .collection('Clients_Score')
      .where('sourceConsumptionId', 'in', batch)
      .get();

    for (const doc of snapshot.docs) {
      scoreIds.push(doc.id);
    }
  }

  return scoreIds;
}

async function executeReversal(db, damage) {
  console.log('\n=== EXECUTANDO REVERSAO ===\n');

  // 1. Corrigir totais dos usuarios
  for (const userId of damage.affectedUsers) {
    console.log(`Corrigindo usuario ${userId}...`);
    const userRef = db.collection('Users').doc(userId);

    await userRef.update({
      'club.totalClubCoins': admin.firestore.FieldValue.increment(-damage.excessClubCoins),
      'club.totalConsumed': admin.firestore.FieldValue.increment(-damage.excessTotalConsumed),
      'club.clientScore': admin.firestore.FieldValue.increment(-damage.excessClientScore),
      'club.currentYearConsumption': admin.firestore.FieldValue.increment(-damage.excessTotalConsumed),
      updatedAt: new Date(),
    });

    // Verificar resultado
    const updatedDoc = await userRef.get();
    const club = updatedDoc.data()?.club ?? {};
    console.log(`  Novos totais: ClubCoins=${club.totalClubCoins}, Consumido=R$${club.totalConsumed}, Score=${club.clientScore}`);
  }

  // 2. Remover Consumptions duplicadas
  console.log(`\nRemovendo ${damage.consumptionIdsToRemove.length} Consumptions duplicadas...`);
  const consumptionBatches = chunkArray(damage.consumptionIdsToRemove, 500);
  for (const chunk of consumptionBatches) {
    const batch = db.batch();
    for (const id of chunk) {
      batch.delete(db.collection('Consumptions').doc(id));
    }
    await batch.commit();
  }

  // 3. Remover Clients_Score orfaos
  console.log(`Removendo ${damage.scoreIdsToRemove.length} Clients_Score orfaos...`);
  const scoreBatches = chunkArray(damage.scoreIdsToRemove, 500);
  for (const chunk of scoreBatches) {
    const batch = db.batch();
    for (const id of chunk) {
      batch.delete(db.collection('Clients_Score').doc(id));
    }
    await batch.commit();
  }

  console.log('\nReversao concluida com sucesso!');
}

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');
  const cpfIndex = args.indexOf('--cpf');
  let cpfFilter = cpfIndex !== -1 ? args[cpfIndex + 1] : null;

  // Formatar CPF se necessario (168.007.497-02)
  if (cpfFilter) {
    const digits = cpfFilter.replace(/\D/g, '');
    if (digits.length === 11 && !cpfFilter.includes('.')) {
      cpfFilter = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    }
  }

  console.log('=== Fix Duplicate ClubCoins ===');
  console.log(`Projeto: ${PROJECT_ID}`);
  console.log(`Modo: ${execute ? 'EXECUTAR' : 'DRY RUN (use --execute para aplicar)'}`);
  if (cpfFilter) {
    console.log(`Filtro CPF: ${cpfFilter}`);
  }

  const app = initFirebase();
  const db = admin.firestore(app);

  const duplicateGroups = await findDuplicateConsumptions(db, cpfFilter);
  const groupCount = Object.keys(duplicateGroups).length;

  if (groupCount === 0) {
    console.log('\nNenhuma duplicata encontrada! Nada a corrigir.');
    process.exit(0);
  }

  console.log(`\nEncontrados ${groupCount} purchaseEvents com duplicatas`);

  const damage = await calculateDamage(duplicateGroups);

  // Buscar Clients_Score orfaos
  damage.scoreIdsToRemove = await findOrphanScores(db, damage.consumptionIdsToRemove);

  console.log('\n=== RESUMO ===');
  console.log(`Consumptions duplicadas: ${damage.totalDuplicateConsumptions}`);
  console.log(`ClubCoins em excesso: ${damage.excessClubCoins}`);
  console.log(`Total consumido em excesso: R$${damage.excessTotalConsumed.toFixed(2)}`);
  console.log(`ClientScore em excesso: ${damage.excessClientScore}`);
  console.log(`Clients_Score orfaos: ${damage.scoreIdsToRemove.length}`);
  console.log(`Usuarios afetados: ${damage.affectedUsers.size}`);

  if (!execute) {
    console.log('\n*** DRY RUN - Nenhuma alteracao foi feita ***');
    console.log('Use --execute para aplicar as correcoes');
    process.exit(0);
  }

  await executeReversal(db, damage);
  process.exit(0);
}

main().catch((error) => {
  console.error('Erro fatal:', error);
  process.exit(1);
});
