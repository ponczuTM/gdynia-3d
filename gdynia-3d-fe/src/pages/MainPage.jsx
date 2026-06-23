import { useEffect, useState } from 'react';
import styles from './MainPage.module.css';

export default function MainPage() {
  const backendIP = '169.254.66.69';
  const backendUrl = `http://${backendIP}:2115`;

  const [form, setForm] = useState({
    id: '',
    titlePl: '',
    titleEn: '',
    descriptionPl: '',
    descriptionEn: '',
    isActive: true,
    model: '',
    preview: '',
    scale: 1.0
  });

  const [modelFile, setModelFile] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchMetadata = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${backendUrl}/metadata`);
      const data = await response.json();
      setForm(data);
    } catch (error) {
      setMessage('Nie udało się pobrać metadanych.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox'
          ? checked
          : name === 'scale'
          ? Number(value)
          : value
    }));
  };

  const saveAll = async () => {
    try {
      setLoading(true);
      setMessage('');

      const response = await fetch(`${backendUrl}/metadata`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(form)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Błąd zapisu');
      }

      setForm(data);
      setMessage('Metadane zapisane.');
    } catch (error) {
      setMessage(error.message || 'Nie udało się zapisać metadanych.');
    } finally {
      setLoading(false);
    }
  };

  const uploadModel = async () => {
    if (!modelFile) {
      setMessage('Najpierw wybierz plik .glb');
      return;
    }

    try {
      setLoading(true);
      setMessage('');

      const fd = new FormData();
      fd.append('model', modelFile);

      const response = await fetch(`${backendUrl}/upload/model`, {
        method: 'POST',
        body: fd
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Błąd uploadu modelu');
      }

      setForm(data.metadata);
      setMessage('Model wgrany poprawnie.');
    } catch (error) {
      setMessage(error.message || 'Nie udało się wgrać modelu.');
    } finally {
      setLoading(false);
    }
  };

  const uploadPreview = async () => {
    if (!previewFile) {
      setMessage('Najpierw wybierz plik .png');
      return;
    }

    try {
      setLoading(true);
      setMessage('');

      const fd = new FormData();
      fd.append('preview', previewFile);

      const response = await fetch(`${backendUrl}/upload/preview`, {
        method: 'POST',
        body: fd
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Błąd uploadu preview');
      }

      setForm(data.metadata);
      setMessage('Preview wgrany poprawnie.');
    } catch (error) {
      setMessage(error.message || 'Nie udało się wgrać preview.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Prosty CMS metadane.json</h1>
        <p className={styles.subtitle}>
          Backend: {backendUrl}
        </p>

        {message && <div className={styles.message}>{message}</div>}

        <div className={styles.grid}>
          <label className={styles.field}>
            <span>ID</span>
            <input
              name="id"
              value={form.id}
              onChange={handleChange}
              type="text"
            />
          </label>

          <label className={styles.field}>
            <span>Tytuł PL</span>
            <input
              name="titlePl"
              value={form.titlePl}
              onChange={handleChange}
              type="text"
            />
          </label>

          <label className={styles.field}>
            <span>Tytuł EN</span>
            <input
              name="titleEn"
              value={form.titleEn}
              onChange={handleChange}
              type="text"
            />
          </label>

          <label className={styles.field}>
            <span>Opis PL</span>
            <textarea
              name="descriptionPl"
              value={form.descriptionPl}
              onChange={handleChange}
              rows="4"
            />
          </label>

          <label className={styles.field}>
            <span>Opis EN</span>
            <textarea
              name="descriptionEn"
              value={form.descriptionEn}
              onChange={handleChange}
              rows="4"
            />
          </label>

          <label className={styles.checkboxRow}>
            <input
              name="isActive"
              checked={form.isActive}
              onChange={handleChange}
              type="checkbox"
            />
            <span>isActive</span>
          </label>

          <div className={styles.field}>
            <span>Scale: {form.scale.toFixed(1)}</span>
            <input
              name="scale"
              value={form.scale}
              onChange={handleChange}
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
            />
          </div>

          <div className={styles.fileBox}>
            <span>Aktualny model:</span>
            <strong>{form.model || '-'}</strong>
            <input
              type="file"
              accept=".glb"
              onChange={(e) => setModelFile(e.target.files?.[0] || null)}
            />
            <button className={styles.button} onClick={uploadModel} type="button">
              Upload modelu .glb
            </button>
          </div>

          <div className={styles.fileBox}>
            <span>Aktualny preview:</span>
            <strong>{form.preview || '-'}</strong>
            <input
              type="file"
              accept=".png"
              onChange={(e) => setPreviewFile(e.target.files?.[0] || null)}
            />
            <button className={styles.button} onClick={uploadPreview} type="button">
              Upload preview .png
            </button>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            className={styles.buttonPrimary}
            onClick={saveAll}
            type="button"
            disabled={loading}
          >
            {loading ? 'Zapisywanie...' : 'Zapisz wszystko'}
          </button>

          <button
            className={styles.buttonSecondary}
            onClick={fetchMetadata}
            type="button"
            disabled={loading}
          >
            Odśwież dane
          </button>
        </div>
      </div>
    </div>
  );
}