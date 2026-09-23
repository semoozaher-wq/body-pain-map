const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

const images = [
  'assets/anatomy/muscle-front-realistic.png',
  'assets/anatomy/muscle-back-realistic.png',
  'assets/anatomy/muscle-side-realistic.png'
];

async function optimizeImages() {
  console.log('🚀 بدء تحسين صور التشريح...');
  for (const imgPath of images) {
    const outputPath = imgPath.replace('.png', '.webp');
    try {
      await fs.access(imgPath);
      await sharp(imgPath)
        .webp({ quality: 85, effort: 6 })
        .toFile(outputPath);
      
      const originalStats = await fs.stat(imgPath);
      const newStats = await fs.stat(outputPath);
      const savings = ((originalStats.size - newStats.size) / originalStats.size * 100).toFixed(1);
      
      console.log(`✅ تم تحسين: ${path.basename(outputPath)} (توفير ${savings}% من الحجم)`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`⚠️ الملف غير موجود: ${imgPath} (قد يكون تم تحويله مسبقاً)`);
      } else {
        console.error(`❌ فشل في تحسين ${imgPath}:`, error.message);
      }
    }
  }
  console.log('🎉 اكتملت عملية تحسين الصور! قم بتحديث مسارات الصور في الكود إلى .webp');
}

optimizeImages();
