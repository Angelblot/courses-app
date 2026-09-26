import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProductsStore } from '../stores/productsStore.js';
import { useRecipesStore } from '../stores/recipesStore.js';
import { useWizardStore, getRecipeIngredientMatches, resolveIngredientChoice, buildConsolidatedItems } from '../stores/wizardStore.js';
import { AsyncImage } from '../components/ui/AsyncImage.jsx';
import { Counter } from '../components/ui/Counter.jsx';
import { Icon } from '../components/ui/Icon.jsx';
import { ProductQuickAdd } from '../components/products/ProductQuickAdd.jsx';
import { RecipeProductMatching } from '../components/wizard/RecipeProductMatching.jsx';
import { productImageFallback } from '../lib/tableeImages.js';
import { productSize } from './HomePage.jsx';
const categoryName = (name='Autres') => ({pls:'Produits frais',charcuttraiteur:'Produits frais',epicerie:'Épicerie',boissons:'Boissons',fruits_legumes:'Fruits & légumes',droguerie:'Entretien',parfumerie:'Hygiène',maison:'Maison',surgeles:'Surgelés'}[name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z_]/g,'')] || name.charAt(0).toUpperCase()+name.slice(1).toLowerCase());
export function CurrentListPage() {
  const products = useProductsStore();
  const recipes = useRecipesStore();
  const draft = useWizardStore();
  const navigate = useNavigate();
  const [tab,setTab] = useState('buy');
  useEffect(()=>{products.load();recipes.load();draft.setLastStep('checklist');},[products.load,recipes.load,draft.setLastStep]);
  const items = buildConsolidatedItems({...draft,products:products.items,recipes:recipes.items});
  const rows = [];
  getRecipeIngredientMatches({selectedRecipes:draft.selectedRecipes,recipes:recipes.items,products:products.items}).filter((g)=>g.totalQty>0).forEach((group)=>{
    const {product,owned,quantity} = resolveIngredientChoice(group,draft.ingredientChoices,draft.quotidien,products.items);
    rows.push({key:`recipe:${group.key}`,name:product?.name || group.ingredientName,product:product || {name:group.ingredientName},category:categoryName(product?.category_label || product?.category || group.categoryHint || 'Pour les repas'),owned,quantity,
      detail:product ? productSize(product) : group.unit,
      setOwned:(value)=>draft.setIngredientChoice(group.key,{owned:value}),
      setQuantity:product ? (quantity)=>draft.setIngredientChoice(group.key,{quantity}) : null});
  });
  Object.entries(draft.quotidien).forEach(([id,status])=>{
    const p = products.items.find((p)=>String(p.id)===id); if (!p) return;
    rows.push({key:`product:${id}`,name:p.name,product:p,category:categoryName(p.category_label || p.category || 'Autres'),owned:status==='owned',quantity:draft.quotidienQty[id] || p.default_quantity || 1,detail:productSize(p),
      setOwned:(value)=>{const status=value?'owned':'needed';if(draft.quotidien[id]!==status)draft.markProduct(id,status);},setQuantity:(n)=>draft.setQuotidienQty(id,n)});
  });
  draft.extras.forEach((e)=>rows.push({key:e.id,name:e.name,product:{name:e.name},category:categoryName(e.rayon || 'Autres'),owned:!!e.owned,quantity:e.quantity,detail:e.unit,
    setOwned:(owned)=>draft.updateExtra(e.id,{owned}),setQuantity:(quantity)=>draft.updateExtra(e.id,{quantity})}));
  const groups = new Map();
  rows.filter((r)=>r.owned===(tab==='owned')).forEach((r)=>{if(!groups.has(r.category))groups.set(r.category,[]);groups.get(r.category).push(r);});
  const month = new Intl.DateTimeFormat('fr-FR',{month:'long'}).format(new Date());
  const loading = products.loading || recipes.loading;
  const error = products.error || recipes.error;
  return <section className="reserve-list-page">
    <header className="reserve-list-header"><Link to="/" aria-label="Retour aux courses"><Icon name="arrowLeft" size={26}/></Link><div><h1>Ma liste</h1><p>{items.length} article{items.length!==1?'s':''} · {month}</p></div><span /></header>
    <div className="reserve-tabs" role="tablist" aria-label="État des produits"><button role="tab" id="buy-tab" aria-controls="list-panel" aria-selected={tab==='buy'} onClick={()=>setTab('buy')}>À acheter</button><button role="tab" id="owned-tab" aria-controls="list-panel" aria-selected={tab==='owned'} onClick={()=>setTab('owned')}>Déjà chez moi</button></div>
    {error && <div className="notice notice--error" role="alert">Impossible de charger ta liste. <button className="text-action" onClick={()=>{products.load();recipes.load();}}>Réessayer</button></div>}
    {loading && !products.loaded && <p role="status">Chargement de ta liste…</p>}
    <div id="list-panel" role="tabpanel" aria-labelledby={tab==='buy'?'buy-tab':'owned-tab'}>
      {[...groups].sort(([a],[b]) => (a==='Produits frais' ? -1 : b==='Produits frais' ? 1 : a.localeCompare(b,'fr'))).map(([category,entries])=><section className="reserve-list-group" key={category}><h2>{category}</h2><ul>{entries.map((row)=><li className="reserve-list-row" key={row.key}>
        <AsyncImage src={row.product.image_url} fallbackSrc={productImageFallback(row.product)} alt={row.name} className="reserve-product-image" fallbackIcon="package"/>
        <div className="reserve-list-name"><strong>{row.name}</strong><small>{row.detail}</small></div>
        <label className="reserve-owned"><input type="checkbox" checked={row.owned} onChange={(e)=>row.setOwned(e.target.checked)} aria-label={`Déjà chez moi : ${row.name}`}/></label>
        {row.setQuantity ? <Counter value={row.quantity} onChange={row.setQuantity} min={1} max={999} ariaLabel={`Quantité de ${row.name}`}/> : <span className="reserve-raw-qty">{row.quantity} {row.detail}</span>}
      </li>)}</ul></section>)}
      {!loading && !error && groups.size===0 && <p className="reserve-empty">{tab==='owned' ? 'Coche les produits que tu as déjà : ils seront conservés ici et retirés des achats.' : 'Ta liste est vide. Ajoute un produit ci-dessous ou choisis tes recettes.'}</p>}
    </div>
    <ProductQuickAdd />
    {Object.keys(draft.selectedRecipes).length>0 && <details className="reserve-ingredient-details"><summary>Vérifier les ingrédients et choisir les produits</summary><RecipeProductMatching /></details>}
    <Link className="reserve-recipe-link" to="/meals"><Icon name="chef" size={20}/>Ajouter les ingrédients d’une recette</Link>
    <footer className="reserve-list-footer"><div><span aria-live="polite">{items.length} article{items.length!==1?'s':''} dans la liste</span><button className="btn" disabled={!items.length || !!error || loading} onClick={()=>navigate('/wizard/recap')}>Choisir mon drive</button></div></footer>
  </section>;
}
