import { ProductSuggestions, productSuggestion } from './ProductSuggestions';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMaison } from '../contexts/useMaison';
import { useWizard } from '../contexts/WizardContext';
import type { Product } from '../stores/products';
import { Feather } from '@expo/vector-icons';
import { manquesDuBrouillon, manqueActif, manquesAPreciser, type Manque } from '../lib/session-courses';
import { colors } from '../lib/theme';
import { Action, BasDeLEcran, Head, Photo, Raison, ui, useAnnulation, useChampVisible } from './MaisonUI';
import { appuiLongFiche } from './FicheAppuiLong';
import { revenirAuBilan } from './SessionProgress';
import { AssocierSiri } from './AssocierSiri';
import { GlisserRetirer } from './GlisserRetirer';
export const sources:Record<string,string>={widget:'Widget',siri:'Siri',rappels:'Rappels',manuel:'Noté',precedent:'Ajout précédent'};
/**
 * Un manque. Prêt d'office s'il désigne un produit du catalogue : on le
 * touche seulement pour changer la quantité ou le format. Un libellé libre
 * ou un produit disparu s'ouvre directement pour être précisé.
 */
export function ManqueRow({lineKey,manque,products,aPreciser,onRetrait,onProduitsChange}:{lineKey:string;manque:Manque;products:Product[];aPreciser:boolean;onRetrait?:(texte:string,annuler:()=>void)=>void;onProduitsChange?:()=>void}) {
 if(aPreciser&&(lineKey.startsWith('extra:siri-')||lineKey.startsWith('extra:rappel-')))return <ManqueSiri lineKey={lineKey} manque={manque} products={products} onProduitsChange={onProduitsChange}/>;
 return <ManqueCatalogue lineKey={lineKey} manque={manque} products={products} aPreciser={aPreciser} onRetrait={onRetrait}/>;
}
/**
 * Un besoin dicté à Siri, ou rangé par Siri dans Rappels, que l'app n'a pas
 * reconnu (RS1) : la ligne le dit, et un tap ouvre le choix du produit,
 * retenu pour la fois suivante.
 */
function ManqueSiri({lineKey,manque,products,onProduitsChange}:{lineKey:string;manque:Manque;products:Product[];onProduitsChange?:()=>void}) {
 const w=useWizard(),extra=w.extras.find(x=>`extra:${x.id}`===lineKey),nom=extra?.name??manque.name,quantite=extra?.quantity??1;
 const [ouvert,setOuvert]=useState(false),rappel=manque.source==='rappels',origine=rappel?'repris de Rappels':'dit à Siri';
 return <View style={[m.carte,m.aPreciser]}>
 <Pressable accessibilityRole="button" accessibilityLabel={`${nom}, ${origine}, produit pas reconnu. Choisir le produit`} onPress={()=>setOuvert(true)} style={({pressed})=>[ui.row,pressed&&{opacity:.85}]}>
  <View style={m.micro}><Feather name={rappel?'check-circle':'mic'} size={18} color={colors.attentionText}/></View>
  <View style={{flex:1,gap:2}}><Text style={ui.productName}>{nom}</Text><Text style={m.pasReconnu}>{sources[manque.source]} · produit pas reconnu</Text><Text style={ui.link}>Choisir le produit</Text></View>
  <Text style={ui.num}>× {quantite}</Text>
 </Pressable>
 <AssocierSiri visible={ouvert} nom={nom} produits={products} onFermer={()=>setOuvert(false)}
  onAssocie={id=>{setOuvert(false);w.validerManque(lineKey,quantite,id);onProduitsChange?.();}}
  onNote={()=>{setOuvert(false);w.validerManque(lineKey,quantite);}}/>
 </View>;
}
function ManqueCatalogue({lineKey,manque,products,aPreciser,onRetrait}:{lineKey:string;manque:Manque;products:Product[];aPreciser:boolean;onRetrait?:(texte:string,annuler:()=>void)=>void}) {
 const w=useWizard(),id=lineKey.startsWith('produit:')?lineKey.slice(8):undefined;
 const product=products.find(p=>p.id===id),extra=w.extras.find(x=>`extra:${x.id}`===lineKey);
 const [qty,setQty]=useState(id?w.quotidienQty[id]??1:extra?.quantity??1),[chosen,setChosen]=useState(id),[search,setSearch]=useState(''),[edit,setEdit]=useState(false);
 const selected=products.find(p=>p.id===chosen),name=selected?.name??product?.name??extra?.name??manque.name;
 // Un produit du catalogue garde sa nouvelle quantité tout de suite ; un
 // manque à préciser attend le bouton, puisqu'on peut encore changer de produit.
 const changerQty=(n:number)=>{setQty(n);if(!aPreciser&&chosen===id)w.validerManque(lineKey,n,chosen);};
 const ouvert=aPreciser||edit,format=selected?[selected.brand,selected.volume_ml?`${selected.volume_ml} ml`:selected.grammage_g?`${selected.grammage_g} g`:selected.unit].filter(Boolean).join(' · '):'';
 const quantite=id?w.quotidienQty[id]??1:extra?.quantity??1;
 return <View style={[m.carte,aPreciser&&m.aPreciser]}>
 <Pressable accessibilityRole="button" accessibilityLabel={aPreciser?`${name}, à préciser`:`${name}, ${quantite} article${quantite>1?'s':''}. Modifier`} accessibilityState={{expanded:ouvert}} disabled={aPreciser} onPress={()=>setEdit(!edit)} {...appuiLongFiche(selected)} style={ui.row}>
  <Photo name={name} url={selected?.image_url}/>
  <View style={{flex:1}}><Text style={ui.productName}>{name}</Text><Text style={ui.detail}>{[sources[manque.source],format].filter(Boolean).join(' · ')}</Text>{aPreciser&&<Text style={m.drapeau}>À préciser</Text>}</View>
  {!aPreciser&&<View style={ui.row}><Text style={ui.num}>× {quantite}</Text><View style={m.pret}><Feather name={edit?'chevron-up':'check'} size={16} color={colors.accent}/></View></View>}
 </Pressable>
 {ouvert&&<><View style={ui.sectionRow}><Text style={ui.detail}>Nombre d’articles</Text><View style={ui.counter}><Pressable accessibilityRole="button" accessibilityLabel={`Diminuer ${name}`} style={ui.iconButton} onPress={()=>changerQty(Math.max(1,qty-1))}><Text style={ui.title}>−</Text></Pressable><Text style={ui.num}>{qty}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Augmenter ${name}`} style={ui.iconButton} onPress={()=>changerQty(Math.min(99,qty+1))}><Text style={ui.title}>+</Text></Pressable></View></View>
 <TextInput style={ui.input} value={search} onChangeText={setSearch} placeholder="Changer de produit ou de format…" accessibilityLabel={`Changer de produit ou de format pour ${name}`}/>
 {search.trim().length>=2&&<ProductSuggestions items={products.filter(p=>p.name.toLowerCase().includes(search.trim().toLowerCase())).slice(0,20).map(productSuggestion)} selectedId={chosen} onSelect={setChosen}/>}
 {search.trim().length>=2&&!products.some(p=>p.name.toLowerCase().includes(search.trim().toLowerCase()))&&<Text style={ui.detail}>Aucun produit trouvé. Essaie un autre nom.</Text>}
 {!!id&&!product&&!selected&&<Text style={ui.error}>Ce produit n’est plus dans le catalogue. Choisis un remplacement ou retire ce manque.</Text>}
 <Action disabled={!!chosen&&!selected} onPress={()=>{w.validerManque(lineKey,qty,chosen);setEdit(false);}}>{aPreciser?selected&&chosen!==id?`Choisir ${qty} × ${name}`:`Laisser « ${name} » tel quel`:'Enregistrer'}</Action>
 <Pressable accessibilityRole="button" accessibilityLabel={`Je n’en ai plus besoin : ${name}`} style={ui.iconButton} onPress={()=>{const avant=w.ligneQuantites[lineKey];w.modifierLigne(lineKey,0);onRetrait?.(`${name} retiré de tes manques`,()=>w.restaurerLigne(lineKey,avant));}}><Text style={ui.detail}>Je n’en ai plus besoin</Text></Pressable></>}
 </View>;
}
export function Manques({session=false}:{session?:boolean}) {
 const {w,p,r,loading,erreur}=useMaison();
 const entries=Object.entries(manquesDuBrouillon(w)).filter(([key])=>manqueActif(w,key));
 const annulation=useAnnulation(),champ=useChampVisible();
 const nomManque=(key:string,m:Manque)=>{const id=key.startsWith('produit:')?key.slice(8):undefined;return p.produits.find(x=>x.id===id)?.name??w.extras.find(x=>`extra:${x.id}`===key)?.name??m.name;};
 // Ce que Siri a rangé dans Rappels vient d'arriver : un message discret, une fois, avec « Annuler » (RA1).
 const reprise=w.derniereReprise;
 useEffect(()=>{if(!reprise||reprise.vue)return;const n=reprise.ids.length;annulation.proposer(`${n} article${n>1?'s':''} repris de « ${reprise.liste} » et coché${n>1?'s':''} dans Rappels`,w.annulerRepriseRappels);w.voirReprise();},[reprise,annulation.proposer,w.annulerRepriseRappels,w.voirReprise]);
 const pending=manquesAPreciser(w,p.produits.map(x=>x.id)),aPreciser=new Set(pending.map(([key])=>key)),prets=entries.length-pending.length;
 return <SafeAreaView edges={session?[]:['top']} style={ui.screen}><ScrollView ref={champ.ref} onScroll={champ.onScroll} scrollEventThrottle={16} keyboardShouldPersistTaps="handled" contentContainerStyle={[ui.content,{paddingBottom:28+champ.espace}]}>
 <Head title="Mes manques" back={!session} avatar={!session}/>{!session&&<Text style={ui.subtitle}>Les produits notés au fil des jours avec le widget, Siri, Rappels ou dans l’app.</Text>}
 {loading&&<ActivityIndicator/>}{erreur&&<><Text style={ui.error}>{erreur}</Text><Action secondary onPress={()=>{p.recharger();r.recharger();}}>Réessayer</Action></>}{w.sauvegardeErreur&&<Text style={ui.error}>{w.sauvegardeErreur}</Text>}
 {!loading&&entries.map(([key,m])=>{const nom=nomManque(key,m);return <GlisserRetirer key={key} nom={nom} onRetirer={()=>{const avant=w.ligneQuantites[key];w.modifierLigne(key,0);annulation.proposer(`${nom} retiré de tes manques`,()=>w.restaurerLigne(key,avant));}}>
  <ManqueRow lineKey={key} manque={m} products={p.produits} aPreciser={aPreciser.has(key)} onRetrait={annulation.proposer} onProduitsChange={p.recharger}/>
 </GlisserRetirer>;})}
 {!loading&&entries.length>0&&<Text style={ui.detail}>Touche un produit pour changer son format ou sa quantité ; glisse-le vers la gauche pour le retirer.</Text>}
 {!entries.length&&!loading&&!erreur&&<View style={ui.notice}><Text style={ui.productName}>Rien ne manque pour le moment.</Text><Text style={ui.subtitle}>Ajoute un produit dès que tu remarques qu’il manque à la maison.</Text></View>}
 {!session&&<Action secondary onPress={()=>router.push('/ajout')}>Noter un manque</Action>}
 </ScrollView><View style={ui.footer}>{annulation.toastPied}{session?<><Action disabled={loading||!!erreur} onPress={revenirAuBilan}>{pending.length?`Revenir au bilan · ${pending.length} à préciser`:'Revenir au bilan'}</Action>{pending.length>0&&!loading&&<Raison>{pending.length>1?`${pending.length} produits restent à préciser, maintenant ou au bilan.`:`« ${pending[0][1].name} » reste à préciser, maintenant ou au bilan.`}</Raison>}</>:<Action onPress={()=>{w.demarrerSession();router.navigate(`/wizard/${w.sessionEtape??'recettes'}`);}}>{w.sessionEtape?'Reprendre mes courses':'Préparer mes courses'}</Action>}</View>{!session&&<BasDeLEcran/>}</SafeAreaView>;
}
const m=StyleSheet.create({
 carte:{backgroundColor:colors.surface,padding:12,borderRadius:12,gap:10},
 aPreciser:{borderWidth:1.5,borderColor:colors.attention},
 drapeau:{alignSelf:'flex-start',marginTop:4,fontSize:12,fontWeight:'600',color:colors.attentionText,backgroundColor:colors.attentionSoft,borderRadius:6,paddingHorizontal:6,paddingVertical:2,overflow:'hidden'},
 micro:{width:44,height:44,borderRadius:10,backgroundColor:colors.attentionSoft,alignItems:'center',justifyContent:'center'},
 pasReconnu:{fontSize:13,fontWeight:'600',color:colors.attentionText},
 pret:{width:28,height:28,borderRadius:14,backgroundColor:colors.accentSoft,alignItems:'center',justifyContent:'center'},
});
