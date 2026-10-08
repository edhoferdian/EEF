import { useEffect } from 'react';
import { useSettings } from './store';

export function SettingsPanel({ user }) {
  const { draft, setDraft, save, reset } = useSettings();

  useEffect(() => {
    reset(user.settings);
  }, [user, draft.saved]);

  async function onSave() {
    await save(draft);
    setDraft({ ...draft, saved: true });
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(); }}>
      <select value={draft.theme} onChange={(e) => setDraft({ ...draft, theme: e.target.value })}>
        <option value="light">Terang</option>
        <option value="dark">Gelap</option>
      </select>
      <button type="submit">Simpan</button>
    </form>
  );
}
