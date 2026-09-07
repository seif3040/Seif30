import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

const publicDir = path.resolve(process.cwd(), 'client', 'public');

function generatePngIcon(size, fileName, isMaskable = false) {
  const png = new PNG({ width: size, height: size });

  const primaryR = 15, primaryG = 118, primaryB = 110; // #0f766e
  const accentR = 56, accentG = 189, accentB = 248;   // #38bdf8
  const goldR = 245, goldG = 158, goldB = 11;       // #f59e0b

  const center = size / 2;
  const radius = isMaskable ? size * 0.48 : size * 0.42;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;

      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background
      png.data[idx] = primaryR;
      png.data[idx + 1] = primaryG;
      png.data[idx + 2] = primaryB;
      png.data[idx + 3] = 255;

      // Inner graduation cap shape/circle emblem
      if (dist < radius * 0.75) {
        // Cap top diamond shape: |dx/1.5| + |dy| < radius * 0.4
        if (Math.abs(dx) * 0.8 + Math.abs(dy + radius * 0.1) < radius * 0.45) {
          png.data[idx] = 255;
          png.data[idx + 1] = 255;
          png.data[idx + 2] = 255;
        } else if (dy > 0 && Math.abs(dx) < radius * 0.35 && dy < radius * 0.35) {
          png.data[idx] = accentR;
          png.data[idx + 1] = accentG;
          png.data[idx + 2] = accentB;
        }
      }

      // Decorative gold dot
      const goldDx = x - (center + radius * 0.5);
      const goldDy = y - (center - radius * 0.1);
      if (Math.sqrt(goldDx * goldDx + goldDy * goldDy) < radius * 0.12) {
        png.data[idx] = goldR;
        png.data[idx + 1] = goldG;
        png.data[idx + 2] = goldB;
      }
    }
  }

  const buffer = PNG.sync.write(png);
  fs.writeFileSync(path.join(publicDir, fileName), buffer);
  console.log(`Generated ${fileName} (${size}x${size})`);
}

generatePngIcon(192, 'pwa-192x192.png');
generatePngIcon(512, 'pwa-512x512.png');
generatePngIcon(512, 'pwa-maskable-512x512.png', true);
generatePngIcon(180, 'apple-touch-icon.png');
console.log('All PWA icons generated successfully!');
