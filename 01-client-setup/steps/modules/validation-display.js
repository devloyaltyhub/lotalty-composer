/**
 * Validation display utilities
 * Functions for displaying validation results to the console
 */

/**
 * Display validation results
 * @param {object} results - Validation results with errors, warnings, and checks
 * @returns {boolean} - True if no errors
 */
function displayValidationResults(results) {
  const { errors, warnings, checks } = results;

  if (checks.length > 0) {
    console.log('\n  ✅ Verificações OK:');
    checks.forEach((check) => {
      console.log(`     ${check.file}: ${check.value}`);
    });
  }

  if (warnings.length > 0) {
    console.log('\n  ⚠️  Avisos:');
    warnings.forEach((warning) => {
      console.log(`     ${warning.file}`);
      console.log(`        ${warning.issue}`);
      console.log(`        Esperado: ${warning.expected}`);
      console.log(`        Encontrado: ${warning.found}`);
    });
  }

  if (errors.length > 0) {
    console.log('\n  ❌ ERROS ENCONTRADOS:');
    errors.forEach((error) => {
      console.log(`     ${error.file}`);
      console.log(`        ${error.issue}`);
      console.log(`        Esperado: ${error.expected}`);
      console.log(`        Encontrado: ${error.found || '(não encontrado)'}`);
    });

    console.log('\n  💡 Para corrigir:');
    console.log('     1. Verifique se os arquivos do cliente estão corretos em clients/<client>/');
    console.log('     2. Re-execute: npm run start -- <client>');
    console.log(
      '     3. Ou regenere firebase_options.dart: cd white_label_app && flutterfire configure --project=<project-id>'
    );

    return false;
  }

  console.log('\n  ✅ Todas as configurações estão consistentes!');
  return true;
}

module.exports = {
  displayValidationResults,
};
