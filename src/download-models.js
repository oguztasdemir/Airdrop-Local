const fs = require('fs');
const path = require('path');
const https = require('https');

const MODELS_DIR = path.resolve(__dirname, '..', 'public', 'models');
const JS_DIR = path.resolve(__dirname, '..', 'public', 'js');

const FILES_TO_DOWNLOAD = [
  {
    url: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js',
    dest: path.join(JS_DIR, 'face-api.min.js')
  },
  {
    url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/ssd_mobilenetv1_model-weights_manifest.json',
    dest: path.join(MODELS_DIR, 'ssd_mobilenetv1_model-weights_manifest.json')
  },
  {
    url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/ssd_mobilenetv1_model-shard1',
    dest: path.join(MODELS_DIR, 'ssd_mobilenetv1_model-shard1')
  },
  {
    url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/ssd_mobilenetv1_model-shard2',
    dest: path.join(MODELS_DIR, 'ssd_mobilenetv1_model-shard2')
  },
  {
    url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_landmark_68_model-weights_manifest.json',
    dest: path.join(MODELS_DIR, 'face_landmark_68_model-weights_manifest.json')
  },
  {
    url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_landmark_68_model-shard1',
    dest: path.join(MODELS_DIR, 'face_landmark_68_model-shard1')
  },
  {
    url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_recognition_model-weights_manifest.json',
    dest: path.join(MODELS_DIR, 'face_recognition_model-weights_manifest.json')
  },
  {
    url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_recognition_model-shard1',
    dest: path.join(MODELS_DIR, 'face_recognition_model-shard1')
  },
  {
    url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_recognition_model-shard2',
    dest: path.join(MODELS_DIR, 'face_recognition_model-shard2')
  },
  {
    url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/tiny_face_detector_model-weights_manifest.json',
    dest: path.join(MODELS_DIR, 'tiny_face_detector_model-weights_manifest.json')
  },
  {
    url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/tiny_face_detector_model-shard1',
    dest: path.join(MODELS_DIR, 'tiny_face_detector_model-shard1')
  }
];

function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const request = https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.unlinkSync(dest);
        return download(response.headers.location, dest).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`Failed to download ${url}: status code ${response.statusCode}`));
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    });
    request.on('error', (err) => {
      file.close();
      try { fs.unlinkSync(dest); } catch (e) {}
      reject(err);
    });
  });
}

async function run() {
  ensureDirExists(MODELS_DIR);
  ensureDirExists(JS_DIR);

  console.log('[*] Yüz tanıma modelleri ve kütüphane dosyaları kontrol ediliyor...');

  for (const item of FILES_TO_DOWNLOAD) {
    if (fs.existsSync(item.dest)) {
      // Validate file size is greater than 0
      const stats = fs.statSync(item.dest);
      if (stats.size > 0) {
        continue;
      }
    }

    const filename = path.basename(item.dest);
    console.log(`[*] İndiriliyor: ${filename}...`);
    try {
      await download(item.url, item.dest);
      console.log(`[+] İndirildi: ${filename}`);
    } catch (err) {
      console.error(`[-] İndirme hatası (${filename}):`, err.message);
      process.exit(1);
    }
  }

  console.log('[+] Tüm yüz tanıma dosyaları hazır!');
}

if (require.main === module) {
  run();
} else {
  module.exports = run;
}
