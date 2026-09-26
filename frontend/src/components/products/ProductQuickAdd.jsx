import { useState } from 'react';
import { useProductsStore } from '../../stores/productsStore.js';
import { useWizardStore } from '../../stores/wizardStore.js';
import { AsyncImage } from '../ui/AsyncImage.jsx';
import { Icon } from '../ui/Icon.jsx';
import { productImageFallback } from '../../lib/tableeImages.js';
const normalize = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').trim();
export function ProductQuickAdd() {
  const {items} = useProductsStore();
  const {addExtra,markProduct,quotidien,setQuotidienQty} = useWizardStore();
  const [query,setQuery] = useState('');
  const [message,setMessage] = useState('');
  const matches = query.trim() ? items.filter((p) => normalize(p.name).includes(normalize(query))).slice(0,4) : [];
  function add(product) {
    if (product) {if (quotidien[product.id] !== 'needed') markProduct(product.id,'needed');setQuotidienQty(product.id, product.default_quantity || 1);}
    else if (query.trim()) addExtra({name:query.trim()});
    setMessage(`${product?.name || query.trim()} ajouté à la liste`);setQuery('');
  }
  return <section className="reserve-quick-add">
    <form onSubmit={(e) => {e.preventDefault();if(query.trim())add(items.find((p)=>normalize(p.name)===normalize(query)));}}>
      <Icon name="search" size={20}/><input aria-label="Ajouter un produit" placeholder="Ajouter un produit…" value={query} maxLength={255} onChange={(e)=>setQuery(e.target.value)} />
      {query.trim() && <button type="submit" aria-label="Ajouter à ma liste"><Icon name="plus"/></button>}
    </form>
    {matches.length > 0 && <ul className="reserve-suggestions">{matches.map((p)=><li key={p.id}><button onClick={()=>add(p)}><AsyncImage src={p.image_url} fallbackSrc={productImageFallback(p)} alt={p.name} className="reserve-product-image"/><span>{p.name}</span><Icon name="plus" size={18}/></button></li>)}</ul>}
    <span className="sr-only" role="status">{message}</span>
  </section>;
}
