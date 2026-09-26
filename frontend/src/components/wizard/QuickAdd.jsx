import { useState } from 'react';
import { useWizardStore } from '../../stores/wizardStore.js';
import { Button } from '../ui/Button.jsx';
import { Counter } from '../ui/Counter.jsx';
import { Icon } from '../ui/Icon.jsx';
export function QuickAdd({compact = false}) {
  const {extras, addExtra, updateExtra, removeExtra} = useWizardStore();
  const [value, setValue] = useState('');
  const [message, setMessage] = useState('');
  return <section className="quick-add">
    {!compact && <h2>Autre chose ?</h2>}
    <form className="inline-form" onSubmit={(e) => { e.preventDefault(); if (value.trim()) {addExtra({name:value.trim()});setMessage(`${value.trim()} ajouté à ta liste`);setValue('');} }}>
      <input aria-label="Autre produit à ajouter" placeholder="Un produit à ajouter…" value={value} maxLength={255} onChange={(e) => setValue(e.target.value)} />
      <Button type="submit" disabled={!value.trim()} aria-label="Ajouter le produit"><Icon name="plus" /></Button>
    </form>
    <span className="sr-only" role="status">{message}</span>
    {extras.length > 0 && <details className="quick-add-items" open={!compact || undefined}><summary>{extras.length} ajout{extras.length > 1 ? 's' : ''} dans ta liste</summary><ul>{extras.map((e) => <li className="extra-row" key={e.id}><span>{e.name}</span><Counter value={e.quantity} onChange={(quantity) => updateExtra(e.id,{quantity})} min={1} max={99} ariaLabel={`Quantité de ${e.name}`} /><Button variant="ghost" onClick={() => removeExtra(e.id)} aria-label={`Retirer ${e.name}`}><Icon name="x" size={18} /></Button></li>)}</ul></details>}
  </section>;
}
