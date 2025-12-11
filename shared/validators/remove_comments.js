#!/usr/bin/env node
/**
 * Script: remove_comments.js
 * Purpose: Remove all comments from Dart files except function-level docs that explain
 *          purpose/behavior, params, and return values. Keeps '///' doc blocks only
 *          when they immediately precede a function definition. Removes all inline
 *          comments, block comments, and widget/layout notes.
 *
 * Usage:
 *   node automation/validation/remove_comments.js <dir1> <dir2> ...
 */

const fs = require('fs');
const path = require('path');

function isFunctionSignature(line) {
  const trimmed = line.trim();
  // Heuristic: line contains '(' and ')' and is not a control structure, and looks like a function/method.
  if (!trimmed.includes('(') || !trimmed.includes(')')) return false;
  if (/^(if|for|while|switch)\b/.test(trimmed)) return false;
  // Ends with '{' or '=>' or just ';' for external declarations
  if (!/[{;]|=>\s*/.test(trimmed)) return false;
  // Exclude constructor initializer lists & getters/setters
  if (/\bget\b|\bset\b/.test(trimmed)) return false;
  return true;
}

function stripBlockComments(content) {
  // Remove all /* ... */ including /** ... */
  return content.replace(/\/\*[\s\S]*?\*\//g, '');
}

function stripSingleLineCommentsPreservingDocs(content) {
  const lines = content.split('\n');
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Handle /// doc blocks
    if (trimmed.startsWith('///')) {
      const docBlock = [];
      let j = i;
      while (j < lines.length && lines[j].trim().startsWith('///')) {
        docBlock.push(lines[j]);
        j++;
      }
      // Look ahead to next non-empty, non-comment line
      let k = j;
      while (k < lines.length) {
        const t = lines[k].trim();
        if (t === '') {
          k++;
          continue;
        }
        if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*/')) {
          k++;
          continue;
        }
        break;
      }
      const nextLine = k < lines.length ? lines[k] : '';
      if (isFunctionSignature(nextLine)) {
        // Keep doc block
        for (const l of docBlock) result.push(l);
      }
      i = j;
      continue;
    }

    // Strip inline // comments while avoiding removal inside strings
    if (trimmed.startsWith('//')) {
      // Remove full comment line
      i++;
      continue;
    }

    // Remove inline trailing comments
    const idx = line.indexOf('//');
    if (idx !== -1) {
      const before = line.slice(0, idx);
      // Determine if // is inside quotes
      const singleQuotes = (before.match(/(^|[^\\])'/g) || []).length;
      const doubleQuotes = (before.match(/(^|[^\\])"/g) || []).length;
      const inSingle = singleQuotes % 2 === 1;
      const inDouble = doubleQuotes % 2 === 1;
      if (!inSingle && !inDouble) {
        const without = before.rstrip ? before.rstrip() : before.replace(/\s+$/, '');
        if (without.trim().length > 0) {
          result.push(without);
        } else {
          // Entire line becomes empty
          result.push('');
        }
        i++;
        continue;
      }
    }

    result.push(line);
    i++;
  }

  return result.join('\n');
}

function processDartFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  let content = original;
  content = stripBlockComments(content);
  content = stripSingleLineCommentsPreservingDocs(content);
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

function walk(dir, onFile) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(full, onFile);
    } else if (e.isFile()) {
      onFile(full);
    }
  }
}

function main() {
  const dirs = process.argv.slice(2);
  if (dirs.length === 0) {
    console.error('Usage: node automation/validation/remove_comments.js <dir1> <dir2> ...');
    process.exit(1);
  }
  let changed = 0;
  let scanned = 0;
  for (const d of dirs) {
    const abs = path.resolve(d);
    if (!fs.existsSync(abs)) continue;
    walk(abs, (file) => {
      if (file.endsWith('.dart')) {
        scanned++;
        if (processDartFile(file)) changed++;
      }
    });
  }
  console.log(`Scanned ${scanned} Dart files. Modified ${changed}.`);
}

main();
