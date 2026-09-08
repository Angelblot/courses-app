import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useMaison } from '../../contexts/useMaison';
import { Action, Head, Photo, ui } from '../../components/MaisonUI';
import { RAYONS } from '../../lib/rayons';
import { colors } from '../../lib/theme';
export default function Liste(){
 const {w,p,r,lignes,acheter,loading,erreur,stale}=useMaison();
 const [owned,setOwned]=useState(false),[nom,setNom]=useState(''),[ouverte,setOuverte]=useState<string|null>(null);
 const visibles=lignes.filter(l=>l.owned===owned);
 return <SafeAreaView edges={['top']} style={ui.screen}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}>
 <Head title="Ma liste" back/><Text style={ui.subtitle}>{acheter.length} article{acheter.length > 1 ? 's' : ''} à acheter</Text>
 <View style={ui.row}>{[false,true].map(v=><Pressable key={String(v)} accessibilityRole="tab" accessibilityState={{selected:owned===v}} onPress={()=>setOwned(v)} style={{flex:1,minHeight:48,justifyContent:'center',borderBottomWidth:owned===v?3:1,borderBottomColor:owned===v?colors.accent:colors.border}}><Text style={{textAlign:'center',color:owned===v?colors.accent:colors.textMuted,fontWeight:owned===v?'700':'400'}}>{v?'Déjà chez moi':'À acheter'} ({lignes.filter(l=>l.owned===v).length})</Text></Pressable>)}</View>
 {loading&&<ActivityIndicator color={colors.accent}/>}{erreur&&<><Text style={ui.error}>{erreur}</Text><Action secondary onPress={()=>{p.recharger();r.recharger();}}>Réessayer</Action></>}
 {w.sauvegardeErreur&&<Text style={ui.error}>{w.sauvegardeErreur}</Text>}
 {stale&&!loading&&<View style={ui.notice}><Text style={ui.error}>Une recette de ta liste n’est plus disponible.</Text><Action secondary onPress={()=>Object.keys(w.selectedRecipes).filter(id=>!r.recettes.some(r=>r.id===id)).forEach(id=>w.toggleRecette(id,2))}>Retirer les recettes indisponibles</Action></View>}
 {RAYONS.filter(g=>visibles.some(l=>l.rayon===g.cle)).map(g=><View key={g.cle} style={{gap:8}}><Text style={ui.section}>{g.label}</Text>{visibles.filter(l=>l.rayon===g.cle).map(l=>{const produit=p.produits.find(p=>p.id===l.product_id);return <View key={l.key} style={{backgroundColor:'white',borderRadius:12,padding:10,gap:8}}>
 <View style={ui.row}><Photo name={l.name} url={produit?.image_url}/><View style={{flex:1}}><Text style={ui.productName}>{l.name}</Text><Text style={ui.detail}>{produit?.grammage_g?`${produit.grammage_g} g`:produit?.volume_ml?`${produit.volume_ml} ml`:l.unit}</Text></View></View>
 <View style={[ui.sectionRow,{flexWrap:'wrap'}]}><Pressable accessibilityRole="button" style={{minHeight:44,justifyContent:'center'}} onPress={()=>w.possederLigne(l.key,!l.owned)}><Text style={ui.link}>{owned?'Remettre à acheter':'Déjà chez moi'}</Text></Pressable><View style={ui.counter}><Pressable style={ui.iconButton} accessibilityRole="button" accessibilityLabel={`Diminuer ${l.name}`} onPress={()=>w.modifierLigne(l.key,Math.max(0,l.totalQuantity-1))}><Text style={ui.title}>−</Text></Pressable><Text style={ui.num}>{l.totalQuantity}</Text><Pressable style={ui.iconButton} accessibilityRole="button" accessibilityLabel={`Augmenter ${l.name}`} onPress={()=>w.modifierLigne(l.key,l.totalQuantity+1)}><Text style={ui.title}>+</Text></Pressable></View></View>
 {l.aPreciser&&<View style={ui.notice}><Text style={ui.error}>Conditionnement à préciser : {l.besoin}. Indique le nombre d’articles à acheter, puis confirme.</Text><Action secondary onPress={()=>w.modifierLigne(l.key,l.totalQuantity)}>Confirmer {l.totalQuantity} article{l.totalQuantity>1?'s':''}</Action></View>}
 {l.choixKey&&<><Pressable accessibilityRole="button" style={{minHeight:44,justifyContent:'center'}} onPress={()=>setOuverte(ouverte===l.key?null:l.key)}><Text style={ui.link}>{ouverte===l.key?'Masquer les détails':'Recettes et choix du produit'}</Text></Pressable>{ouverte===l.key&&<View style={{gap:8}}><Text style={ui.detail}>{l.besoin} · {[...new Set(l.sources.map(s=>s.label))].join(', ')}</Text>{l.candidats.map(c=><Action key={c.id} secondary={c.id!==l.product_id} onPress={()=>w.choisirProduit(l.choixKey!,c.id)}>{c.name}</Action>)}{!l.candidats.length&&<Text style={ui.detail}>Aucun produit associé. Scanne ce produit pour le retrouver dans ton catalogue.</Text>}</View>}</>}
 </View>})}</View>)}
 {!loading&&!erreur&&!visibles.length&&<Text style={ui.subtitle}>{owned?'Les produits que tu possèdes déjà apparaîtront ici.':'Ta liste est vide. Ajoute un favori, un repas ou un produit ci-dessous.'}</Text>}
 <View style={ui.row}><View style={{flex:1}}><Action secondary onPress={()=>router.push('/favoris')}>Mes favoris</Action></View><View style={{flex:1}}><Action secondary onPress={()=>router.push('/recettes')}>Mes repas</Action></View></View>
 <TextInput value={nom} onChangeText={setNom} placeholder="Ajouter un produit à la main…" accessibilityLabel="Nom du produit à ajouter" style={ui.input}/><Action disabled={!nom.trim()} secondary onPress={()=>{w.ajouterExtra({name:nom.trim(),quantity:1,unit:'unité',rayon:'autre'});setNom('');setOwned(false);}}>Ajouter à ma liste</Action>
 <Pressable accessibilityRole="button" style={ui.iconButton} onPress={()=>Alert.alert('Vider cette liste ?','Les recettes et les favoris de ton catalogue seront conservés.',[{text:'Annuler',style:'cancel'},{text:'Vider la liste',style:'destructive',onPress:w.reinitialiser}])}><Text style={ui.detail}>Vider la liste</Text></Pressable>
 </ScrollView><View style={ui.footer}><Action disabled={!acheter.length||loading||!!erreur||stale||acheter.some(l=>l.aPreciser)} onPress={()=>router.push('/wizard/generation')}>Choisir mon drive</Action>{acheter.some(l=>l.aPreciser)&&<Text style={ui.error}>Précise les conditionnements signalés avant l’envoi.</Text>}</View></SafeAreaView>
}
