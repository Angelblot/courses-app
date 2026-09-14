import { ProductSuggestions, productSuggestion } from './ProductSuggestions';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMaison } from '../contexts/useMaison';
import { useWizard } from '../contexts/WizardContext';
import type { Product } from '../stores/products';
import { manquesDuBrouillon, manqueActif, manquesAValider, type Manque } from '../lib/session-courses';
import { Action, Head, Photo, ui } from './MaisonUI';
const sources={widget:'Widget',siri:'Siri',manuel:'Noté dans l’app',precedent:'Ajout précédent'};
function ManqueRow({lineKey,manque,products}:{lineKey:string;manque:Manque;products:Product[]}) {
 const w=useWizard(),id=lineKey.startsWith('produit:')?lineKey.slice(8):undefined;
 const product=products.find(p=>p.id===id),extra=w.extras.find(x=>`extra:${x.id}`===lineKey);
 const [qty,setQty]=useState(id?w.quotidienQty[id]??1:extra?.quantity??1),[chosen,setChosen]=useState(id),[search,setSearch]=useState(''),[edit,setEdit]=useState(false);
 const selected=products.find(p=>p.id===chosen),name=selected?.name??product?.name??extra?.name??manque.name;
 return <View style={{backgroundColor:'white',padding:14,borderRadius:12,gap:10}}>
 <View style={ui.row}><Photo name={name} url={selected?.image_url}/><View style={{flex:1}}><Text style={ui.productName}>{name}</Text><Text style={ui.detail}>{sources[manque.source]}{manque.valide?' · Vérifié':''}</Text><Text style={ui.detail}>{selected?[selected.brand,selected.volume_ml?`${selected.volume_ml} ml`:selected.grammage_g?`${selected.grammage_g} g`:selected.unit].filter(Boolean).join(' · '):'Libellé libre · choisis un produit ou garde ce nom'}</Text></View></View>
 {(!manque.valide||edit)&&<><View style={ui.sectionRow}><Text style={ui.detail}>Nombre d’articles</Text><View style={ui.counter}><Pressable accessibilityRole="button" accessibilityLabel={`Diminuer ${name}`} style={ui.iconButton} onPress={()=>setQty(Math.max(1,qty-1))}><Text style={ui.title}>−</Text></Pressable><Text style={ui.num}>{qty}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Augmenter ${name}`} style={ui.iconButton} onPress={()=>setQty(Math.min(99,qty+1))}><Text style={ui.title}>+</Text></Pressable></View></View>
 <TextInput style={ui.input} value={search} onChangeText={setSearch} placeholder="Changer de produit ou de format…" accessibilityLabel={`Chercher un remplacement pour ${name}`}/>
 {search.trim().length>=2&&<ProductSuggestions items={products.filter(p=>p.name.toLowerCase().includes(search.trim().toLowerCase())).slice(0,20).map(productSuggestion)} selectedId={chosen} onSelect={setChosen}/>}
 {search.trim().length>=2&&!products.some(p=>p.name.toLowerCase().includes(search.trim().toLowerCase()))&&<Text style={ui.detail}>Aucun produit trouvé. Essaie un autre nom.</Text>}
 {!!id&&!product&&!selected&&<Text style={ui.error}>Ce produit n’est plus dans le catalogue. Choisis un remplacement ou retire ce manque.</Text>}
 <Action disabled={!!chosen&&!selected} onPress={()=>{w.validerManque(lineKey,qty,chosen);setEdit(false);}}>Confirmer {qty} × {name}</Action></>}
 <View style={ui.sectionRow}>{manque.valide&&<Pressable accessibilityRole="button" style={ui.iconButton} onPress={()=>setEdit(!edit)}><Text style={ui.link}>{edit?'Fermer':'Modifier'}</Text></Pressable>}<Pressable accessibilityRole="button" style={ui.iconButton} onPress={()=>w.modifierLigne(lineKey,0)}><Text style={ui.detail}>Je n’en ai plus besoin</Text></Pressable></View>
 </View>;
}
export function Manques({session=false}:{session?:boolean}) {
 const {w,p,r,loading,erreur}=useMaison();
 const entries=Object.entries(manquesDuBrouillon(w)).filter(([key])=>manqueActif(w,key)),pending=manquesAValider(w);
 return <SafeAreaView edges={session?[]:['top']} style={ui.screen}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}>
 <Head title={session?'Vérifier mes manques':'Ce qu’il me manque'} back={!session}/><Text style={ui.subtitle}>{session?'Vérifie le produit, son format et sa quantité avant de passer à tes habitudes.':'Les produits notés au fil des jours avec le widget, Siri ou dans l’app.'}</Text>
 {loading&&<ActivityIndicator/>}{erreur&&<><Text style={ui.error}>{erreur}</Text><Action secondary onPress={()=>{p.recharger();r.recharger();}}>Réessayer</Action></>}{w.sauvegardeErreur&&<Text style={ui.error}>{w.sauvegardeErreur}</Text>}
 {entries.map(([key,m])=><ManqueRow key={key} lineKey={key} manque={m} products={p.produits}/>)}
 {!entries.length&&!loading&&!erreur&&<View style={ui.notice}><Text style={ui.productName}>Rien ne manque pour le moment.</Text><Text style={ui.subtitle}>Ajoute un produit dès que tu remarques qu’il manque à la maison.</Text></View>}
 {!session&&<Action secondary onPress={()=>router.push('/ajout')}>Noter un manque</Action>}
 </ScrollView><View style={ui.footer}>{session?<><Text accessibilityLiveRegion="polite" style={ui.detail}>{pending.length?`${pending.length} produit${pending.length>1?'s':''} à vérifier`:'Tous tes manques sont vérifiés.'}</Text><Action disabled={loading||!!erreur||pending.length>0} onPress={()=>router.replace('/wizard/habitudes')}>Continuer avec mes habitudes</Action></>:<Action onPress={()=>{w.demarrerSession();router.push(`/wizard/${w.sessionEtape??'recettes'}`);}}>{w.sessionEtape?'Reprendre ma session':'Préparer mes courses'}</Action>}</View></SafeAreaView>;
}
