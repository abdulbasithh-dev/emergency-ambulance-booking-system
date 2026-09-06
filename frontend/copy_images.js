import fs from 'fs';
import path from 'path';

const brainDir = 'C:\\Users\\HP\\.gemini\\antigravity-ide\\brain\\f2c59291-79a6-4553-9019-ab7ca0fc7261';
const targetDir = path.resolve('public', 'images');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const fileMap = {
  'hero_ambulance_speeding_1788627500879.jpg': 'hero-ambulance.jpg',
  'card_emergency_ambulance_1788627653896.jpg': 'service-emergency.jpg',
  'card_icu_interior_1788627539619.jpg': 'service-icu.jpg',
  'card_air_ambulance_1788627575130.jpg': 'service-air.jpg',
  'card_patient_transport_1788627619933.jpg': 'service-transport.jpg',
};

for (const [src, dest] of Object.entries(fileMap)) {
  const srcPath = path.join(brainDir, src);
  const destPath = path.join(targetDir, dest);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied ${src} -> ${dest}`);
  } else {
    console.warn(`Source file not found: ${srcPath}`);
  }
}
