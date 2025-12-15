#!/usr/bin/env node

/**
 * Minify Animation JSON Files
 * Ensures all Lottie animation JSON files are minified (single line, no extra whitespace)
 */

const fs = require('fs');
const path = require('path');
const glob = require('fast-glob');
const { LOYALTYHUB_ROOT, SHARED_ASSETS_DIR, WHITE_LABEL_ASSETS_DIR } = require('../utils/paths');

const ROOT_DIR = LOYALTYHUB_ROOT;

// Directories containing animation files (relative to loyalty-composer and loyalty-app)
const ANIMATION_DIRS = [
  path.join(SHARED_ASSETS_DIR, 'animations'),
  path.join(WHITE_LABEL_ASSETS_DIR, 'animations'),
];

/**
 * Check if a JSON file is minified (single line)
 */
function isMinified(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return !content.includes('\n') || content.trim().split('\n').length === 1;
}

/**
 * Minify a JSON file
 */
function minifyFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(content);
  const minified = JSON.stringify(parsed);
  fs.writeFileSync(filePath, minified);
  return minified.length;
}

/**
 * Find all animation JSON files
 */
function findAnimationFiles() {
  const patterns = ANIMATION_DIRS.map((dir) => path.join(ROOT_DIR, dir, '**/*.json'));
  return glob.sync(patterns, { absolute: true });
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const verbose = args.includes('--verbose') || args.includes('-v');

  console.log('\x1b[1m🎬 Verificando arquivos de animação JSON...\x1b[0m');

  const files = findAnimationFiles();
  let unminifiedCount = 0;
  let minifiedCount = 0;
  const unminifiedFiles = [];

  for (const file of files) {
    const relativePath = path.relative(ROOT_DIR, file);

    if (!isMinified(file)) {
      unminifiedCount++;
      unminifiedFiles.push(relativePath);

      if (checkOnly) {
        if (verbose) {
          console.log(`  ❌ ${relativePath}`);
        }
      } else {
        const size = minifyFile(file);
        minifiedCount++;
        if (verbose) {
          console.log(`  ✅ Minificado: ${relativePath} (${size} bytes)`);
        }
      }
    } else if (verbose) {
      console.log(`  ✓ ${relativePath}`);
    }
  }

  console.log(`\n📊 Total de arquivos: ${files.length}`);

  if (checkOnly) {
    if (unminifiedCount > 0) {
      console.log(`\x1b[31m❌ ${unminifiedCount} arquivo(s) não minificado(s):\x1b[0m`);
      unminifiedFiles.forEach((f) => console.log(`   - ${f}`));
      console.log('\nExecute \x1b[33mnpm run minify:animations\x1b[0m para minificar.');
      process.exit(1);
    } else {
      console.log('\x1b[32m✅ Todos os arquivos de animação estão minificados!\x1b[0m');
    }
  } else {
    if (minifiedCount > 0) {
      console.log(`\x1b[32m✅ ${minifiedCount} arquivo(s) minificado(s) com sucesso!\x1b[0m`);
    } else {
      console.log('\x1b[32m✅ Todos os arquivos já estavam minificados!\x1b[0m');
    }
  }
}

main();
