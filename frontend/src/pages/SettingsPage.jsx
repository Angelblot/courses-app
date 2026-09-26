import { Link } from 'react-router-dom';
import { Icon } from '../components/ui/Icon.jsx';
export function SettingsPage() {
  return <section className="stack stack--lg"><header className="page-header"><h1>Réglages</h1><p className="text-muted">Tes préférences pour des courses plus simples.</p></header>{[{to:'/products',icon:'package',title:'Mes produits',body:'Retrouver et compléter mon catalogue'},{to:'/recipes',icon:'book',title:'Mes recettes',body:'Ajouter une recette ou sa photo'},{to:'/drives',icon:'car',title:'Mes drives',body:'Configurer Carrefour et E.Leclerc'},{to:'/categories',icon:'grid',title:'Mes rayons',body:'Organiser les catégories de produits'}].map((item)=><Link key={item.to} to={item.to} className="history-link"><span className="history-link__icon"><Icon name={item.icon}/></span><span><strong>{item.title}</strong><small>{item.body}</small></span><Icon name="arrowRight" size={18}/></Link>)}</section>;
}
