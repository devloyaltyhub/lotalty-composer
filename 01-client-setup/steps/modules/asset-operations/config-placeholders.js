const fs = require('fs');
const path = require('path');

function processConfigPlaceholders(assetsDir, businessType, clientConfig) {
  console.log('Processing config file placeholders...');

  const configsDir = path.join(assetsDir, 'configs', businessType);

  if (!fs.existsSync(configsDir)) {
    console.log(`Configs directory not found: ${configsDir}`);
    return;
  }

  const configFiles = fs.readdirSync(configsDir).filter((file) => file.endsWith('.json'));

  configFiles.forEach((file) => {
    const filePath = path.join(configsDir, file);

    try {
      let content = fs.readFileSync(filePath, 'utf8');

      if (clientConfig.loversName) {
        content = content.replace(/\{loversName\}/g, clientConfig.loversName);
      }

      if (clientConfig.clientName) {
        content = content.replace(/\{clientName\}/g, clientConfig.clientName);
      }

      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`  Processed: ${file}`);
    } catch (error) {
      console.error(`  Error processing ${file}: ${error.message}`);
    }
  });

  console.log('Config placeholders processed successfully');
}

module.exports = {
  processConfigPlaceholders,
};
