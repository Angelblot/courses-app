import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useWizardStore, buildConsolidatedItems } from '../stores/wizardStore.js';
import { useProductsStore } from '../stores/productsStore.js';
import { useRecipesStore } from '../stores/recipesStore.js';
import { AsyncImage } from '../components/ui/AsyncImage.jsx';
import { Icon } from '../components/ui/Icon.jsx';
import { ProductQuickAdd } from '../components/products/ProductQuickAdd.jsx';
import { productImageFallback } from '../lib/tableeImages.js';
export const productSize = (p) => p.grammage_g ? `${p.grammage_g} g` : p.volume_ml ? (p.volume_ml >= 1000 ? `${p.volume_ml / 1000} L` : `${p.volume_ml} ml`) : p.unit || 'unité';
export function HomePage() {
  const products = useProductsStore();
  const recipes = useRecipesStore();
  const draft = useWizardStore();
  useEffect(()=>{products.load();recipes.load();},[products.load,recipes.load]);
  const items = buildConsolidatedItems({...draft,products:products.items,recipes:recipes.items});
  const loaded = products.loaded && recipes.loaded;
  const habits = products.items.filter((p)=>p.favorite).slice(0,3);
  const month = new Intl.DateTimeFormat('fr-FR',{month:'long'}).format(new Date());
  function add(p) { if(draft.quotidien[p.id] !== 'needed') {draft.markProduct(p.id,'needed');draft.setQuotidienQty(p.id,p.default_quantity || 1);} }
  return <section className="reserve-home">
    <header className="reserve-brand"><Link to="/">Courses</Link><Link to="/settings" className="reserve-avatar" aria-label="Réglages"><Icon name="settings" size={22}/></Link></header>
    <h1>On prépare les courses ?</h1><p className="reserve-subtitle">Ta liste de {month}</p>
    <section className="reserve-hero">
      <img src="/media/tablee/grocery-banner.webp" alt="" className="reserve-hero-photo" />
      <div className="reserve-hero-copy"><strong>{loaded ? `${items.length} article${items.length !== 1 ? 's' : ''}` : 'Ta liste'}</strong><span>{items.length ? 'Liste en cours' : 'Prête à être complétée'}</span><Link className="btn" to="/current-list">{items.length || draft.draftStarted ? 'Reprendre ma liste' : 'Préparer ma liste'}</Link></div>
    </section>
    {(products.error || recipes.error) && <div className="notice notice--error" role="alert">Le catalogue n’a pas pu être chargé. <button className="text-action" onClick={()=>{products.load();recipes.load();}}>Réessayer</button></div>}
    <section className="reserve-habits"><h2>À reprendre d’habitude</h2>
      {products.loading && !products.loaded && <p role="status">Chargement de tes produits…</p>}
      {products.loaded && !products.error && habits.length===0 && <p className="text-muted">Retrouve ici tes produits favoris. <Link to="/products">Choisir mes habituels</Link></p>}
      <div className="reserve-habit-list">{habits.map((p)=><article className="reserve-habit" key={p.id}><AsyncImage src={p.image_url} fallbackSrc={productImageFallback(p)} alt={p.name} className="reserve-product-image" fallbackIcon="package"/><div><strong>{p.name}</strong><small>{productSize(p)}</small></div><button className="reserve-add" aria-label={`${draft.quotidien[p.id]==='needed' ? 'Déjà ajouté' : 'Ajouter'} : ${p.name}`} aria-pressed={draft.quotidien[p.id]==='needed'} onClick={()=>add(p)}><Icon name={draft.quotidien[p.id]==='needed'?'check':'plus'} size={22}/></button></article>)}</div>
    </section>
    <ProductQuickAdd />
    <div className="reserve-secondary"><Link to="/lists">Historique des listes</Link>{draft.lastSessionId && <Link to={`/results/${draft.lastSessionId}`}>Suivre mes paniers</Link>}<Link to="/products">Tous mes produits</Link></div>
  </section>;
}
