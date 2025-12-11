const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// loyalty-app is a sibling to loyalty-compose
const LOYALTY_APP_ROOT = path.resolve(__dirname, '../../loyalty-app');
const pubspecPath = path.join(LOYALTY_APP_ROOT, 'white_label_app/pubspec.yaml');

// Parse command line arguments
const args = process.argv.slice(2);
const bumpType = args[0] || 'build'; // build, patch, minor, major

// Validate bump type
const validBumpTypes = ['build', 'patch', 'minor', 'major'];
if (!validBumpTypes.includes(bumpType)) {
  console.error(`❌ Tipo de bump inválido: "${bumpType}"`);
  console.error(`   Opções válidas: ${validBumpTypes.join(', ')}`);
  console.error('');
  console.error('Uso:');
  console.error('  npm run increment-build     # 1.0.0+45 → 1.0.0+46');
  console.error('  npm run bump-patch          # 1.0.0+45 → 1.0.1+1');
  console.error('  npm run bump-minor          # 1.0.0+45 → 1.1.0+1');
  console.error('  npm run bump-major          # 1.0.0+45 → 2.0.0+1');
  process.exit(1);
}

// Read pubspec.yaml
let pubspec;
try {
  pubspec = fs.readFileSync(pubspecPath, 'utf8');
} catch (error) {
  console.error(`❌ Não foi possível ler pubspec.yaml: ${error.message}`);
  process.exit(1);
}

// Parse version
const versionRegex = /^version:\s*([0-9]+)\.([0-9]+)\.([0-9]+)\+([0-9]+)/m;
const match = pubspec.match(versionRegex);

if (!match) {
  console.error('❌ Versão não encontrada no pubspec.yaml');
  console.error('   Formato esperado: version: X.Y.Z+BUILD');
  process.exit(1);
}

// Extract version components
let [, major, minor, patch, build] = match.map((v, i) => (i > 0 ? parseInt(v, 10) : v));

const oldVersion = `${major}.${minor}.${patch}+${build}`;

// Apply bump
switch (bumpType) {
  case 'major':
    major++;
    minor = 0;
    patch = 0;
    build = 1;
    break;
  case 'minor':
    minor++;
    patch = 0;
    build = 1;
    break;
  case 'patch':
    patch++;
    build = 1;
    break;
  case 'build':
  default:
    build++;
    break;
}

const newVersion = `${major}.${minor}.${patch}`;
const newVersionLine = `version: ${newVersion}+${build}`;

// Update pubspec.yaml
const updated = pubspec.replace(versionRegex, newVersionLine);
fs.writeFileSync(pubspecPath, updated, 'utf8');

// Output result
const bumpLabels = {
  build: 'Build',
  patch: 'Patch',
  minor: 'Minor',
  major: 'Major',
};

console.log(`✅ ${bumpLabels[bumpType]} incrementado: ${oldVersion} → ${newVersion}+${build}`);

// Stage all changes (including format and lint changes)
execSync(`git add .`);
// Deixei o . de propósito para adicionar todos os arquivos alterados pelo format e lint também.
