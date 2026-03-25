/**
 * Busca inteligente de usuários no Firestore
 * Suporta busca por nome (case-insensitive), CPF, email ou document ID
 */

function capitalize(str) {
  return str
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

async function searchByNameVariants(firestore, query) {
  const seen = new Set();
  const results = [];

  const variants = [
    query,
    capitalize(query),
    query.toLowerCase(),
    query.toUpperCase(),
    query.charAt(0).toUpperCase() + query.slice(1),
  ];

  const uniqueVariants = [...new Set(variants)];

  const searches = uniqueVariants.map((v) =>
    firestore
      .collection('Users')
      .where('name', '>=', v)
      .where('name', '<=', v + '\uf8ff')
      .limit(10)
      .get()
  );

  const snapshots = await Promise.all(searches);

  for (const snap of snapshots) {
    snap.forEach((doc) => {
      if (!seen.has(doc.id)) {
        seen.add(doc.id);
        results.push({ id: doc.id, ...doc.data() });
      }
    });
  }

  return results;
}

async function searchByCpf(firestore, query) {
  const formatted = query.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  const raw = query.replace(/\D/g, '');
  const cpfVariants = [...new Set([query, formatted, raw])];

  for (const cpf of cpfVariants) {
    const snap = await firestore
      .collection('Users')
      .where('cpf', '==', cpf)
      .limit(5)
      .get();
    if (!snap.empty) {
      const results = [];
      snap.forEach((doc) => results.push({ id: doc.id, ...doc.data() }));
      return results;
    }
  }

  return [];
}

async function searchByEmail(firestore, query) {
  const snap = await firestore
    .collection('Users')
    .where('email', '==', query.toLowerCase())
    .limit(5)
    .get();

  if (snap.empty) return [];

  const results = [];
  snap.forEach((doc) => results.push({ id: doc.id, ...doc.data() }));
  return results;
}

async function searchByDocId(firestore, query) {
  const doc = await firestore.collection('Users').doc(query).get();
  if (!doc.exists) return [];
  return [{ id: doc.id, ...doc.data() }];
}

/**
 * Busca usuário por nome, CPF, email ou document ID
 * Tenta nome primeiro, depois CPF, email e por último ID direto
 *
 * @param {FirebaseFirestore.Firestore} firestore - Instância do Firestore
 * @param {string} query - Termo de busca
 * @returns {Promise<Array>} Lista de usuários encontrados
 */
async function searchUser(firestore, query) {
  const trimmed = query.trim();

  const byName = await searchByNameVariants(firestore, trimmed);
  if (byName.length > 0) return byName;

  const isCpf = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(trimmed);
  if (isCpf) {
    const byCpf = await searchByCpf(firestore, trimmed);
    if (byCpf.length > 0) return byCpf;
  }

  if (trimmed.includes('@')) {
    const byEmail = await searchByEmail(firestore, trimmed);
    if (byEmail.length > 0) return byEmail;
  }

  return searchByDocId(firestore, trimmed);
}

module.exports = { searchUser };
