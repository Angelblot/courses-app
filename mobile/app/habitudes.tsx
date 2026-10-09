import { instantaneHabitude, manqueActif, type InstantaneHabitude } from '../lib/session-courses';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../lib/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { router, useFocusEffect } from 'expo-router';
import { BasDeLEcran, Head, Photo, Action, ui, useAnnulation } from '../components/MaisonUI';
import { appuiLongFiche } from '../components/FicheAppuiLong';
import { revenirAuBilan } from '../components/SessionProgress';
import { useProducts } from '../stores/products';
import { useWizard } from '../contexts/WizardContext';
import { RAYONS, rayonDepuisLibelle } from '../lib/rayons';
import { nombreArticles } from '../lib/ajouts-quotidiens';
import { references } from '../lib/references';
import { useMaison } from '../contexts/useMaison';
import type { LigneMaison } from '../lib/liste-maison';
/**
 * Habitudes : une liste à cocher par rayon. On touche ce qu'il faut acheter ;
 * le reste du rayon est considéré comme déjà à la maison quand on passe au
 * rayon suivant. Un rayon se passe en un geste, même avec beaucoup de produits.
 */
export default function Habitudes({session=false}:{session?:boolean}){
 const p=useProducts(),w=useWizard(),{lignes,loading:chargeListe,r:rec}=useMaison();
 // Rayons ouverts : un rayon sans habitude (seulement des lignes notées) n'est revu qu'une fois vu.
 const [ouverts,setOuverts]=useState<string[]>([]);useFocusEffect(useCallback(()=>{p.recharger();},[p.recharger]));
 // Tout produit de « Mes produits » est une habitude ; une alternative vit sous sa référence.
 const habitudes=references(p.produits);
 // La ligne de liste d'un produit : la part des repas s'y lit, et l'on ajoute en plus.
 const ligneDe=(id:string)=>lignes.find(l=>l.key===`produit:${id}`);
 const repasDe=(id:string)=>ligneDe(id)?.quantiteRepas??0;
 // En session, Habitudes est la vue de toute la liste : les lignes sans habitude du rayon (extras, ingrédients, manques) y figurent aussi.
 const autresDe=(cle:string)=>session?lignes.filter(l=>l.rayon===cle&&!(l.product_id&&habitudes.some(x=>x.id===l.product_id&&!(w.manques?.[`produit:${x.id}`]&&manqueActif(w,`produit:${x.id}`))))):[];
 const categories=RAYONS.filter(c=>habitudes.some(p=>rayonDepuisLibelle(p.category)===c.cle)||autresDe(c.cle).length>0);
 const [rayon,setRayon]=useState('');
 const cat=categories.find(c=>c.cle===rayon)??categories[0];
 const itemsDe=(cle:string)=>habitudes.filter(x=>rayonDepuisLibelle(x.category)===cle&&!(session&&w.manques?.[`produit:${x.id}`]&&manqueActif(w,`produit:${x.id}`)));
 const items=cat?itemsDe(cat.cle):[];
 const fini=(cle:string)=>{const l=itemsDe(cle);return l.length>0?l.every(x=>w.habitudesVues?.[x.id]):autresDe(cle).length>0&&ouverts.includes(cle);};
 const autres=cat?autresDe(cat.cle):[];
 // Un produit pris par les repas ne se décide pas comme une habitude : sa ligne porte la quantité.
 const parRepas=(id:string)=>repasDe(id)>0;
 const annulation=useAnnulation();
 // Cocher, c'est ajouter à la liste tout de suite ; décocher, c'est « déjà
 // chez moi ». « Rayon suivant » ne fait que classer le reste du rayon.
 const choix:Record<string,number>=Object.fromEntries(items.filter(x=>!parRepas(x.id)&&w.quotidien[x.id]==='needed'&&!w.lignePossedees[`produit:${x.id}`]).map(x=>[x.id,nombreArticles(w.quotidienQty[x.id]??1)]));
 const basculer=(id:string)=>w.deciderHabituel(id,nombreArticles(w.quotidienQty[id]??1),!(id in choix));
 const quantite=(id:string,n:number)=>w.deciderHabituel(id,nombreArticles(n),true);
 // Rayon suivant encore à passer, sinon le premier resté en arrière.
 const index=categories.findIndex(c=>c.cle===cat?.cle),aPasser=categories.filter(c=>c.cle!==cat?.cle&&!fini(c.cle));
 const suivant=aPasser.find(c=>categories.indexOf(c)>index)??aPasser[0];
 // En session, les habitudes sont une correction du bilan : on y revient.
 const terminer=()=>session?revenirAuBilan():router.push('/liste');
 const allerA=(cle:string)=>{setRayon(cle);annulation.effacer();};
 useEffect(()=>{if(cat&&!ouverts.includes(cat.cle))setOuverts(o=>[...o,cat.cle]);},[cat?.cle]);
 // Glisser sur la liste passe au rayon voisin, comme toucher sa pastille ; la pastille active reste en vue.
 const pastilles=useRef<ScrollView>(null),positions=useRef<Record<string,number>>({});
 useEffect(()=>{const x=cat?positions.current[cat.cle]:undefined;if(x!=null)pastilles.current?.scrollTo({x:Math.max(0,x-20),animated:true});},[cat?.cle]);
 const voisin=(pas:number)=>{const c=categories[index+pas];if(c)allerA(c.cle);};
 const glisser=Gesture.Pan().runOnJS(true).activeOffsetX([-24,24]).failOffsetY([-14,14])
  .onEnd(e=>{if(Math.abs(e.translationX)<60&&Math.abs(e.velocityX)<600)return;voisin(e.translationX<0?1:-1);});
 const retenus=items.filter(x=>x.id in choix||(parRepas(x.id)&&!ligneDe(x.id)?.owned)).length+autres.filter(l=>!l.owned).length;
 function valider(){
  // Tant que les repas se chargent, leur part est inconnue : on ne classe rien.
  if(chargeListe)return;
  if(cat&&items.length){
   const habituels=items.filter(x=>!parRepas(x.id));
   const avant:Record<string,InstantaneHabitude>=Object.fromEntries(habituels.map(x=>[x.id,instantaneHabitude(w,x.id)]));
   habituels.forEach(x=>w.deciderHabituel(x.id,choix[x.id]??1,x.id in choix));
   // Ceux des repas gardent leur ligne telle quelle : ils sont seulement vus.
   w.marquerVues(items.filter(x=>parRepas(x.id)).map(x=>x.id));
   // Le toast ne vaut que si l'on reste ici ; après le dernier rayon, le
   // retour du pied rouvre la liste, qui reflète les choix faits.
   if(!suivant){terminer();return;}
   allerA(suivant.cle);
   const gardes=habituels.filter(x=>x.id in choix).length;
   annulation.proposer(`${cat.label} : ${gardes} habitude${gardes>1?'s':''} retenue${gardes>1?'s':''}`,()=>{habituels.forEach(x=>w.annulerHabituel(x.id,avant[x.id]));setRayon(cat.cle);});
  }else if(suivant)allerA(suivant.cle);else terminer();
 }

 // Une habitude du rayon (sans repas) : cocher l'ajoute, la quantité se règle sur place.
 const ligneHabitude=(x:(typeof items)[number])=>{
  const pris=x.id in choix,q=choix[x.id]??1,detail=[x.brand,x.grammage_g?`${x.grammage_g} g`:x.volume_ml?`${x.volume_ml} ml`:null].filter(Boolean).join(' · ');return <View key={x.id} style={[h.ligne,pris&&h.ligneOn]}>
  <Pressable accessibilityRole="checkbox" accessibilityState={{checked:pris}} aria-checked={pris} accessibilityLabel={x.name} onPress={()=>basculer(x.id)} {...appuiLongFiche(x)} style={[ui.row,{flex:1,minHeight:52}]}>
   <Photo name={x.name} url={x.image_url} style={h.photo}/>
   <View style={{flex:1}}><Text style={ui.productName}>{x.name}</Text>{!!detail&&<Text style={[ui.detail,{marginTop:1}]}>{detail}</Text>}</View>
   {!pris&&<View style={h.case}/>}
  </Pressable>
  {pris&&<View style={[ui.row,{gap:4}]}><View style={ui.counter}><Pressable accessibilityRole="button" accessibilityLabel={`Diminuer ${x.name}`} style={ui.iconButton} onPress={()=>q>1?quantite(x.id,q-1):basculer(x.id)}><Text style={ui.title}>−</Text></Pressable><Text style={ui.num}>{q}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Augmenter ${x.name}`} style={ui.iconButton} onPress={()=>quantite(x.id,q+1)}><Text style={ui.title}>+</Text></Pressable></View><Pressable accessibilityRole="button" accessibilityLabel={`Ne plus acheter ${x.name}`} onPress={()=>basculer(x.id)} style={h.cible}><View style={[h.case,h.caseOn]}><Feather name="check" size={16} color={colors.accentContrast}/></View></Pressable></View>}
 </View>;
 };

 // Les produits des repas, groupés par recette (la première qui les demande), en tête du rayon.
 const recetteDe=(l?:LigneMaison)=>l?.sources.find(x=>x.type==='recipe')?.label??'';
 const repasDuRayon=[
  ...items.filter(x=>parRepas(x.id)).map(x=>({cle:x.id,recette:recetteDe(ligneDe(x.id)),el:<LigneRepas key={x.id} dansCarte recette={recetteDe(ligneDe(x.id))} ligne={ligneDe(x.id)!} nom={x.name} image={x.image_url} appui={appuiLongFiche(x)} onVue={()=>w.marquerVues([x.id])}/>})),
  ...autres.filter(l=>(l.quantiteRepas??0)>0).map(l=>({cle:l.key,recette:recetteDe(l),el:<LigneRepas key={l.key} dansCarte recette={recetteDe(l)} ligne={l} nom={l.name} image={p.produits.find(x=>x.id===l.product_id)?.image_url}/>})),
 ];
 const groupesRepas=[...new Set(repasDuRayon.map(x=>x.recette))].map(nom=>{const recette=rec.recettes.find(x=>x.name===nom&&!!w.selectedRecipes[x.id])??rec.recettes.find(x=>x.name===nom);
  return {recette:nom,image:recette?.image_url??null,parts:recette?w.selectedRecipes[recette.id]??0:0,lignes:repasDuRayon.filter(x=>x.recette===nom).map(x=>x.el)};});
 // Le reste du rayon, par ordre alphabétique.
 const habituelles=[...items.filter(x=>!parRepas(x.id)).map(x=>({nom:x.name,el:ligneHabitude(x)})),
  ...autres.filter(l=>!((l.quantiteRepas??0)>0)).map(l=>({nom:l.name,el:<LigneRepas key={l.key} ligne={l} nom={l.name} image={p.produits.find(x=>x.id===l.product_id)?.image_url}/>}))]
  .sort((a,b)=>a.nom.localeCompare(b.nom,'fr'));
 const libelle=`${suivant?'Rayon suivant':session?'Revenir au bilan':'Vérifier ma liste'}${retenus?` · ${retenus} retenu${retenus>1?'s':''}`:''}`;
 return <SafeAreaView edges={session?[]:['top']} style={ui.screen}><View style={{paddingHorizontal:20,paddingTop:session?4:20,paddingBottom:4}}><Head title={session?'Habitudes et liste':'Mes habitudes'} back={!session} avatar={!session}/></View>
 <View><ScrollView ref={pastilles} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingHorizontal:20,paddingTop:session?8:0,paddingBottom:8}}>{categories.map(c=>{const actif=cat?.cle===c.cle,ok=fini(c.cle)&&!actif;return <Pressable key={c.cle} onLayout={e=>{positions.current[c.cle]=e.nativeEvent.layout.x;}} accessibilityRole="tab" accessibilityState={{selected:actif}} aria-selected={actif} accessibilityLabel={`${c.label}${ok?', passé en revue':''}`} onPress={()=>allerA(c.cle)} style={[h.rayon,actif&&{backgroundColor:colors.accent,borderColor:colors.accent}]}>{ok&&<Feather name="check" size={15} color={colors.accent}/>}<Text style={{color:actif?colors.accentContrast:colors.accent,fontWeight:'600'}}>{c.label}</Text></Pressable>;})}</ScrollView></View>
 <GestureDetector gesture={glisser}><ScrollView contentContainerStyle={[ui.content,{paddingTop:4,gap:8,flexGrow:1}]}>
 {p.chargement&&!p.produits.length&&<ActivityIndicator/>}{p.erreur&&<><Text style={ui.error}>{p.erreur}</Text><Action secondary onPress={p.recharger}>Réessayer</Action></>}
 {cat&&(items.length>0||autres.length>0)&&<Text style={ui.detail}>{groupesRepas.length>0?'Les repas sont déjà comptés. Décoche ce que tu as déjà, coche tes habitudes.':'Touche ce qu’il te faut. Le reste est considéré comme déjà chez toi.'}</Text>}
 {/* Variante B validée : une carte par recette, ses produits du rayon dedans ; puis les habitudes de A à Z. */}
 {groupesRepas.map(g=><CarteRecette key={g.recette} nom={g.recette} image={g.image} parts={g.parts}>{g.lignes}</CarteRecette>)}
 {habituelles.length>0&&groupesRepas.length>0&&<Text style={h.sectionHab} accessibilityRole="header">{session?'Le reste du rayon · A → Z':'Tes habitudes · A → Z'}</Text>}
 {habituelles.map(x=>x.el)}
 {cat&&!items.length&&!autres.length&&!p.chargement&&<Text style={ui.subtitle}>Rien à passer en revue dans ce rayon : ses produits sont déjà dans tes manques.</Text>}
 {!cat&&!p.chargement&&!p.erreur&&<><Text style={ui.heading}>Tes habitudes commencent ici.</Text><Text style={ui.subtitle}>Enregistre tes produits préférés avec le scanner.</Text><Action secondary onPress={()=>router.push('/scan')}>Scanner un premier favori</Action></>}
 </ScrollView></GestureDetector>
 <View style={ui.footer}>{annulation.toastPied}<Action disabled={chargeListe} onPress={valider}>{libelle}</Action></View>{!session&&<BasDeLEcran/>}</SafeAreaView>
}
/**
 * Une ligne de la liste dans Habitudes : un produit pris par les repas (sa
 * part est dite, « + » ajoute en plus) ou une ligne sans habitude du rayon
 * (noté, ingrédient). Cocher : dans la liste ; décocher : déjà chez moi.
 */
function LigneRepas({ligne,nom,image,appui,onVue,dansCarte=false,recette}:{ligne:LigneMaison;nom:string;image:string|null|undefined;appui?:object;onVue?:()=>void;
 /** Dans la carte de sa recette : la recette est déjà dite, seules les autres le sont. */
 dansCarte?:boolean;recette?:string}){
 const w=useWizard(),pris=!ligne.owned,total=ligne.totalQuantity,repas=ligne.quantiteRepas??0;
 // Un produit des repas : le « en plus » est retenu à part, la part des repas suit les recettes.
 const produitRepas=repas>0&&!!ligne.product_id,plus=produitRepas?w.enPlus?.[ligne.product_id!]??0:Math.max(0,total-repas);
 const recettes=[...new Set(ligne.sources.filter(x=>x.type==='recipe').map(x=>x.label))].join(', ');
 const autresRecettes=[...new Set(ligne.sources.filter(x=>x.type==='recipe').map(x=>x.label))].filter(x=>x!==recette);
 const origine=dansCarte?(autresRecettes.length?`Aussi pour ${autresRecettes.join(', ')}`:''):repas?`Repas : ${repas} · ${recettes}`:[...new Set(ligne.sources.map(x=>x.label))].join(' · ');
 const basculer=()=>{w.possederLigne(ligne.key,pris);onVue?.();};
 const changer=(n:number)=>{if(produitRepas)w.ajouterEnPlus(ligne.product_id!,n-repas);else w.modifierLigne(ligne.key,n);onVue?.();};
 // Au plancher des repas, « − » ne retire rien : on décoche pour dire « déjà chez moi ».
 const plancher=Math.max(1,repas),auPlancher=total<=plancher;
 const compteur=<View style={ui.counter}>
  <Pressable accessibilityRole="button" accessibilityLabel={`Diminuer ${nom}`} accessibilityState={{disabled:auPlancher}} disabled={auPlancher} style={[ui.iconButton,auPlancher&&{opacity:.35}]} onPress={()=>changer(total-1)}><Text style={ui.title}>−</Text></Pressable>
  <View style={{alignItems:'center',minWidth:dansCarte?28:36}}><Text style={ui.num}>{total}</Text>{!dansCarte&&repas>0&&plus>0&&<Text style={h.decompte}>{repas} repas + {plus}</Text>}</View>
  <Pressable accessibilityRole="button" accessibilityLabel={`Augmenter ${nom}${repas?`, en plus des ${repas} pour les repas`:''}`} style={ui.iconButton} onPress={()=>changer(total+1)}><Text style={ui.title}>+</Text></Pressable>
 </View>;
 // Dans une carte sans autre recette à citer : une seule ligne, nom, compteur et case.
 if(dansCarte&&!origine)return <View style={[h.ligneCarte,h.ligneCarteCompacte]}>
  <Pressable accessibilityRole="checkbox" accessibilityState={{checked:pris}} aria-checked={pris} accessibilityLabel={`${nom}, pour cette recette${plus>0?`, ${plus} en plus des repas`:''}`} onPress={basculer} {...appui} style={[ui.row,{flex:1,minHeight:52,gap:8}]}>
   <Photo name={nom} url={image} style={h.photoCarte}/>
   <View style={{flex:1}}><Text style={ui.productName} numberOfLines={2}>{nom}</Text>{pris&&plus>0&&<Text style={h.enPlus}>+{plus} en plus des repas</Text>}</View>
  </Pressable>
  {pris&&compteur}
  <Pressable accessibilityElementsHidden importantForAccessibility="no-hide-descendants" onPress={basculer} style={h.cible}><View style={[h.case,pris&&h.caseOn]}>{pris&&<Feather name="check" size={16} color={colors.accentContrast}/>}</View></Pressable>
 </View>;
 // Deux étages : le nom en entier en haut, la part des repas et le compteur dessous.
 return <View style={dansCarte?h.ligneCarte:[h.ligneRepas,pris&&h.ligneOn]}>
  <Pressable accessibilityRole="checkbox" accessibilityState={{checked:pris}} aria-checked={pris} accessibilityLabel={`${nom}. ${origine}`} onPress={basculer} {...appui} style={[ui.row,{minHeight:52}]}>
   <Photo name={nom} url={image} style={h.photo}/>
   <View style={{flex:1}}><Text style={ui.productName} numberOfLines={2}>{nom}</Text>{!pris&&!!origine&&<Text style={[ui.detail,{marginTop:1},repas>0&&!dansCarte&&h.repas]} numberOfLines={2}>{origine}</Text>}</View>
   <View style={[h.case,pris&&h.caseOn]}>{pris&&<Feather name="check" size={16} color={colors.accentContrast}/>}</View>
  </Pressable>
  {pris&&<View style={h.dessous}>
   <Text style={[ui.detail,{flex:1,marginTop:0},repas>0&&!dansCarte&&h.repas]} numberOfLines={2}>{origine}</Text>
   {compteur}
  </View>}
 </View>;
}
/** La carte d'une recette : son visuel, pour combien, et ses produits de ce rayon. */
function CarteRecette({nom,image,parts,children}:{nom:string;image:string|null;parts:number;children:ReactNode}){
 const n=Array.isArray(children)?children.length:1;
 return <View style={h.carte}>
  <View style={h.carteTete} accessible accessibilityRole="header" accessibilityLabel={`${nom}, ${parts?`${parts} personne${parts>1?'s':''}, `:''}${n} produit${n>1?'s':''} dans ce rayon`}>
   <Photo name={nom} url={image} style={h.carteVisuel}/>
   <View style={{flex:1}}><Text style={h.carteNom} numberOfLines={2}>{nom}</Text><Text style={[ui.detail,{marginTop:1}]}>{[parts?`${parts} personne${parts>1?'s':''}`:null,`${n} produit${n>1?'s':''} dans ce rayon`].filter(Boolean).join(' · ')}</Text></View>
  </View>
  {children}
 </View>;
}
const h=StyleSheet.create({
 carte:{backgroundColor:colors.surface,borderRadius:16,overflow:'hidden',borderWidth:1,borderColor:colors.border},
 carteTete:{flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:12,paddingVertical:10,backgroundColor:colors.accentSoft},
 carteVisuel:{width:40,height:40,borderRadius:10},
 carteNom:{fontSize:15,fontWeight:'700',color:colors.text},
 ligneCarteCompacte:{flexDirection:'row',alignItems:'center',gap:6},
 ligneCarte:{paddingLeft:6,paddingRight:10,paddingVertical:4,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.border,gap:2},
 sectionHab:{fontSize:12,fontWeight:'700',letterSpacing:.5,color:colors.textMuted,textTransform:'uppercase',marginTop:16},
 repas:{color:colors.accent,fontWeight:'600'},
 ligneRepas:{backgroundColor:colors.surface,borderRadius:12,paddingLeft:6,paddingRight:10,paddingVertical:4,borderWidth:1,borderColor:colors.surface,gap:2},
 dessous:{flexDirection:'row',alignItems:'center',gap:8,paddingLeft:52,paddingBottom:6},
 decompte:{fontSize:11,color:colors.textMuted,fontVariant:['tabular-nums']},
 rayon:{minHeight:44,flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:14,borderRadius:22,backgroundColor:colors.accentSoft,borderWidth:1,borderColor:colors.traitControle},
 ligne:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:colors.surface,borderRadius:12,paddingLeft:6,paddingRight:10,borderWidth:1,borderColor:colors.surface},
 ligneOn:{borderColor:colors.accent},
 photo:{width:44,height:44,borderRadius:8},
 photoCarte:{width:40,height:40,borderRadius:8},
 enPlus:{fontSize:12,fontWeight:'600',color:colors.accent,marginTop:1},
 case:{width:30,height:30,borderRadius:15,borderWidth:1.5,borderColor:colors.traitControle,alignItems:'center',justifyContent:'center'},
 cible:{width:44,height:44,alignItems:'center',justifyContent:'center'},
 caseOn:{backgroundColor:colors.accent,borderColor:colors.accent},
});
