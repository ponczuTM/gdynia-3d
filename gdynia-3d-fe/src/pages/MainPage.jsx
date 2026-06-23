import { useEffect, useMemo, useState } from 'react';
import styles from './MainPage.module.css';

export default function MainPage() {
  const backendIP = '192.168.68.247';
  const backendUrl = useMemo(() => `http://${backendIP}:2115`, [backendIP]);

  const emptyForm = {
    id: '',
    titlePl: '',
    titleEn: '',
    descriptionPl: '',
    descriptionEn: '',
    isActive: true,
    model: '',
    preview: '',
    scale: 1.0
  };

  const [objects, setObjects] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(emptyForm);

  // Stan dla nowego obiektu (wszystkie pola)
  const [newObject, setNewObject] = useState({
    id: '',
    titlePl: '',
    titleEn: '',
    descriptionPl: '',
    descriptionEn: '',
    isActive: true,
    scale: 1.0
  });

  const [modelFile, setModelFile] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // --------------------- Pobieranie danych ---------------------
  const fetchObjects = async (keepSelection = true) => {
    try {
      setLoading(true);
      const response = await fetch(`${backendUrl}/ojects`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Nie udało się pobrać listy obiektów');
      setObjects(data);

      if (data.length === 0) {
        setSelectedId('');
        setForm(emptyForm);
        return;
      }

      const nextSelectedId =
        keepSelection && data.some((item) => item.id === selectedId)
          ? selectedId
          : data[0].id;
      setSelectedId(nextSelectedId);
      const selectedObject = data.find((item) => item.id === nextSelectedId);
      if (selectedObject) setForm(selectedObject);
    } catch (error) {
      setMessage(error.message || 'Nie udało się pobrać obiektów.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSingleObject = async (id) => {
    try {
      setLoading(true);
      const response = await fetch(`${backendUrl}/object/${encodeURIComponent(id)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Nie udało się pobrać obiektu');
      setForm(data);
      setSelectedId(data.id);
    } catch (error) {
      setMessage(error.message || 'Nie udało się pobrać obiektu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchObjects(false);
  }, []);

  // --------------------- Obsługa zmian w formularzu edycji ---------------------
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

  // --------------------- Obsługa zmian w formularzu nowego obiektu ---------------------
  const handleNewChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewObject((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox'
          ? checked
          : name === 'scale'
          ? Number(value)
          : value
    }));
  };

  // --------------------- Wybór obiektu z listy ---------------------
  const handleSelectObject = async (id) => {
    setSelectedId(id);
    await fetchSingleObject(id);
  };

  // --------------------- Tworzenie nowego obiektu (z pełną walidacją) ---------------------
  const createObject = async () => {
    try {
      // Walidacja po stronie frontendu
      if (!newObject.id.trim()) {
        setMessage('ID jest wymagane.');
        return;
      }
      if (
        !newObject.titlePl.trim() ||
        !newObject.titleEn.trim() ||
        !newObject.descriptionPl.trim() ||
        !newObject.descriptionEn.trim()
      ) {
        setMessage('Wszystkie tytuły i opisy są wymagane.');
        return;
      }

      setLoading(true);
      setMessage('');

      const response = await fetch(`${backendUrl}/object`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newObject)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Nie udało się utworzyć obiektu');

      setMessage('Obiekt utworzony.');
      // Resetowanie formularza nowego obiektu
      setNewObject({
        id: '',
        titlePl: '',
        titleEn: '',
        descriptionPl: '',
        descriptionEn: '',
        isActive: true,
        scale: 1.0
      });
      // Odświeżenie listy i wybranie nowego obiektu
      await fetchObjects(false);
      await fetchSingleObject(data.object.id);
    } catch (error) {
      setMessage(error.message || 'Nie udało się utworzyć obiektu.');
    } finally {
      setLoading(false);
    }
  };

  // --------------------- Zapisz zmiany w obiekcie ---------------------
  const saveObject = async () => {
    try {
      if (!selectedId) {
        setMessage('Najpierw wybierz obiekt.');
        return;
      }
      setLoading(true);
      setMessage('');

      const response = await fetch(`${backendUrl}/object/${encodeURIComponent(selectedId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Nie udało się zapisać obiektu');

      setForm(data);
      setMessage('Obiekt zapisany.');
      await fetchObjects(true);
    } catch (error) {
      setMessage(error.message || 'Nie udało się zapisać obiektu.');
    } finally {
      setLoading(false);
    }
  };

  // --------------------- Usuwanie obiektu ---------------------
  const deleteObject = async () => {
    try {
      if (!selectedId) {
        setMessage('Najpierw wybierz obiekt.');
        return;
      }
      if (!window.confirm(`Na pewno usunąć obiekt "${selectedId}"?`)) return;

      setLoading(true);
      setMessage('');

      const response = await fetch(`${backendUrl}/object/${encodeURIComponent(selectedId)}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Nie udało się usunąć obiektu');

      setMessage('Obiekt usunięty.');
      await fetchObjects(false);
    } catch (error) {
      setMessage(error.message || 'Nie udało się usunąć obiektu.');
    } finally {
      setLoading(false);
    }
  };

  // --------------------- Zmiana ID / nazwy katalogu ---------------------
  const renameObject = async () => {
    try {
      if (!selectedId) {
        setMessage('Najpierw wybierz obiekt.');
        return;
      }
      if (!form.id.trim()) {
        setMessage('ID nie może być puste.');
        return;
      }
      setLoading(true);
      setMessage('');

      const response = await fetch(`${backendUrl}/object/${encodeURIComponent(selectedId)}/id`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: form.id.trim() })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Nie udało się zmienić ID');

      setSelectedId(data.id);
      setForm(data);
      setMessage('ID obiektu zmienione.');
      await fetchObjects(false);
      await fetchSingleObject(data.id);
    } catch (error) {
      setMessage(error.message || 'Nie udało się zmienić ID.');
    } finally {
      setLoading(false);
    }
  };

  // --------------------- Upload modelu ---------------------
  const uploadModel = async () => {
    try {
      if (!selectedId) {
        setMessage('Najpierw wybierz obiekt.');
        return;
      }
      if (!modelFile) {
        setMessage('Najpierw wybierz plik .glb');
        return;
      }
      setLoading(true);
      setMessage('');

      const fd = new FormData();
      fd.append('model', modelFile);

      const response = await fetch(`${backendUrl}/object/${encodeURIComponent(selectedId)}/upload/model`, {
        method: 'POST',
        body: fd
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Nie udało się wgrać modelu');

      setForm(data.metadata);
      setModelFile(null);
      setMessage('Model wgrany poprawnie.');
      // Odśwież dane obiektu, aby zaktualizować metadane
      await fetchSingleObject(selectedId);
      await fetchObjects(true);
    } catch (error) {
      setMessage(error.message || 'Nie udało się wgrać modelu.');
    } finally {
      setLoading(false);
    }
  };

  // --------------------- Upload preview ---------------------
  const uploadPreview = async () => {
    try {
      if (!selectedId) {
        setMessage('Najpierw wybierz obiekt.');
        return;
      }
      if (!previewFile) {
        setMessage('Najpierw wybierz plik .png');
        return;
      }
      setLoading(true);
      setMessage('');

      const fd = new FormData();
      fd.append('preview', previewFile);

      const response = await fetch(`${backendUrl}/object/${encodeURIComponent(selectedId)}/upload/preview`, {
        method: 'POST',
        body: fd
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Nie udało się wgrać preview');

      setForm(data.metadata);
      setPreviewFile(null);
      setMessage('Preview wgrany poprawnie.');
      await fetchSingleObject(selectedId);
      await fetchObjects(true);
    } catch (error) {
      setMessage(error.message || 'Nie udało się wgrać preview.');
    } finally {
      setLoading(false);
    }
  };

  const previewUrl = selectedId ? `${backendUrl}/object/${encodeURIComponent(selectedId)}/png` : '';

  // --------------------- Render ---------------------
  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <h2 className={styles.sidebarTitle}>Lista obiektów</h2>

          {/* Formularz tworzenia nowego obiektu – wszystkie pola wymagane */}
          <div className={styles.createBox}>
            <label className={styles.field}>
              <span>ID (nazwa katalogu)</span>
              <input
                className={styles.input}
                name="id"
                value={newObject.id}
                onChange={handleNewChange}
                type="text"
                placeholder="np. object-3"
              />
            </label>
            <label className={styles.field}>
              <span>Tytuł PL</span>
              <input
                className={styles.input}
                name="titlePl"
                value={newObject.titlePl}
                onChange={handleNewChange}
                type="text"
                placeholder="Tytuł po polsku"
              />
            </label>
            <label className={styles.field}>
              <span>Tytuł EN</span>
              <input
                className={styles.input}
                name="titleEn"
                value={newObject.titleEn}
                onChange={handleNewChange}
                type="text"
                placeholder="Title in English"
              />
            </label>
            <label className={styles.field}>
              <span>Opis PL</span>
              <textarea
                className={styles.textarea}
                name="descriptionPl"
                value={newObject.descriptionPl}
                onChange={handleNewChange}
                rows="2"
                placeholder="Opis po polsku"
              />
            </label>
            <label className={styles.field}>
              <span>Opis EN</span>
              <textarea
                className={styles.textarea}
                name="descriptionEn"
                value={newObject.descriptionEn}
                onChange={handleNewChange}
                rows="2"
                placeholder="Description in English"
              />
            </label>
            <label className={styles.checkboxRow}>
              <input
                name="isActive"
                checked={newObject.isActive}
                onChange={handleNewChange}
                type="checkbox"
              />
              <span>isActive</span>
            </label>
            <div className={styles.field}>
              <span>Scale: {Number(newObject.scale || 1).toFixed(1)}</span>
              <input
                name="scale"
                value={newObject.scale}
                onChange={handleNewChange}
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
              />
            </div>
            <button className={styles.buttonPrimary} type="button" onClick={createObject} disabled={loading}>
              Dodaj obiekt
            </button>
          </div>

          <div className={styles.objectList}>
            {objects.length === 0 && <div className={styles.emptyState}>Brak obiektów.</div>}
            {objects.map((object) => (
              <button
                key={object.id}
                type="button"
                onClick={() => handleSelectObject(object.id)}
                className={`${styles.objectItem} ${selectedId === object.id ? styles.objectItemActive : ''}`}
              >
                <span className={styles.objectItemTitle}>{object.id}</span>
                <span className={styles.objectItemMeta}>
                  {object.isActive ? 'active' : 'inactive'}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <main className={styles.main}>
          <div className={styles.card}>
            <h1 className={styles.title}>CMS obiektów 3D</h1>
            <p className={styles.subtitle}>Backend: {backendUrl}</p>

            {message && <div className={styles.message}>{message}</div>}

            {!selectedId ? (
              <div className={styles.emptyStateLarge}>
                Wybierz obiekt z listy albo utwórz nowy (wypełniając wszystkie pola po lewej).
              </div>
            ) : (
              <>
                <div className={styles.grid}>
                  <label className={styles.field}>
                    <span>ID katalogu / obiektu</span>
                    <input
                      className={styles.input}
                      name="id"
                      value={form.id}
                      onChange={handleChange}
                      type="text"
                    />
                  </label>

                  <div className={styles.inlineActions}>
                    <button className={styles.button} type="button" onClick={renameObject}>
                      Zmień ID / nazwę katalogu
                    </button>
                    <button className={styles.buttonDanger} type="button" onClick={deleteObject}>
                      Usuń obiekt
                    </button>
                  </div>

                  <label className={styles.field}>
                    <span>Tytuł PL</span>
                    <input
                      className={styles.input}
                      name="titlePl"
                      value={form.titlePl}
                      onChange={handleChange}
                      type="text"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Tytuł EN</span>
                    <input
                      className={styles.input}
                      name="titleEn"
                      value={form.titleEn}
                      onChange={handleChange}
                      type="text"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Opis PL</span>
                    <textarea
                      className={styles.textarea}
                      name="descriptionPl"
                      value={form.descriptionPl}
                      onChange={handleChange}
                      rows="4"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Opis EN</span>
                    <textarea
                      className={styles.textarea}
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
                    <span>Scale: {Number(form.scale || 1).toFixed(1)}</span>
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
                    <span>Aktualny model</span>
                    <strong>{form.model || 'Brak pliku .glb'}</strong>
                    <input
                      className={styles.input}
                      type="file"
                      accept=".glb"
                      onChange={(e) => setModelFile(e.target.files?.[0] || null)}
                    />
                    <button className={styles.button} type="button" onClick={uploadModel}>
                      Upload modelu .glb
                    </button>
                  </div>

                  <div className={styles.fileBox}>
                    <span>Aktualny preview</span>
                    <strong>{form.preview || 'Brak pliku .png'}</strong>
                    <input
                      className={styles.input}
                      type="file"
                      accept=".png"
                      onChange={(e) => setPreviewFile(e.target.files?.[0] || null)}
                    />
                    <button className={styles.button} type="button" onClick={uploadPreview}>
                      Upload preview .png
                    </button>
                  </div>

                  <div className={styles.previewWrap}>
                    <span className={styles.previewLabel}>Podgląd PNG</span>
                    <img
                      key={previewUrl + form.preview}
                      src={previewUrl}
                      alt={form.titlePl || form.id || 'preview'}
                      className={styles.previewImage}
                    />
                  </div>
                </div>

                <div className={styles.actions}>
                  <button
                    className={styles.buttonPrimary}
                    onClick={saveObject}
                    type="button"
                    disabled={loading}
                  >
                    {loading ? 'Zapisywanie...' : 'Zapisz obiekt'}
                  </button>

                  <button
                    className={styles.buttonSecondary}
                    onClick={() => fetchSingleObject(selectedId)}
                    type="button"
                    disabled={loading}
                  >
                    Odśwież obiekt
                  </button>

                  <button
                    className={styles.buttonSecondary}
                    onClick={() => fetchObjects(true)}
                    type="button"
                    disabled={loading}
                  >
                    Odśwież listę
                  </button>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}