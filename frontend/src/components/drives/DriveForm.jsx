import { useState } from 'react';
import { Button } from '../ui/Button.jsx';
import { Card } from '../ui/Card.jsx';
import { Input, Select } from '../ui/Input.jsx';

const EMPTY = {
  name: 'carrefour',
  display_name: '',
  email: '',
  password: '',
  default_store: '',
};

export function DriveForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(form);
      setForm(EMPTY);
      onCancel?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card size="lg">
      <form onSubmit={handleSubmit} className="stack">
        <Select
          value={form.name}
          onChange={(e) => update({ name: e.target.value })}
          aria-label="Enseigne"
        >
          <option value="carrefour">Carrefour Drive</option>
          <option value="leclerc">E.Leclerc Drive</option>
        </Select>
        <Input
          placeholder="Nom d'affichage"
          value={form.display_name}
          onChange={(e) => update({ display_name: e.target.value })}
          aria-label="Nom d'affichage"
        />
        <Input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => update({ email: e.target.value })}
          required
          aria-label="Email"
        />
        <Input
          type="password"
          placeholder="Mot de passe"
          value={form.password}
          onChange={(e) => update({ password: e.target.value })}
          required
          aria-label="Mot de passe"
        />
        <Input
          placeholder="Magasin par défaut"
          value={form.default_store}
          onChange={(e) => update({ default_store: e.target.value })}
          aria-label="Magasin par défaut"
        />
        <Button type="submit" full disabled={submitting}>
          {submitting ? '…' : '✅ Enregistrer'}
        </Button>
      </form>
    </Card>
  );
}
