import { ProductSuggestions, productSuggestion } from '../../components/ProductSuggestions';
import { doublonsPossibles, manquesAPreciser, resumeBilan } from '../../lib/session-courses';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
 * annonce ce qui est prêt ; la liste détaillée est à un tap, et ce qui
 * bloque le drive se règle dans une feuille du bas, sans quitter l'écran.
 */
export default function Liste({session=false}:{session?:boolean}){
 const {w,p,r,lignes,acheter,loading,erreur,stale}=useMaison();
 const [owned,setOwned]=useState(false),[nom,setNom]=useState(''),[ouverte,setOuverte]=useState<string|null>(null),[detail,setDetail]=useState(!session),[regler,setRegler]=useState(false),[envoi,setEnvoi]=useState(false);
 const doublons=doublonsPossibles(acheter,w.doublonsValides),manques=manquesAPreciser(w,p.produits.map(x=>x.id));
 const visibles=lignes.filter(l=>l.owned===owned);
 const aPreciser=acheter.filter(l=>l.aPreciser).length,points=manques.length+doublons.length;
 const annulation=useAnnulation();
 useEffect(()=>{if(!points)setRegler(false);},[points]);
 // Ce qui bloque l'envoi au drive, dit sous le bouton avec le geste qui le débloque.
 const blocage=!acheter.length?{texte:'Ta liste est vide.'}
  :stale?{texte:'Une recette de ta liste n’est plus disponible.'}
  :points?{texte:`${pluriel(points,'chose')} à vérifier.`,action:'Vérifier',onPress:()=>setRegler(true)}
  :aPreciser?{texte:`${pluriel(aPreciser,'conditionnement')} à préciser dans la liste.`,action:'Voir',onPress:()=>setDetail(true)}
  :null;
 // Seules les lignes qui ont une vraie photo figurent dans la frise du bilan.
 const vignettes=acheter.filter(l=>p.produits.find(x=>x.id===l.product_id)?.image_url||photoSecours(l.name)).slice(0,6);
 const detailPoints=[manques.length&&pluriel(manques.length,'manque'),doublons.length&&pluriel(doublons.length,'doublon')].filter(Boolean).join(', ');
 return <SafeAreaView edges={session?[]:['top']} style={ui.screen}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}>
 {session?loading&&!acheter.length?<View style={[b.hero,{minHeight:68}]} accessible accessibilityLabel="Préparation de ta liste"><ActivityIndicator color={colors.accent}/><Text style={ui.detail}>Préparation de ta liste…</Text></View>:<>
  <View style={b.hero} accessible accessibilityRole="header" accessibilityLabel={`${pluriel(acheter.length,'article')} ${blocage?'à acheter':acheter.length>1?'prêts':'prêt'}. ${resumeBilan(w).join(', ')}`}><Text style={b.nombre}>{acheter.length}</Text><View style={{flex:1}}><Text style={b.pret}>{acheter.length>1?'articles':'article'} {blocage?'à acheter':acheter.length>1?'prêts':'prêt'}</Text><Text style={ui.detail}>{resumeBilan(w).join(' · ')}</Text></View></View>
  {vignettes.length>0&&<View style={[ui.row,{gap:0,paddingLeft:6}]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>{vignettes.map((l,i)=><Photo key={l.key} name={l.name} url={p.produits.find(x=>x.id===l.product_id)?.image_url} style={[b.vignette,i>0&&{marginLeft:-10}]}/>)}</View>}
  <Pressable accessibilityRole="button" accessibilityLabel={detail?'Masquer la liste':'Voir et ajuster la liste'} accessibilityHint="Par rayon, quantités, déjà chez moi" accessibilityState={{expanded:detail}} onPress={()=>setDetail(!detail)} style={({pressed})=>[ui.product,{minHeight:60,paddingLeft:16},pressed&&{opacity:.85}]}><View style={{flex:1}}><Text style={ui.productName}>{detail?'Masquer la liste':'Voir et ajuster la liste'}</Text><Text style={[ui.detail,{marginTop:2}]}>Par rayon, quantités, déjà chez moi</Text></View><Feather name={detail?'chevron-up':'chevron-down'} size={20} color={colors.textMuted}/></Pressable>
 </>:<><Head title="Ma liste" back/><Text style={ui.subtitle}>{pluriel(acheter.length,'article')} à acheter</Text></>}
 {loading&&<ActivityIndicator color={colors.accent}/>}{erreur&&<><Text style={ui.error}>{erreur}</Text><Action secondary onPress={()=>{p.recharger();r.recharger();}}>Réessayer</Action></>}
 {w.sauvegardeErreur&&<Text style={ui.error}>{w.sauvegardeErreur}</Text>}
 {stale&&!loading&&<View style={ui.notice}><Text style={ui.error}>Une recette de ta liste n’est plus disponible.</Text><Action secondary onPress={()=>Object.keys(w.selectedRecipes).filter(id=>!r.recettes.some(r=>r.id===id)).forEach(id=>w.toggleRecette(id,2))}>Retirer les recettes indisponibles</Action></View>}
 {detail&&<>
 <View style={ui.row}>{[false,true].map(v=><Pressable key={String(v)} accessibilityRole="tab" accessibilityState={{selected:owned===v}} onPress={()=>setOwned(v)} style={{flex:1,minHeight:48,justifyContent:'center',borderBottomWidth:owned===v?3:1,borderBottomColor:owned===v?colors.accent:colors.border}}><Text style={{textAlign:'center',color:owned===v?colors.accent:colors.textMuted,fontWeight:owned===v?'700':'400'}}>{v?'Déjà chez moi':'À acheter'} ({lignes.filter(l=>l.owned===v).length})</Text></Pressable>)}</View>
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
 </>}
 </ScrollView>
 <View>{annulation.toast}
 {points>0&&!loading&&<Pressable accessibilityRole="button" accessibilityLabel={`${pluriel(points,'chose')} à vérifier : ${detailPoints}. Vérifier`} onPress={()=>setRegler(true)} style={({pressed})=>[b.bandeau,pressed&&{opacity:.9}]}><Text style={b.bandeauTexte}><Text style={{fontWeight:'700'}}>{pluriel(points,'chose')} à vérifier</Text> · {detailPoints}</Text><Text style={[b.bandeauTexte,{fontWeight:'700'}]}>Vérifier</Text></Pressable>}
 <View style={ui.footer}>{session?<PiedAvecRetour vers="exceptions"><Action disabled={!!blocage||loading||!!erreur} onPress={()=>setEnvoi(true)}>Choisir mon drive</Action></PiedAvecRetour>:<Action disabled={!!blocage||loading||!!erreur} onPress={()=>setEnvoi(true)}>Choisir mon drive</Action>}{!!blocage&&!points&&!loading&&!erreur&&<Raison action={blocage.action} onPress={blocage.onPress}>{blocage.texte}</Raison>}</View></View>
 <ReglerSheet visible={regler} onFermer={()=>setRegler(false)} manques={manques} doublons={doublons} products={p.produits} onRetrait={annulation.proposer} toast={annulation.toast}/>
 <EnvoiSheet visible={envoi} onFermer={()=>setEnvoi(false)}/>
 </SafeAreaView>
}
const b=StyleSheet.create({
 hero:{flexDirection:'row',alignItems:'center',gap:14,marginTop:4},
 nombre:{fontSize:64,fontWeight:'700',letterSpacing:-2,color:colors.accent,lineHeight:68,fontVariant:['tabular-nums']},
 pret:{fontSize:22,fontWeight:'700',color:colors.text,letterSpacing:-.4},
 vignette:{width:40,height:40,borderRadius:20,borderWidth:2,borderColor:colors.bg,backgroundColor:colors.surface},
 bandeau:{marginHorizontal:12,marginBottom:8,borderRadius:14,backgroundColor:colors.attentionText,minHeight:48,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},
 bandeauTexte:{color:colors.accentContrast,fontSize:14,flexShrink:1},
});
