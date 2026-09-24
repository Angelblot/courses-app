import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useNavigation, usePreventRemove } from 'expo-router/react-navigation';
import { Feather } from '@expo/vector-icons';
import { SelecteurIngredient, type ChoixIngredient } from '../../../../components/SelecteurIngredient';
import { Action, Photo, ui } from '../../../../components/MaisonUI';
import { Portions, rs } from '../../../../components/RecipeUI';
import { useProducts } from '../../../../stores/products';
import { modifierRecette, useRecette } from '../../../../stores/recipes';
import { UNITES, valideBrouillon, type Brouillon, type IngredientBrouillon } from '../../../../lib/recette-brouillon';
import { choisirPhoto, deposerPhoto } from '../../../../lib/photo-recette';
import { colors } from '../../../../lib/theme';

type Ligne = IngredientBrouillon & { key:number; saisie:string };
function Ouverture({children,reduite}:{children:React.ReactNode;reduite:boolean}) {
 const opacity=useRef(new Animated.Value(reduite?1:0)).current;
 useEffect(()=>{Animated.timing(opacity,{toValue:1,duration:reduite?0:180,useNativeDriver:true}).start();},[opacity,reduite]);
 return <Animated.View style={{opacity,gap:12,paddingHorizontal:14,paddingBottom:14,transform:[{translateY:opacity.interpolate({inputRange:[0,1],outputRange:[5,0]})}]}}>{children}</Animated.View>;
}
export default function ModifierRecette(){
 const {id}=useLocalSearchParams<{id:string}>(),router=useRouter(),navigation=useNavigation();
 const {recette,chargement,erreur:loadError,recharger}=useRecette(id),{produits}=useProducts();
 const seq=useRef(0),lock=useRef(false),initial=useRef(''),loaded=useRef<string|null>(null);
 const [nom,setNom]=useState(''),[parts,setParts]=useState(4),[ingredients,setIngredients]=useState<Ligne[]>([]);
 const [photo,setPhoto]=useState<{base64:string}|null>(null),[photoExistante,setPhotoExistante]=useState<string|null>(null);
 const [open,setOpen]=useState<number|null>(null),[unites,setUnites]=useState<number|null>(null),[selecteur,setSelecteur]=useState(false),[photoMenu,setPhotoMenu]=useState(false);
 const [retire,setRetire]=useState<{ligne:Ligne;index:number}|null>(null),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false),[ready,setReady]=useState(false);
 const [erreur,setErreur]=useState(''),[warning,setWarning]=useState(''),[keyboard,setKeyboard]=useState(false),[reduced,setReduced]=useState(true);
 const [abandon,setAbandon]=useState(false),[leave,setLeave]=useState(false);
 const pendingAction=useRef<Parameters<typeof navigation.dispatch>[0]|null>(null);
 const snapshot=JSON.stringify({nom,parts,ingredients:ingredients.map(({key,saisie,...i})=>({...i,quantity_per_serving:saisie}))});
 const dirty=ready&&(snapshot!==initial.current||!!photo);
 usePreventRemove(!leave&&!saved&&(dirty||busy),({data})=>{if(busy)return;pendingAction.current=data.action;setAbandon(true);});
 useEffect(()=>{if(leave){if(pendingAction.current)navigation.dispatch(pendingAction.current);else router.back();}},[leave,navigation,router]);
 useEffect(()=>{
  if(!recette||recette.id!==id||loaded.current===id)return;
  const rows=recette.ingredients.map(i=>({name:i.name,quantity_per_serving:i.quantity_per_serving,unit:i.unit,rayon:i.rayon,product_id:i.product_id,key:++seq.current,saisie:String(i.quantity_per_serving)}));
  setNom(recette.name);setParts(recette.servings_default);setIngredients(rows);setPhotoExistante(recette.image_url);setPhoto(null);
  initial.current=JSON.stringify({nom:recette.name,parts:recette.servings_default,ingredients:rows.map(({key,saisie,...i})=>({...i,quantity_per_serving:saisie}))});
  loaded.current=id;setReady(true);
 },[recette,id]);
 useEffect(()=>{const a=Keyboard.addListener('keyboardDidShow',()=>setKeyboard(true)),b=Keyboard.addListener('keyboardDidHide',()=>setKeyboard(false));AccessibilityInfo.isReduceMotionEnabled().then(setReduced);const c=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduced);return()=>{a.remove();b.remove();c.remove();};},[]);
 function modifier(key:number,patch:Partial<Ligne>){setIngredients(l=>l.map(i=>i.key===key?{...i,...patch}:i));setErreur('');setSaved(false);}
 function quitter(){Keyboard.dismiss();if(busy)return;pendingAction.current=null;if(dirty&&!saved)setAbandon(true);else router.back();}
 function ajouter(choix:ChoixIngredient){const key=++seq.current;setIngredients(l=>[...l,{...choix,quantity_per_serving:1,saisie:'1',key}]);setSelecteur(false);setOpen(key);setErreur('');}
 async function photoDepuis(source:'appareil'|'bibliotheque'){setPhotoMenu(false);try{const p=await choisirPhoto(source);if(p)setPhoto(p);}catch{setErreur('Impossible d’ouvrir les photos. Vérifie les permissions.');}}
 async function enregistrer(){
  if(lock.current||!ready)return;Keyboard.dismiss();
  const b:Brouillon={name:nom,servings_default:parts,image_url:photoExistante,ingredients:ingredients.map(({key,saisie,...i})=>({...i,quantity_per_serving:Number(saisie.replace(',','.'))}))};
  const invalid=ingredients.find(i=>!i.saisie.trim()||!Number.isFinite(Number(i.saisie.replace(',','.')))||Number(i.saisie.replace(',','.'))<=0);
  const problem=valideBrouillon(b)||(invalid?`Indique une quantité supérieure à zéro pour ${invalid.name}.`:null);
  if(problem){setErreur(problem);if(invalid)setOpen(invalid.key);return;}
  lock.current=true;setBusy(true);setErreur('');setWarning('');
  try{
   let photoFailed=false;
   if(photo){const result=await deposerPhoto(photo.base64);if(result.ok&&result.url)b.image_url=result.url;else photoFailed=true;}
   const result=await modifierRecette(id,b);
   if(!result.ok){setErreur(result.erreur??'Enregistrement impossible. Tes modifications restent à l’écran.');return;}
   if(photoFailed)setWarning('La recette est enregistrée, mais la nouvelle photo n’a pas pu être envoyée. La photo précédente est conservée.');
   setSaved(true);
  }catch{setErreur('Connexion interrompue. Tes modifications restent à l’écran pour réessayer.');}
  finally{lock.current=false;setBusy(false);}
 }
 const uniteIngredient=ingredients.find(i=>i.key===unites);
 return <SafeAreaView edges={['top']} style={rs.page}><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
 <View style={rs.bar}><Pressable accessibilityRole="button" accessibilityLabel="Retour" disabled={busy} onPress={quitter} style={rs.back}><Feather name="chevron-left" size={22} color={colors.accent}/><Text style={ui.link}>Retour</Text></Pressable><Text style={ui.productName}>{saved?'Recette enregistrée':'Modifier la recette'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Fermer le clavier" onPress={Keyboard.dismiss} style={ui.iconButton}><Feather name="chevron-down" size={22} color={colors.accent}/></Pressable></View>
 {saved?<View style={[rs.body,{gap:20,paddingTop:40}]}><Feather name="check-circle" size={40} color={colors.accent}/><Text style={rs.title}>Ta recette est prête.</Text><Text style={rs.text}>{nom} · {ingredients.length} ingrédients · {parts} personnes</Text>{!!warning&&<Text style={ui.error}>{warning}</Text>}<Action onPress={()=>router.replace(`/recettes/${id}`)}>Voir ma recette</Action></View>:!ready?<View style={rs.body}>{chargement?<ActivityIndicator color={colors.accent}/>:<><Text style={ui.error}>{loadError??'Cette recette n’est plus disponible.'}</Text><Action secondary onPress={recharger}>Réessayer</Action></>}</View>:<>
 <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[rs.body,{gap:20}]}>
 <View style={[ui.row,{alignItems:'flex-start',gap:16}]}><Pressable disabled={busy} accessibilityRole="button" accessibilityLabel="Changer la photo de la recette" onPress={()=>{Keyboard.dismiss();setPhotoMenu(true);}} style={{width:96,gap:6}}><Photo recipe name={nom} url={photo?`data:image/jpeg;base64,${photo.base64}`:photoExistante} style={{width:96,height:112,borderRadius:14}}/><View style={ui.row}><Feather name="camera" size={14} color={colors.accent}/><Text style={ui.link}>Photo</Text></View></Pressable><View style={{flex:1,gap:8}}><Text style={ui.detail}>Nom de la recette</Text><TextInput accessibilityLabel="Nom de la recette" editable={!busy} multiline value={nom} onChangeText={setNom} placeholder="Le nom de ton plat" style={{fontSize:24,fontWeight:'700',color:colors.text,paddingVertical:8,borderBottomWidth:1,borderBottomColor:colors.border}}/></View></View>
 <View style={rs.row}><View><Text style={ui.productName}>À table pour</Text><Text style={ui.detail}>Nombre de personnes</Text></View><Portions value={parts} onChange={setParts} disabled={busy}/></View>
 <View style={{gap:6}}><View style={rs.row}><Text style={rs.section}>Les ingrédients</Text><Text style={ui.detail}>{ingredients.length} dans la recette</Text></View><Text style={rs.text}>Quantités pour 1 personne. Touche un ingrédient pour le modifier.</Text></View>
 <View style={{gap:8}}>{ingredients.map((ing,index)=>{const expanded=open===ing.key,product=produits.find(p=>p.id===ing.product_id);return <View key={ing.key} style={{backgroundColor:colors.surface,borderRadius:14,borderWidth:1,borderColor:expanded?colors.accent:colors.border}}>
 <Pressable accessibilityRole="button" accessibilityLabel={`Modifier ${ing.name}`} accessibilityState={{expanded}} disabled={busy} onPress={()=>{Keyboard.dismiss();setOpen(expanded?null:ing.key);}} style={({pressed})=>({padding:12,flexDirection:'row',alignItems:'center',gap:10,opacity:pressed?.7:1})}><Photo name={ing.name} url={product?.image_url} style={{width:44,height:48}}/><View style={{flex:1,gap:4}}><Text style={ui.productName}>{ing.name}</Text><Text style={{color:colors.accent,fontSize:15,fontWeight:'600'}}>{ing.saisie||'—'} {ing.unit} <Text style={ui.detail}>/ personne</Text></Text></View><Feather name={expanded?'chevron-up':'chevron-down'} size={18} color={colors.accent}/></Pressable>
 {expanded&&<Ouverture reduite={reduced}><View style={[ui.row,{alignItems:'flex-end',flexWrap:'wrap'}]}><View style={{flex:1,minWidth:100}}><Text style={rs.label}>Quantité par personne</Text><TextInput accessibilityLabel={`Quantité par personne de ${ing.name}`} style={ui.input} editable={!busy} value={ing.saisie} onChangeText={saisie=>modifier(ing.key,{saisie})} keyboardType="decimal-pad" maxLength={12}/></View><View style={{flex:1,minWidth:100}}><Text style={rs.label}>Unité</Text><Pressable accessibilityRole="button" accessibilityLabel={`Unité de ${ing.name} : ${ing.unit}`} disabled={busy} onPress={()=>{Keyboard.dismiss();setUnites(ing.key);}} style={[ui.input,rs.row]}><Text style={{flex:1,color:colors.text}}>{ing.unit}</Text><Feather name="chevron-down" size={16} color={colors.accent}/></Pressable></View></View>
 <View style={rs.row}><Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${ing.name}`} disabled={busy} style={rs.back} onPress={()=>{Keyboard.dismiss();setRetire({ligne:ing,index});setIngredients(l=>l.filter(i=>i.key!==ing.key));setOpen(null);}}><Feather name="trash-2" size={16} color={colors.textMuted}/><Text style={ui.detail}>Retirer</Text></Pressable><Action secondary onPress={()=>{Keyboard.dismiss();setOpen(null);}}>Terminé</Action></View></Ouverture>}
 </View>})}</View>
 {!ingredients.length&&<Text style={rs.text}>Ajoute les ingrédients de ton plat depuis ton catalogue ou saisis leur nom.</Text>}
 <Action secondary disabled={busy} onPress={()=>{Keyboard.dismiss();setSelecteur(true);}}>Ajouter un ingrédient</Action>
 </ScrollView>
 <View style={rs.footer}><View style={rs.footInner}>
 {retire&&<View style={rs.row}><Text style={[ui.detail,{flex:1}]} accessibilityLiveRegion="polite">{retire.ligne.name} retiré</Text><Pressable accessibilityRole="button" disabled={busy} onPress={()=>{setIngredients(l=>{const copy=[...l];copy.splice(Math.min(retire.index,l.length),0,retire.ligne);return copy;});setRetire(null);}} style={rs.back}><Text style={ui.link}>Annuler le retrait</Text></Pressable></View>}
 {!!erreur&&<Text accessibilityLiveRegion="assertive" style={ui.error}>{erreur}</Text>}
 {keyboard&&<Pressable accessibilityRole="button" onPress={Keyboard.dismiss} style={rs.back}><Feather name="chevron-down" size={18} color={colors.accent}/><Text style={ui.link}>Masquer le clavier</Text></Pressable>}
 <Action disabled={busy} onPress={enregistrer}>{busy?'Enregistrement…':'Enregistrer les modifications'}</Action>
 </View></View></>}
 </KeyboardAvoidingView>
 <Modal visible={selecteur} animationType={reduced?'none':'slide'} presentationStyle="pageSheet" onRequestClose={()=>setSelecteur(false)}><SelecteurIngredient onChoisir={ajouter} onFermer={()=>setSelecteur(false)}/></Modal>
 <Modal visible={unites!==null||photoMenu||abandon} transparent animationType="none" onRequestClose={()=>{setUnites(null);setPhotoMenu(false);setAbandon(false);}}><View style={rs.sheet}><View style={rs.dialog} accessibilityViewIsModal>
 {unites!==null?<><Text style={rs.section}>Choisir l’unité</Text><Text style={rs.text}>{uniteIngredient?.name}</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{UNITES.map(u=><Pressable key={u} accessibilityRole="button" accessibilityState={{selected:uniteIngredient?.unit===u}} onPress={()=>{modifier(unites,{unit:u});setUnites(null);}} style={{minHeight:44,padding:12,borderRadius:10,backgroundColor:uniteIngredient?.unit===u?colors.accent:colors.accentSoft}}><Text style={{color:uniteIngredient?.unit===u?'white':colors.accent,fontWeight:'600'}}>{u}</Text></Pressable>)}</View><Action secondary onPress={()=>setUnites(null)}>Fermer</Action></>:photoMenu?<><Text style={rs.section}>La photo de ton plat</Text><Action onPress={()=>photoDepuis('bibliotheque')}>Choisir une photo</Action><Action secondary onPress={()=>photoDepuis('appareil')}>Prendre une photo</Action><Action secondary onPress={()=>setPhotoMenu(false)}>Annuler</Action></>:abandon?<><Text style={rs.section}>Quitter sans enregistrer ?</Text><Text style={rs.text}>Tes modifications n’ont pas encore été enregistrées.</Text><Action onPress={()=>setAbandon(false)}>Continuer à modifier</Action><Action secondary onPress={()=>{setAbandon(false);setLeave(true);}}>Abandonner les modifications</Action></>:null}
 </View></View></Modal>
 </SafeAreaView>;
}
