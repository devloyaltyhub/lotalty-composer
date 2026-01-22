const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function compressImages(targetRoot, projectRoot) {
  console.log('Compressing white label images...');

  try {
    const whitelabelAssetsPath = path.join(targetRoot, 'assets');
    const compressImagesScript = path.join(projectRoot, 'automation/assets/compress-images.js');

    if (!fs.existsSync(compressImagesScript)) {
      console.log('Compress images script not found, skipping compression');
      return false;
    }

    if (fs.existsSync(whitelabelAssetsPath)) {
      execSync(`node "${compressImagesScript}" "${whitelabelAssetsPath}"`, {
        stdio: 'inherit',
        cwd: projectRoot,
        shell: true,
      });
      console.log('Image compression completed successfully');
    } else {
      console.log('White label assets directory not found, skipping compression');
    }

    return true;
  } catch (error) {
    console.warn('Warning: Image compression failed, but continuing...', error.message);
    return false;
  }
}

function optimizeLottieAnimations(projectRoot) {
  console.log('Optimizing Lottie animations...');

  try {
    const animationsPath = path.join(projectRoot, 'shared/shared_assets/animations');

    if (!fs.existsSync(animationsPath)) {
      console.log('Animations directory not found, skipping optimization');
      return false;
    }

    execSync('npm run optimize:lottie:prettier', {
      stdio: 'inherit',
      cwd: projectRoot,
    });

    console.log('Lottie animations optimized successfully');
    return true;
  } catch (error) {
    console.warn('Warning: Lottie optimization failed, but continuing...', error.message);
    return false;
  }
}

function cleanOldLauncherIcons(targetRoot) {
  console.log('Cleaning old launcher icons...');

  const androidResPath = path.join(targetRoot, 'android', 'app', 'src', 'main', 'res');
  const mipmapDirs = fs.readdirSync(androidResPath).filter((dir) => dir.startsWith('mipmap-'));

  mipmapDirs.forEach((dir) => {
    const dirPath = path.join(androidResPath, dir);

    ['ic_launcher.png', 'ic_launcher_round.png', 'launcher_icon.png'].forEach((file) => {
      const filePath = path.join(dirPath, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`  Removed: ${dir}/${file}`);
      }
    });
  });

  console.log('Old launcher icons cleaned');
}

function generateAppIcons(targetRoot) {
  console.log('Generating app icons...');

  try {
    const logoPath = path.join(targetRoot, 'assets', 'client_specific_assets', 'logo.png');
    if (fs.existsSync(logoPath)) {
      cleanOldLauncherIcons(targetRoot);

      execSync('dart run flutter_launcher_icons', {
        stdio: 'inherit',
        cwd: targetRoot,
      });
      console.log('App icons generated successfully using flutter_launcher_icons');
      return true;
    }
    console.log('Logo not found in client_specific_assets, skipping icon generation');
    return false;
  } catch (error) {
    console.warn('Warning: Icon generation failed, but continuing...', error.message);
    return false;
  }
}

module.exports = {
  compressImages,
  optimizeLottieAnimations,
  cleanOldLauncherIcons,
  generateAppIcons,
};
