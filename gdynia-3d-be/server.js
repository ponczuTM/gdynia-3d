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

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
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

function isReservedName(name) {
  const reserved = [
    'node_modules',
    '.git',
    '.vscode',
    'dist',
    'build',
    'public',
    'src',
    'assets'
  ];

  return reserved.includes(name);
}

function sanitizeId(id) {
  return String(id || '').trim();
}

function getObjectDir(id) {
  return path.join(ROOT_DIR, id);
}

function getMetadataPath(id) {
  return path.join(getObjectDir(id), 'metadane.json');
}

function getDirectories() {
  return fs
    .readdirSync(ROOT_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !isReservedName(name));
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function findSingleFileByExt(dirPath, ext) {
  const files = fs.readdirSync(dirPath);
  return files.find((file) => path.extname(file).toLowerCase() === ext) || null;
}

function getObjectSummary(id) {
  const objectDir = getObjectDir(id);
  const metadataPath = getMetadataPath(id);

  if (!fileExists(objectDir) || !fs.statSync(objectDir).isDirectory()) {
    return null;
  }

  if (!fileExists(metadataPath)) {
    return null;
  }

  const raw = fs.readFileSync(metadataPath, 'utf8');
  const metadata = JSON.parse(raw);

  return {
    ...metadata,
    id,
    folder: id
  };
}

function getAllObjects() {
  return getDirectories()
    .map((id) => {
      try {
        return getObjectSummary(id);
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);
}

function ensureObjectDir(id) {
  const objectDir = getObjectDir(id);
  if (!fileExists(objectDir)) {
    fs.mkdirSync(objectDir, { recursive: true });
  }
}

function createDefaultMetadata(id) {
  return {
    id,
    titlePl: '',
    titleEn: '',
    descriptionPl: '',
    descriptionEn: '',
    isActive: true,
    model: '',
    preview: '',
    scale: 1.0
  };
}

function saveMetadata(id, data) {
  fs.writeFileSync(getMetadataPath(id), JSON.stringify(data, null, 2), 'utf8');
}

function readMetadata(id) {
  const metadataPath = getMetadataPath(id);

  if (!fileExists(metadataPath)) {
    throw new Error('Brak metadane.json dla tego obiektu');
  }

  const raw = fs.readFileSync(metadataPath, 'utf8');
  return JSON.parse(raw);
}

function objectExists(id) {
  const dir = getObjectDir(id);
  return fileExists(dir) && fs.statSync(dir).isDirectory();
}

function removeOldFilesByExt(id, ext, keepName) {
  const dir = getObjectDir(id);
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const fileExt = path.extname(file).toLowerCase();
    if (fileExt === ext && file !== keepName) {
      fs.unlinkSync(path.join(dir, file));
    }
  });
}

function updateField(id, field, value) {
  const data = readMetadata(id);
  data[field] = value;
  saveMetadata(id, data);
  return data;
}

function validateObjectId(id) {
  const safeId = sanitizeId(id);

  if (!safeId) {
    return 'ID nie może być puste';
  }

  if (safeId.includes('/') || safeId.includes('\\') || safeId.includes('..')) {
    return 'ID zawiera niedozwolone znaki';
  }

  return null;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const id = sanitizeId(req.params.id);
    const objectDir = getObjectDir(id);

    if (!objectExists(id)) {
      return cb(new Error('Obiekt nie istnieje'));
    }

    cb(null, objectDir);
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
    return cb(new Error('Dozwolony jest tylko plik .png dla preview'));
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
    port: PORT,
    mode: 'multi-object directories'
  });
});

app.get('/ojects', (req, res) => {
  try {
    const objects = getAllObjects();
    res.json(objects);
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się pobrać listy obiektów' });
  }
});

app.get('/object/:id', (req, res) => {
  try {
    const id = sanitizeId(req.params.id);
    const objectData = getObjectSummary(id);

    if (!objectData) {
      return res.status(404).json({ error: 'Obiekt nie istnieje' });
    }

    res.json(objectData);
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się pobrać obiektu' });
  }
});

app.get('/object/:id/json', (req, res) => {
  try {
    const id = sanitizeId(req.params.id);
    const metadataPath = getMetadataPath(id);

    if (!fileExists(metadataPath)) {
      return res.status(404).json({ error: 'Brak metadane.json' });
    }

    res.sendFile(metadataPath);
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się pobrać JSON-a' });
  }
});

app.get('/object/:id/png', (req, res) => {
  try {
    const id = sanitizeId(req.params.id);
    const objectDir = getObjectDir(id);

    if (!objectExists(id)) {
      return res.status(404).json({ error: 'Obiekt nie istnieje' });
    }

    const pngFile = findSingleFileByExt(objectDir, '.png');

    if (!pngFile) {
      return res.status(404).json({ error: 'Brak pliku PNG' });
    }

    res.sendFile(path.join(objectDir, pngFile));
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się pobrać PNG' });
  }
});

app.get('/object/:id/glb', (req, res) => {
  try {
    const id = sanitizeId(req.params.id);
    const objectDir = getObjectDir(id);

    if (!objectExists(id)) {
      return res.status(404).json({ error: 'Obiekt nie istnieje' });
    }

    const glbFile = findSingleFileByExt(objectDir, '.glb');

    if (!glbFile) {
      return res.status(404).json({ error: 'Brak pliku GLB' });
    }

    res.sendFile(path.join(objectDir, glbFile));
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się pobrać GLB' });
  }
});

app.post('/object', (req, res) => {
  try {
    const id = sanitizeId(req.body.id);
    const validationError = validateObjectId(id);

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    if (objectExists(id)) {
      return res.status(400).json({ error: 'Obiekt o takim ID już istnieje' });
    }

    ensureObjectDir(id);

    const metadata = createDefaultMetadata(id);
    saveMetadata(id, metadata);

    res.status(201).json({
      message: 'Obiekt utworzony',
      object: metadata
    });
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się utworzyć obiektu' });
  }
});

app.delete('/object/:id', (req, res) => {
  try {
    const id = sanitizeId(req.params.id);

    if (!objectExists(id)) {
      return res.status(404).json({ error: 'Obiekt nie istnieje' });
    }

    fs.rmSync(getObjectDir(id), { recursive: true, force: true });

    res.json({
      message: 'Obiekt usunięty',
      id
    });
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się usunąć obiektu' });
  }
});

app.put('/object/:id', (req, res) => {
  try {
    const id = sanitizeId(req.params.id);

    if (!objectExists(id)) {
      return res.status(404).json({ error: 'Obiekt nie istnieje' });
    }

    const current = readMetadata(id);
    const updated = {
      ...current,
      ...req.body,
      id
    };

    updated.isActive = typeof updated.isActive === 'boolean'
      ? updated.isActive
      : current.isActive;

    const parsedScale = Number(updated.scale);
    updated.scale = Number.isFinite(parsedScale) ? parsedScale : current.scale;

    saveMetadata(id, updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się zaktualizować obiektu' });
  }
});

app.patch('/object/:id/id', (req, res) => {
  try {
    const oldId = sanitizeId(req.params.id);
    const newId = sanitizeId(req.body.id);
    const validationError = validateObjectId(newId);

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    if (!objectExists(oldId)) {
      return res.status(404).json({ error: 'Obiekt nie istnieje' });
    }

    if (oldId !== newId && objectExists(newId)) {
      return res.status(400).json({ error: 'Nowe ID już istnieje' });
    }

    if (oldId !== newId) {
      fs.renameSync(getObjectDir(oldId), getObjectDir(newId));
    }

    const data = readMetadata(newId);
    data.id = newId;
    saveMetadata(newId, data);

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się zmienić ID obiektu' });
  }
});

app.patch('/object/:id/title-pl', (req, res) => {
  try {
    const data = updateField(req.params.id, 'titlePl', req.body.titlePl);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się zmienić titlePl' });
  }
});

app.patch('/object/:id/title-en', (req, res) => {
  try {
    const data = updateField(req.params.id, 'titleEn', req.body.titleEn);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się zmienić titleEn' });
  }
});

app.patch('/object/:id/description-pl', (req, res) => {
  try {
    const data = updateField(req.params.id, 'descriptionPl', req.body.descriptionPl);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się zmienić descriptionPl' });
  }
});

app.patch('/object/:id/description-en', (req, res) => {
  try {
    const data = updateField(req.params.id, 'descriptionEn', req.body.descriptionEn);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się zmienić descriptionEn' });
  }
});

app.patch('/object/:id/is-active', (req, res) => {
  try {
    const value = req.body.isActive === true || req.body.isActive === 'true';
    const data = updateField(req.params.id, 'isActive', value);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się zmienić isActive' });
  }
});

app.patch('/object/:id/scale', (req, res) => {
  try {
    const scale = Number(req.body.scale);

    if (!Number.isFinite(scale)) {
      return res.status(400).json({ error: 'scale musi być liczbą' });
    }

    const data = updateField(req.params.id, 'scale', scale);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się zmienić scale' });
  }
});

app.post('/object/:id/upload/model', upload.single('model'), (req, res) => {
  try {
    const id = sanitizeId(req.params.id);

    if (!req.file) {
      return res.status(400).json({ error: 'Brak pliku modelu' });
    }

    removeOldFilesByExt(id, '.glb', req.file.originalname);

    const data = readMetadata(id);
    data.model = req.file.originalname;
    saveMetadata(id, data);

    res.json({
      message: 'Model został wgrany',
      file: req.file.originalname,
      metadata: data
    });
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się wgrać modelu' });
  }
});

app.post('/object/:id/upload/preview', upload.single('preview'), (req, res) => {
  try {
    const id = sanitizeId(req.params.id);

    if (!req.file) {
      return res.status(400).json({ error: 'Brak pliku preview' });
    }

    removeOldFilesByExt(id, '.png', req.file.originalname);

    const data = readMetadata(id);
    data.preview = req.file.originalname;
    saveMetadata(id, data);

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
  console.log(`GET    /ojects`);
  console.log(`GET    /object/:id`);
  console.log(`GET    /object/:id/png`);
  console.log(`GET    /object/:id/glb`);
  console.log(`GET    /object/:id/json`);
  console.log(`POST   /object`);
  console.log(`DELETE /object/:id`);
  console.log(`PUT    /object/:id`);
  console.log(`PATCH  /object/:id/id`);
  console.log(`PATCH  /object/:id/title-pl`);
  console.log(`PATCH  /object/:id/title-en`);
  console.log(`PATCH  /object/:id/description-pl`);
  console.log(`PATCH  /object/:id/description-en`);
  console.log(`PATCH  /object/:id/is-active`);
  console.log(`PATCH  /object/:id/scale`);
  console.log(`POST   /object/:id/upload/model      (form-data: model => .glb)`);
  console.log(`POST   /object/:id/upload/preview    (form-data: preview => .png)`);
  console.log('============================\n');
});