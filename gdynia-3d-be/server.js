const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = 2115;
const HOST = '0.0.0.0';

const ROOT_DIR = __dirname;
const METADATA_FILE = path.join(ROOT_DIR, 'metadane.json');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/files', express.static(ROOT_DIR));

function ensureMetadataFile() {
  if (!fs.existsSync(METADATA_FILE)) {
    const defaultData = {
      id: 'drugi_obiekt',
      titlePl: 'Test obiekt',
      titleEn: 'Test object',
      descriptionPl: 'Opis testowy.',
      descriptionEn: 'Test description.',
      isActive: true,
      model: 'pixellabs-robot-3332.glb',
      preview: 'aaaa.png',
      scale: 1.0
    };

    fs.writeFileSync(METADATA_FILE, JSON.stringify(defaultData, null, 2), 'utf8');
  }
}

function readMetadata() {
  ensureMetadataFile();
  const raw = fs.readFileSync(METADATA_FILE, 'utf8');
  return JSON.parse(raw);
}

function saveMetadata(data) {
  fs.writeFileSync(METADATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function updateField(field, value) {
  const data = readMetadata();
  data[field] = value;
  saveMetadata(data);
  return data;
}

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      const isIPv4 = net.family === 'IPv4' || net.family === 4;
      if (isIPv4 && !net.internal) {
        ips.push({
          interface: name,
          address: net.address
        });
      }
    }
  }

  return ips;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, ROOT_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();

  if (file.fieldname === 'model' && ext !== '.glb') {
    return cb(new Error('Dozwolony jest tylko plik .glb dla modelu'));
  }

  if (file.fieldname === 'preview' && ext !== '.png') {
    return cb(new Error('Dozwolony jest tylko plik .png dla podglądu'));
  }

  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter
});

app.get('/', (req, res) => {
  res.json({
    message: 'CMS backend działa',
    metadataFile: 'metadane.json',
    port: PORT
  });
});

app.get('/metadata', (req, res) => {
  try {
    const data = readMetadata();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się odczytać metadanych' });
  }
});

app.put('/metadata', (req, res) => {
  try {
    const current = readMetadata();
    const updated = {
      ...current,
      ...req.body
    };

    if (typeof updated.isActive !== 'boolean') {
      updated.isActive = current.isActive;
    }

    const parsedScale = Number(updated.scale);
    updated.scale = Number.isFinite(parsedScale) ? parsedScale : current.scale;

    saveMetadata(updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się zaktualizować metadanych' });
  }
});

app.patch('/metadata/id', (req, res) => {
  try {
    const data = updateField('id', req.body.id);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się zmienić id' });
  }
});

app.patch('/metadata/title-pl', (req, res) => {
  try {
    const data = updateField('titlePl', req.body.titlePl);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się zmienić titlePl' });
  }
});

app.patch('/metadata/title-en', (req, res) => {
  try {
    const data = updateField('titleEn', req.body.titleEn);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się zmienić titleEn' });
  }
});

app.patch('/metadata/description-pl', (req, res) => {
  try {
    const data = updateField('descriptionPl', req.body.descriptionPl);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się zmienić descriptionPl' });
  }
});

app.patch('/metadata/description-en', (req, res) => {
  try {
    const data = updateField('descriptionEn', req.body.descriptionEn);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się zmienić descriptionEn' });
  }
});

app.patch('/metadata/is-active', (req, res) => {
  try {
    const isActive = Boolean(req.body.isActive);
    const data = updateField('isActive', isActive);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się zmienić isActive' });
  }
});

app.patch('/metadata/scale', (req, res) => {
  try {
    const scale = Number(req.body.scale);

    if (!Number.isFinite(scale)) {
      return res.status(400).json({ error: 'scale musi być liczbą' });
    }

    const data = updateField('scale', scale);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się zmienić scale' });
  }
});

app.post('/upload/model', upload.single('model'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Brak pliku modelu' });
    }

    const data = updateField('model', req.file.originalname);

    res.json({
      message: 'Model został wgrany',
      file: req.file.originalname,
      metadata: data
    });
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się wgrać modelu' });
  }
});

app.post('/upload/preview', upload.single('preview'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Brak pliku podglądu' });
    }

    const data = updateField('preview', req.file.originalname);

    res.json({
      message: 'Preview został wgrany',
      file: req.file.originalname,
      metadata: data
    });
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się wgrać preview' });
  }
});

app.use((error, req, res, next) => {
  res.status(400).json({
    error: error.message || 'Wystąpił błąd'
  });
});

app.listen(PORT, HOST, () => {
  ensureMetadataFile();

  const ips = getLocalIPs();

  console.log('\n===== CMS BACKEND START =====');
  console.log(`Backend działa na: http://localhost:${PORT}`);

  if (ips.length > 0) {
    console.log('\nAdresy IP serwera:');
    ips.forEach((item) => {
      console.log(`- ${item.interface}: http://${item.address}:${PORT}`);
    });
  } else {
    console.log('\nNie znaleziono zewnętrznego adresu IPv4.');
  }

  console.log('\nEndpointy:');
  console.log(`GET    /`);
  console.log(`GET    /metadata`);
  console.log(`PUT    /metadata`);
  console.log(`PATCH  /metadata/id`);
  console.log(`PATCH  /metadata/title-pl`);
  console.log(`PATCH  /metadata/title-en`);
  console.log(`PATCH  /metadata/description-pl`);
  console.log(`PATCH  /metadata/description-en`);
  console.log(`PATCH  /metadata/is-active`);
  console.log(`PATCH  /metadata/scale`);
  console.log(`POST   /upload/model        (form-data: model => .glb)`);
  console.log(`POST   /upload/preview      (form-data: preview => .png)`);
  console.log(`GET    /files/:filename`);
  console.log('============================\n');
});