const fs = require("fs");
const path = require("path");
const {
  ensureDir,
  copyFolderRecursive,
} = require("../../../../shared/utils/fs-utils");

function copyGenericFilesInCategory(
  srcCategory,
  destCategory,
  businessTypeKeys,
) {
  fs.readdirSync(srcCategory).forEach((item) => {
    const srcPath = path.join(srcCategory, item);
    const destPath = path.join(destCategory, item);
    const isDirectory = fs.lstatSync(srcPath).isDirectory();

    if (isDirectory && businessTypeKeys.includes(item)) {
      return;
    }

    ensureDir(path.dirname(destPath));
    if (isDirectory) {
      copyFolderRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

function copyBusinessTypeFolder(
  srcCategory,
  destCategory,
  businessType,
  category,
) {
  const srcBusiness = path.join(srcCategory, businessType);
  const destBusiness = path.join(destCategory, businessType);
  if (fs.existsSync(srcBusiness)) {
    copyFolderRecursive(srcBusiness, destBusiness);
    console.log(`Copied ${category}/${businessType} assets`);
  } else {
    console.log(
      `Warning: ${category}/${businessType} folder not found in shared_assets`,
    );
  }
}

function copyGeneralCategory(
  category,
  generalAssetsDir,
  assetsDir,
  businessTypes,
  businessType,
) {
  const srcCategory = path.join(generalAssetsDir, category);
  const destCategory = path.join(assetsDir, category);

  if (!fs.existsSync(srcCategory)) {
    return;
  }

  const businessTypeKeys = businessTypes.map(
    (businessTypeItem) => businessTypeItem.key,
  );
  copyGenericFilesInCategory(srcCategory, destCategory, businessTypeKeys);

  if (businessType) {
    copyBusinessTypeFolder(srcCategory, destCategory, businessType, category);
  }
}

function copyGeneralAssets(
  businessType,
  generalAssetsDir,
  assetsDir,
  businessTypes,
) {
  copyGeneralCategory(
    "animations",
    generalAssetsDir,
    assetsDir,
    businessTypes,
    businessType,
  );
  copyGeneralCategory(
    "images",
    generalAssetsDir,
    assetsDir,
    businessTypes,
    businessType,
  );
  copyGeneralCategory(
    "configs",
    generalAssetsDir,
    assetsDir,
    businessTypes,
    businessType,
  );
  copyGeneralCategory("fonts", generalAssetsDir, assetsDir, businessTypes);
  console.log("Assets genéricos copiados com sucesso.");
}

function copyClientAssets(sourceDir, assetsDir) {
  const src = path.join(sourceDir, "assets/client_specific_assets");
  const dest = path.join(assetsDir, "client_specific_assets");
  if (fs.existsSync(src)) {
    ensureDir(path.dirname(dest));
    copyFolderRecursive(src, dest);
    console.log("Pasta client_specific_assets copiada para o projeto.");
  } else {
    console.log(
      "Atenção: O cliente não possui a pasta assets/client_specific_assets.",
    );
  }
}

module.exports = {
  copyGenericFilesInCategory,
  copyBusinessTypeFolder,
  copyGeneralCategory,
  copyGeneralAssets,
  copyClientAssets,
};
