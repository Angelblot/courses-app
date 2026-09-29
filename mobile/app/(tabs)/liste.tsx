import { ProductSuggestions, productSuggestion } from '../../components/ProductSuggestions';
import { doublonsPossibles, manqueActif, manquesAPreciser, manquesDuBrouillon, resumeBilan } from '../../lib/session-courses';
import { rayonDepuisLibelle } from '../../lib/rayons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useMaison } from '../../contexts/useMaison';
import { Action, Head, PiedAvecRetour, Photo, Raison, ui, useAnnulation } from '../../components/MaisonUI';
import { ReglerSheet } from '../../components/ReglerSheet';
import { EnvoiSheet } from '../../components/EnvoiSheet';
import { RAYONS } from '../../lib/rayons';
import { colors } from '../../lib/theme';
import { photoSecours } from '../../lib/photos-maison';
const pluriel=(n:number,mot:string)=>`${n} ${mot}${n>1?'s':''}`;
/**
 * Bilan de la session, ou « Ma liste » hors session. En session, l'écran
 * annonce ce qui est prêt ; la liste détaillée est à un tap (toujours
 * visible sur tablette, en seconde colonne). Rien ne bloque l'envoi sauf une
 * liste vide : un manque noté à la main part tel quel, l'extension le
 * cherche par son nom ; la ligne Manques propose seulement de le préciser.
 */
export default function Liste({session=false}:{session?:boolean}){
 const {w,p,r,lignes,acheter,loading,erreur,stale}=useMaison();
 const {width}=useWindowDimensions(),large=session&&width>=768;
 const [owned,setOwned]=useState(false),[nom,setNom]=useState(''),[ouverte,setOuverte]=useState<string|null>(null),[detail,setDetail]=useState(!session),[regler,setRegler]=useState(false),[envoi,setEnvoi]=useState(false);
 const doublons=doublonsPossibles(acheter,w.doublonsValides,w.distincts),manques=manquesAPreciser(w,p.produits.map(x=>x.id));
 const visibles=lignes.filter(l=>l.owned===owned);
 const points=manques.length+doublons.length;
 const annulation=useAnnulation();
 useEffect(()=>{if(!points)setRegler(false);},[points]);
 const vide=!acheter.length;
 // Seules les lignes qui ont une vraie photo figurent dans la frise du bilan.
 const vignettes=acheter.filter(l=>p.produits.find(x=>x.id===l.product_id)?.image_url||photoSecours(l.name)).slice(0,6);
 // Tout ce qui est noté à la main (manque ou extra) part par son nom.
 const libres=acheter.filter(l=>l.key.startsWith('extra:')&&!l.product_id).length,sources=resumeBilan(w);
 // Les sources se recoupent (un repas et un manque pour le même produit) : on ne les additionne pas.
 const sousTitre=libres?`dont ${pluriel(libres,'produit')} noté${libres>1?'s':''} à la main, envoyé${libres>1?'s':''} tel${libres>1?'s':''} quel${libres>1?'s':''}`:sources.length?`depuis ${sources.length>1?`${sources.slice(0,-1).join(', ')} et ${sources[sources.length-1]}`:sources[0]}`:'';
 const bouton=<Action disabled={vide||loading||!!erreur} onPress={()=>setEnvoi(true)}>Envoyer au drive</Action>;
 const pied=<>{session?<PiedAvecRetour vers="recettes">{bouton}</PiedAvecRetour>:bouton}{vide&&!loading&&!erreur&&<Raison>Ta liste est vide.</Raison>}</>;
 const entete=session?loading&&vide?<View style={[b.hero,{minHeight:68}]} accessible accessibilityLabel="Préparation de ta liste"><ActivityIndicator color={colors.accent}/><Text style={ui.detail}>Préparation de ta liste…</Text></View>:<>
  <View style={b.hero} accessible accessibilityRole="header" accessibilityLabel={`${pluriel(acheter.length,'produit')} ${acheter.length>1?'prêts':'prêt'}. ${sousTitre}`}><Text style={b.nombre}>{acheter.length}</Text><View style={{flex:1}}><Text style={b.pret}>{acheter.length>1?'produits':'produit'} {acheter.length>1?'prêts':'prêt'}</Text><Text style={ui.detail}>{sousTitre}</Text></View></View>
  {vignettes.length>0&&<View style={[ui.row,{gap:0,paddingLeft:6}]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>{vignettes.map((l,i)=><Photo key={l.key} name={l.name} url={p.produits.find(x=>x.id===l.product_id)?.image_url} style={[b.vignette,i>0&&{marginLeft:-10}]}/>)}</View>}
  <Corrections points={points} doublons={doublons.length} aPreciser={manques.map(([,m])=>m.name)} onVerifier={()=>setRegler(true)}/>
  {!large&&<Pressable accessibilityRole="button" accessibilityLabel={detail?'Masquer la liste':'Voir et ajuster la liste'} accessibilityHint="Par rayon, quantités, déjà chez moi" accessibilityState={{expanded:detail}} onPress={()=>setDetail(!detail)} style={({pressed})=>[ui.product,{minHeight:60,paddingLeft:16},pressed&&{opacity:.85}]}><View style={{flex:1}}><Text style={ui.productName}>{detail?'Masquer la liste':'Voir et ajuster la liste'}</Text><Text style={[ui.detail,{marginTop:2}]}>Par rayon, quantités, déjà chez moi</Text></View><Feather name={detail?'chevron-up':'chevron-down'} size={20} color={colors.textMuted}/></Pressable>}
 </>:<><Head title="Ma liste" back/><Text style={ui.subtitle}>{pluriel(acheter.length,'produit')} à acheter</Text></>;
 const statut=<>
 {loading&&<ActivityIndicator color={colors.accent}/>}{erreur&&<><Text style={ui.error}>{erreur}</Text><Action secondary onPress={()=>{p.recharger();r.recharger();}}>Réessayer</Action></>}
 {w.sauvegardeErreur&&<Text style={ui.error}>{w.sauvegardeErreur}</Text>}
 {stale&&!loading&&<View style={ui.notice}><Text style={ui.error}>Une recette de ta liste n’est plus disponible.</Text><Action secondary onPress={()=>Object.keys(w.selectedRecipes).filter(id=>!r.recettes.some(r=>r.id===id)).forEach(id=>w.toggleRecette(id,2))}>Retirer les recettes indisponibles</Action></View>}
 </>;
 const liste=<>
 <View style={ui.row}>{[false,true].map(v=><Pressable key={String(v)} accessibilityRole="tab" accessibilityState={{selected:owned===v}} aria-selected={owned===v} onPress={()=>setOwned(v)} style={{flex:1,minHeight:48,justifyContent:'center',borderBottomWidth:owned===v?3:1,borderBottomColor:owned===v?colors.accent:colors.border}}><Text style={{textAlign:'center',color:owned===v?colors.accent:colors.textMuted,fontWeight:owned===v?'700':'400'}}>{v?'Déjà chez moi':'À acheter'} ({lignes.filter(l=>l.owned===v).length})</Text></Pressable>)}</View>
 {RAYONS.filter(g=>visibles.some(l=>l.rayon===g.cle)).map(g=><View key={g.cle} style={{gap:8}}><Text style={ui.section}>{g.label}</Text>{visibles.filter(l=>l.rayon===g.cle).map(l=>{const produit=p.produits.find(p=>p.id===l.product_id);return <View key={l.key} style={{backgroundColor:'white',borderRadius:12,padding:10,gap:8}}>
 <View style={ui.row}><Photo name={l.name} url={produit?.image_url}/><View style={{flex:1}}><Text style={ui.productName}>{l.name}</Text><Text style={ui.detail}>{[...new Set(l.sources.map(s=>s.label))].join(' · ')}</Text><Text style={ui.detail}>{produit?.grammage_g?`${produit.grammage_g} g`:produit?.volume_ml?`${produit.volume_ml} ml`:l.unit}</Text></View></View>
 <View style={[ui.sectionRow,{flexWrap:'wrap'}]}><Pressable accessibilityRole="button" accessibilityLabel={`${owned?'Remettre à acheter':'Déjà chez moi'} : ${l.name}`} style={{minHeight:44,justifyContent:'center'}} onPress={()=>w.possederLigne(l.key,!l.owned)}><Text style={ui.link}>{owned?'Remettre à acheter':'Déjà chez moi'}</Text></Pressable><View style={ui.counter}><Pressable style={ui.iconButton} accessibilityRole="button" accessibilityLabel={`Diminuer ${l.name}`} onPress={()=>w.modifierLigne(l.key,Math.max(0,l.totalQuantity-1))}><Text style={ui.title}>−</Text></Pressable><Text style={ui.num}>{l.totalQuantity}</Text><Pressable style={ui.iconButton} accessibilityRole="button" accessibilityLabel={`Augmenter ${l.name}`} onPress={()=>w.modifierLigne(l.key,l.totalQuantity+1)}><Text style={ui.title}>+</Text></Pressable></View></View>
 {l.aPreciser&&<View style={ui.notice}><Text style={ui.error}>Conditionnement à préciser : {l.besoin}. Indique le nombre d’articles à acheter, puis confirme.</Text><Action secondary onPress={()=>w.modifierLigne(l.key,l.totalQuantity)}>Confirmer {l.totalQuantity} article{l.totalQuantity>1?'s':''}</Action></View>}
 {l.choixKey&&<><Pressable accessibilityRole="button" accessibilityLabel={`${ouverte===l.key?'Masquer les détails':'Recettes et choix du produit'} : ${l.name}`} accessibilityState={{expanded:ouverte===l.key}} style={{minHeight:44,justifyContent:'center'}} onPress={()=>setOuverte(ouverte===l.key?null:l.key)}><Text style={ui.link}>{ouverte===l.key?'Masquer les détails':'Recettes et choix du produit'}</Text></Pressable>{ouverte===l.key&&<View style={{gap:8}}><Text style={ui.detail}>{l.besoin} · {[...new Set(l.sources.map(s=>s.label))].join(', ')}</Text><ProductSuggestions items={l.candidats.map(productSuggestion)} selectedId={l.product_id} onSelect={id=>w.choisirProduit(l.choixKey!,id)}/>{!l.candidats.length&&<Text style={ui.detail}>Aucun produit associé. Scanne ce produit pour le retrouver dans ton catalogue.</Text>}</View>}</>}
 </View>})}</View>)}
 {!loading&&!erreur&&!visibles.length&&<Text style={ui.subtitle}>{owned?'Les produits que tu possèdes déjà apparaîtront ici.':'Ta liste est vide. Ajoute un favori, un repas ou un produit ci-dessous.'}</Text>}
 {!session&&<><View style={ui.row}><View style={{flex:1}}><Action secondary onPress={()=>router.push('/favoris')}>Mes favoris</Action></View><View style={{flex:1}}><Action secondary onPress={()=>router.push('/recettes')}>Mes repas</Action></View></View>
 <Action secondary onPress={()=>router.push('/ajout')}>Rechercher un produit ou scanner</Action></>}
 {!session&&<><TextInput value={nom} onChangeText={setNom} placeholder="Ajouter un produit à la main…" accessibilityLabel="Nom du produit à ajouter" style={ui.input}/><Action disabled={!nom.trim()} secondary onPress={()=>{w.ajouterExtra({name:nom.trim(),quantity:1,unit:'unité',rayon:'autre'});setNom('');setOwned(false);}}>Ajouter à ma liste</Action>
 <Pressable accessibilityRole="button" style={ui.iconButton} onPress={()=>Alert.alert('Vider cette liste ?','Les recettes et les favoris de ton catalogue seront conservés.',[{text:'Annuler',style:'cancel'},{text:'Vider la liste',style:'destructive',onPress:w.reinitialiser}])}><Text style={ui.detail}>Vider la liste</Text></Pressable></>}
 </>;
 const feuilles=<>
 <ReglerSheet visible={regler} onFermer={()=>setRegler(false)} manques={manques} doublons={doublons} products={p.produits} onRetrait={annulation.proposer} toast={annulation.toast}/>
 <EnvoiSheet visible={envoi} onFermer={()=>setEnvoi(false)}/>
 </>;
 // Tablette : le résumé et l'envoi à gauche, la liste toujours visible à droite.
 if(large)return <SafeAreaView edges={[]} style={ui.screen}><View style={b.colonnes}>
  <ScrollView style={b.gauche} contentContainerStyle={ui.content}>{entete}{statut}<View style={{marginTop:8,gap:8}}>{annulation.toast}{pied}</View></ScrollView>
  <ScrollView style={b.droite} keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}>{liste}</ScrollView>
 </View>{feuilles}</SafeAreaView>;
 return <SafeAreaView edges={session?[]:['top']} style={ui.screen}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}>
 {entete}{statut}{detail&&liste}
 </ScrollView>
 <View>{annulation.toast}<View style={ui.footer}>{pied}</View></View>
 {feuilles}
 </SafeAreaView>
}
const b=StyleSheet.create({
 hero:{flexDirection:'row',alignItems:'center',gap:14,marginTop:4},
 nombre:{fontSize:64,fontWeight:'700',letterSpacing:-2,color:colors.accent,lineHeight:68,fontVariant:['tabular-nums']},
 pret:{fontSize:22,fontWeight:'700',color:colors.text,letterSpacing:-.4},
 vignette:{width:40,height:40,borderRadius:20,borderWidth:2,borderColor:colors.bg,backgroundColor:colors.surface},
 colonnes:{flex:1,flexDirection:'row',gap:8},
 gauche:{flex:1,maxWidth:460},
 droite:{flex:1.3,borderLeftWidth:1,borderLeftColor:colors.border},
 correction:{flexDirection:'row',alignItems:'center',gap:12,minHeight:60,paddingHorizontal:12,paddingVertical:8,borderRadius:12,backgroundColor:colors.surface},
 rappel:{backgroundColor:colors.bg,borderWidth:1.5,borderColor:colors.traitControle},
 icone:{width:30,height:30,borderRadius:15,backgroundColor:colors.accentSoft,alignItems:'center',justifyContent:'center'},
 iconeVide:{backgroundColor:'transparent',borderWidth:1.5,borderColor:colors.traitControle},
});

type EtatCorrection='ok'|'attention'|'rappel'|'ajout';
/** Une correction ouverte depuis le bilan : son état en une ligne, et l'écran qu'on connaît. */
function LigneCorrection({etat,titre,detail,action,onPress}:{etat:EtatCorrection;titre:string;detail:string;action?:string;onPress:()=>void}){
 return <Pressable accessibilityRole="button" accessibilityLabel={`${titre} : ${detail}${action?`. ${action}`:''}`} onPress={onPress} style={({pressed})=>[b.correction,etat==='rappel'&&b.rappel,pressed&&{opacity:.85}]}>
  <View style={[b.icone,etat==='attention'&&{backgroundColor:colors.attentionSoft},etat==='rappel'&&b.iconeVide]}>{etat==='ok'?<Feather name="check" size={16} color={colors.accent}/>:etat==='attention'?<Feather name="alert-circle" size={16} color={colors.attentionText}/>:etat==='ajout'?<Feather name="plus" size={16} color={colors.accent}/>:null}</View>
  <View style={{flex:1}}><Text style={ui.productName}>{titre}</Text><Text style={[ui.detail,{marginTop:1}]}>{detail}</Text></View>
  {action?<Text style={ui.link}>{action}</Text>:<Feather name="chevron-right" size={18} color={colors.textMuted}/>}
 </Pressable>;
}
/**
 * Manques, Habitudes, Extras : plus des étapes, des corrections. Rien ne
 * bloque l'envoi ; ce qui n'a pas été vu est seulement rappelé.
 */
function Corrections({points,doublons,aPreciser,onVerifier}:{points:number;doublons:number;aPreciser:string[];onVerifier:()=>void}){
 const {w,p}=useMaison();
 const manques=Object.entries(manquesDuBrouillon(w)).filter(([key])=>manqueActif(w,key));
 const pending=manquesAPreciser(w,p.produits.map(x=>x.id)).length,prets=manques.length-pending;
 const favoris=p.produits.filter(x=>x.favorite&&rayonDepuisLibelle(x.category)&&!manques.some(([k])=>k===`produit:${x.id}`));
 const vus=favoris.filter(x=>w.habitudesVues?.[x.id]),retenues=vus.filter(x=>w.quotidien[x.id]==='needed').length;
 // Un rayon est revu quand tous ses produits l'ont été ; tant qu'il en reste, la ligne rappelle au lieu de valider.
 const rayons=[...new Set(favoris.map(x=>rayonDepuisLibelle(x.category)))],revus=rayons.filter(r=>favoris.filter(x=>rayonDepuisLibelle(x.category)===r).every(x=>w.habitudesVues?.[x.id])).length;
 const extras=w.extras.filter(x=>!manques.some(([k])=>k===`extra:${x.id}`)&&w.ligneQuantites[`extra:${x.id}`]!==0).length;
 const repas=Object.keys(w.selectedRecipes).length;
 const ouvrir=(cle:string)=>router.push(`/wizard/${cle}`);
 const pl=(n:number,mot:string)=>`${n} ${mot}${n>1?'s':''}`;
 return <View style={{gap:8}}>
  {!repas&&<LigneCorrection etat="rappel" titre="Repas" detail="Aucun repas choisi cette fois" action="Choisir" onPress={()=>router.dismissTo('/wizard/recettes')}/>}
  {/* Ce qui peut être précisé passe par la ligne Manques, qui ouvre la feuille ; rien ne bloque l'envoi. */}
  {points?<LigneCorrection etat="attention" titre="Manques" detail={[`${pl(prets,'prêt')}`,aPreciser.length===1?`« ${aPreciser[0]} » : l’extension cherchera ce nom`:aPreciser.length?`${aPreciser.length} produits cherchés par leur nom`:'',doublons?`${doublons} doublon${doublons>1?'s':''} possible${doublons>1?'s':''}`:''].filter(Boolean).join(' · ')} action="Préciser" onPress={onVerifier}/>
  :<LigneCorrection etat={manques.length?'ok':'ajout'} titre="Manques" detail={manques.length?pl(prets,'prêt'):'Rien de noté'} onPress={()=>ouvrir('manques')}/>}
  {favoris.length>0&&(!vus.length?<LigneCorrection etat="rappel" titre="Habitudes" detail={`Pas encore revues · ${pl(favoris.length,'produit')}`} action="Revoir" onPress={()=>ouvrir('habitudes')}/>
   :revus<rayons.length?<LigneCorrection etat="rappel" titre="Habitudes" detail={`${revus} rayon${revus>1?'s':''} sur ${rayons.length} revu${revus>1?'s':''} · ${pl(retenues,'retenu')}`} action="Continuer" onPress={()=>ouvrir('habitudes')}/>
   :<LigneCorrection etat="ok" titre="Habitudes" detail={`${pl(retenues,'retenu')} sur ${favoris.length}`} onPress={()=>ouvrir('habitudes')}/>)}
  <LigneCorrection etat="ajout" titre="Extras" detail={extras?pl(extras,'ajouté'):'Un produit hors habitudes'} onPress={()=>ouvrir('exceptions')}/>
 </View>;
}
