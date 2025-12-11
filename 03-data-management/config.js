const path = require('path');

module.exports = {
  demoProject: {
    projectId: 'loyalty-hub-1f47c',
    storageBucket: 'loyalty-hub-1f47c.firebasestorage.app',
  },

  // Coleções do Firestore para seed de novos clientes
  // NOTA: Notifications removida - contém projectId hardcoded que não deve ser migrado
  // Clients_Score e Consumptions são mantidos para screenshots do usuário de teste
  collections: [
    'Campaigns',
    'Categories',
    'Clients_Score',
    'Consumptions',
    'Happy_Hours',
    'Image_Mappings',
    'Our_Story',
    'Products',
    'Store_Configs',
    'Suggestions_Box',
    'Team_Members',
    'Users',
    'Users_Admin',
  ],

  // TODOS os paths do Storage
  storagePaths: ['gallery', 'profile_photos'],

  // Diretório de saída do snapshot
  snapshotDir: path.join(__dirname, '../shared/templates/demo-snapshot'),

  // Configurações de export
  export: {
    batchSize: 500, // Documentos por batch
    concurrentDownloads: 5, // Downloads paralelos de Storage
    timeout: 300000, // 5 minutos por operação
  },

  // Configurações de import
  import: {
    batchSize: 500, // Documentos por batch do Firestore
    concurrentUploads: 5, // Uploads paralelos de Storage
  },
};
