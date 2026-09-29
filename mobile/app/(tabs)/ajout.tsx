import { ProductSuggestions, productSuggestion } from '../../components/ProductSuggestions';
import { useState, useRef } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Head, Action, Photo, ui, useAnnulation } from '../../components/MaisonUI';
import { revenirAuBilan } from '../../components/SessionProgress';
import { ajouterProduit, basculerFavori } from '../../stores/products';
import { useMaison } from '../../contexts/useMaison';
import { lignesSimilaires } from '../../lib/session-courses';
import { type FicheProduit } from '../../lib/openfoodfacts';
import { useRechercheOff } from '../../hooks/useRechercheOff';
import { nombreArticles } from '../../lib/ajouts-quotidiens';
import { suggestionsFrequentes, type Frequent } from '../../lib/extras-frequents';
import { colors } from '../../lib/theme';
type Ajoute = { key: string; name: string; qty: number };
// Sur le web, le navigateur trace son propre cadre de focus dans le champ ;
// la bordure verte du champ entier le remplace. `none` n'est pas typé par RN.
const sansCadreWeb = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;
/**
 * Étape Extras de la session, et « Il me manque… » hors session. Un seul
 * champ : on tape un nom pour le noter, on cherche le produit exact, ou on
 * scanne. Sans saisie, les extras les plus souvent notés s'ajoutent en un tap.
 */
export default function Ajout({session=false}:{session?:boolean}){
 const params=useLocalSearchParams<{name?:string}>();const [nom,setNom]=useState(typeof params.name==='string'?params.name:'');
 const [qty,setQty]=useState(1),[busy,setBusy]=useState(false),[erreur,setErreur]=useState(''),[fiche,setFiche]=useState<FicheProduit|null>(null),[habituel,setHabituel]=useState(false),[ajoutes,setAjoutes]=useState<Ajoute[]>([]),[focus,setFocus]=useState(false);
 const {p,w,lignes}=useMaison(),lock=useRef(false),annulation=useAnnulation(),insets=useSafeAreaInsets();
 const off=useRechercheOff(),resultats=off.resultats,saisie=nom.trim();
 function confirme(key:string,name:string,q:number,productId?:string){w.retenirExtra({name,productId});setAjoutes(a=>[{key,name,qty:q},...a.filter(x=>x.key!==key)]);setNom('');setFiche(null);off.reinitialiser();setQty(1);setHabituel(false);setErreur('');}
 function noterLibre(name:string,q=qty){const id=w.ajouterExtra({name,quantity:q,unit:'unité',rayon:'autre'},!session);confirme(`extra:${id}`,name,q);}
 // Une ligne proche existe : on lui ajoute la quantité plutôt que de créer un doublon.
 function ajouterALigne(l:{key:string;name:string;totalQuantity:number}){const avant=w.ligneQuantites[l.key];w.modifierLigne(l.key,l.totalQuantity+qty);annulation.proposer(`${l.name} : ${l.totalQuantity} → ${l.totalQuantity+qty}`,()=>w.restaurerLigne(l.key,avant));setNom('');off.reinitialiser();setQty(1);}
 // Noter à part vaut réponse : le bilan ne demandera pas si c'est un doublon.
 function noterAPart(name:string){similaires.forEach(l=>w.declarerDistinct(name,l.name));noterLibre(name);}
 function ajouterCatalogue(id:string,name:string,q=qty){w.ajouterProduitListe(id,q,!session);confirme(`produit:${id}`,name,q,id);}
 function choisirFrequent(f:Frequent){const produit=f.productId?p.produits.find(x=>x.id===f.productId):undefined;if(produit)ajouterCatalogue(produit.id,produit.name,1);else noterLibre(f.name,1);}
 function retirer(x:Ajoute){const avant=w.ligneQuantites[x.key];w.modifierLigne(x.key,0);setAjoutes(a=>a.filter(y=>y.key!==x.key));annulation.proposer(`${x.name} retiré de ta liste`,()=>{w.restaurerLigne(x.key,avant);setAjoutes(a=>[x,...a]);});}
 function search(){if(busy)return;setErreur('');setFiche(null);void off.chercher(nom);}
 async function importer(){if(!fiche||lock.current)return;lock.current=true;setBusy(true);setErreur('');try{const res=await ajouterProduit(fiche,habituel);const produit=res.produit??res.doublon;if(produit){if(habituel&&!produit.favorite){const fav=await basculerFavori(produit.id,true);if(!fav.ok){setErreur('Impossible d’enregistrer ce produit habituel. Réessaie.');return;}}ajouterCatalogue(produit.id,produit.name);p.recharger();}else setErreur(res.reseau?'Connexion indisponible. La fiche est conservée à l’écran pour réessayer.':res.erreur??'Impossible d’enregistrer ce produit.');}catch{setErreur('Enregistrement impossible. Réessaie.');}finally{lock.current=false;setBusy(false);}}
 // Déjà dans la liste : on ajuste la ligne existante plutôt que de créer un doublon.
 const similaires=saisie?lignesSimilaires(saisie,lignes).slice(0,3):[];
 const locaux=p.produits.filter(p=>saisie.length>0&&p.name.toLowerCase().includes(saisie.toLowerCase())&&!similaires.some(l=>l.product_id===p.id)).slice(0,5);
 const dejaListes=[...w.extras.map(x=>x.name),...p.produits.filter(x=>w.quotidien[x.id]==='needed').map(x=>x.name)];
 const frequents=suggestionsFrequentes(w.extrasFrequents??{},dejaListes);
 // S1 : un nom tapé sans ligne proche se note en revenant ; il n'est plus perdu.
 const notable=session&&!!saisie&&!similaires.length&&!fiche;
 const choix=(texte:string,nom:string,onPress:()=>void)=><Pressable key={texte} accessibilityRole="button" accessibilityLabel={nom} disabled={busy} onPress={onPress} style={({pressed})=>[ui.button,ui.secondary,{flex:1,minHeight:44},pressed&&{opacity:.85}]}><Text style={[ui.buttonText,{color:colors.accent}]}>{texte}</Text></Pressable>;
 const scanner=()=>router.push({pathname:'/scan',params:{destination:'liste',quantite:String(qty),manque:session?'0':'1'}});
 return <SafeAreaView edges={session?[]:['top']} style={ui.screen}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}><Head title={session?"Des extras ?":"Noter un manque"} back={!session} avatar={!session}/>
 <View style={ui.row}>
  <View style={[a.champ,focus&&{borderColor:colors.accent,borderWidth:2}]}><Feather name="search" size={18} color={colors.textMuted}/><TextInput accessibilityLabel="Produit manquant" autoFocus={!session&&!params.name} maxLength={120} editable={!busy} returnKeyType="done" onSubmitEditing={()=>{if(saisie)noterLibre(saisie);}} value={nom} onChangeText={v=>{setNom(v);off.reinitialiser();setErreur('');setFiche(null);}} placeholder="Lait, café, papier toilette…" placeholderTextColor={colors.textMuted} onFocus={()=>setFocus(true)} onBlur={()=>setFocus(false)} style={[a.saisie,sansCadreWeb]}/></View>
  <Pressable accessibilityRole="button" accessibilityLabel="Scanner un code-barres" onPress={scanner} style={({pressed})=>[a.scan,pressed&&{opacity:.7}]}><Feather name="maximize" size={20} color={colors.accent}/></Pressable>
 </View>
 {saisie?<>
  {/* Une ligne proche existe : deux réponses de même poids, aucune ne décide à ta place. */}
  {similaires.length>0&&<><Text style={ui.section}>Déjà dans ta liste</Text>{similaires.map(l=><View key={l.key} style={[ui.product,a.proche]}><View style={[ui.row,{width:'100%'}]}><Photo name={l.name} url={p.produits.find(x=>x.id===l.product_id)?.image_url}/><View style={{flex:1}}><Text style={ui.productName}>{l.name}</Text><Text style={ui.detail}>{[`${l.totalQuantity} dans ta liste`,...new Set(l.sources.map(s=>s.label))].join(' · ')}</Text></View></View>
   <View style={a.choix}>{choix(`${qty} de plus`,`${qty} de plus : ${l.name}, passer à ${l.totalQuantity+qty}`,()=>ajouterALigne(l))}{similaires.length===1&&choix('Noter à part',`Noter à part : ${saisie}`,()=>noterAPart(saisie))}</View></View>)}
   {similaires.length>1&&choix(`Noter « ${saisie} » à part`,`Noter à part : ${saisie}`,()=>noterAPart(saisie))}</>}
  {!similaires.length&&<View style={ui.sectionRow}><Text style={ui.productName}>Nombre d’articles</Text><View style={ui.counter}><Pressable accessibilityRole="button" accessibilityLabel={`Diminuer la quantité de ${saisie}`} style={ui.iconButton} onPress={()=>setQty(nombreArticles(qty-1))}><Text style={ui.title}>−</Text></Pressable><Text style={ui.num}>{qty}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Augmenter la quantité de ${saisie}`} style={ui.iconButton} onPress={()=>setQty(nombreArticles(qty+1))}><Text style={ui.title}>+</Text></Pressable></View></View>}
  {locaux.length>0&&<><Text style={ui.section}>Dans tes produits</Text><ProductSuggestions items={locaux.map(productSuggestion)} actionLabel={`Ajouter × ${qty}`} onSelect={id=>{const produit=locaux.find(p=>p.id===id);if(produit)ajouterCatalogue(produit.id,produit.name);}}/></>}
  {!similaires.length&&<Action secondary={session} disabled={busy} onPress={()=>noterLibre(saisie)}>{session?'Noter et en ajouter un autre':`Noter « ${saisie} »`}</Action>}
  {saisie.length>=3&&!resultats&&(similaires.length||session?<Pressable accessibilityRole="button" disabled={busy||off.enRecherche} onPress={search} style={a.lien}><Text style={ui.link}>{off.enRecherche?'Recherche en cours…':`Chercher « ${saisie} » sur Open Food Facts`}</Text></Pressable>:<Action secondary disabled={busy||off.enRecherche} onPress={search}>{off.enRecherche?'Recherche en cours…':`Chercher « ${saisie} » sur Open Food Facts`}</Action>)}
  {busy&&<ActivityIndicator/>}{off.enRecherche&&<View style={ui.sectionRow}><ActivityIndicator/><Text accessibilityLiveRegion="polite" style={ui.detail}>{off.progression}</Text></View>}{!!off.erreur&&<Text accessibilityLiveRegion="polite" style={ui.error}>{off.erreur}</Text>}
  {resultats?.length===0&&!busy&&!off.enRecherche&&!erreur&&!off.erreur&&<Text style={ui.subtitle}>Aucun produit trouvé. Précise le nom ou scanne son code-barres.</Text>}
  <ProductSuggestions items={(resultats??[]).map((f,i)=>({id:`${f.ean13}-${i}`,name:f.name,image:f.imageUrl,brand:f.brand,detail:f.grammageG?`${f.grammageG} g`:f.volumeMl?`${f.volumeMl} ml`:null}))} selectedId={fiche&&resultats?`${fiche.ean13}-${resultats.indexOf(fiche)}`:null} onSelect={id=>setFiche(resultats?.find((f,i)=>`${f.ean13}-${i}`===id)??null)}/>
  {fiche&&<View style={ui.notice}><Text style={ui.productName}>{qty} × {fiche.name}</Text><Text style={ui.detail}>Code-barres : {fiche.ean13||'non renseigné'}</Text><Pressable accessibilityRole="checkbox" accessibilityState={{checked:habituel}} aria-checked={habituel} style={[ui.row,{minHeight:48}]} onPress={()=>setHabituel(!habituel)}><Feather name={habituel?'check-square':'square'} size={20} color={colors.accent}/><Text style={ui.link}>En faire aussi un produit habituel</Text></Pressable><Action disabled={busy||!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(fiche.ean13)} onPress={importer}>Confirmer l’ajout à ma liste</Action></View>}
 </>:<>
  <Text style={ui.detail}>Tape un nom pour le noter, ou scanne son code-barres.</Text>
  {frequents.length>0&&<><Text style={ui.section}>Souvent ajoutés</Text><View style={a.puces}>{frequents.map(f=><Pressable key={f.name} accessibilityRole="button" accessibilityLabel={`Ajouter ${f.name}`} onPress={()=>choisirFrequent(f)} style={({pressed})=>[a.puce,pressed&&{opacity:.7}]}><Feather name="plus" size={16} color={colors.accent}/><Text style={ui.link}>{f.name}</Text></Pressable>)}</View></>}
 </>}
 {!!erreur&&<Text accessibilityLiveRegion="polite" style={ui.error}>{erreur}</Text>}
 {ajoutes.length>0&&<View style={{gap:2,marginTop:4}}><Text accessibilityLiveRegion="polite" style={ui.detail}>Ajouté à ta liste</Text>{ajoutes.map(x=><View key={x.key} style={ui.sectionRow}><View style={[ui.row,{flex:1,gap:8}]}><Feather name="check" size={18} color={colors.accent}/><Text style={a.ajoute}>{x.qty} × {x.name}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${x.name}`} onPress={()=>retirer(x)} style={ui.iconButton}><Text style={ui.link}>Retirer</Text></Pressable></View>)}</View>}
 </ScrollView>{session?<View style={ui.footer}>{annulation.toast}{notable?<Action disabled={busy} onPress={()=>{noterLibre(saisie);revenirAuBilan();}}>{`Noter « ${saisie} » et revenir`}</Action>:<Action onPress={revenirAuBilan}>Revenir au bilan</Action>}</View>:<View style={{marginBottom:insets.bottom+8}}>{annulation.toast}</View>}</SafeAreaView>
}
const a=StyleSheet.create({
 champ:{flex:1,flexDirection:'row',alignItems:'center',gap:8,minHeight:48,paddingHorizontal:14,borderRadius:12,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.traitControle},
 saisie:{flex:1,minHeight:48,fontSize:16,color:colors.text},
 scan:{width:48,height:48,borderRadius:12,borderWidth:1.5,borderColor:colors.accent,alignItems:'center',justifyContent:'center'},
 proche:{flexDirection:'column',alignItems:'stretch',gap:10,borderWidth:1,borderColor:colors.traitControle},
 choix:{flexDirection:'row',gap:8},
 lien:{minHeight:44,alignItems:'center',justifyContent:'center'},
 puces:{flexDirection:'row',flexWrap:'wrap',gap:8},
 puce:{minHeight:44,flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:14,borderRadius:22,borderWidth:1.5,borderColor:colors.accent},
 ajoute:{fontSize:15,color:colors.text,flexShrink:1},
});
