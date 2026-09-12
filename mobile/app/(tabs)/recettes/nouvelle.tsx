import { useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Action, Photo, ui } from '../../../components/MaisonUI';
import { Portions, rs } from '../../../components/RecipeUI';
import { SelecteurIngredient, type ChoixIngredient } from '../../../components/SelecteurIngredient';
import { useProducts } from '../../../stores/products';
import { creerRecette } from '../../../stores/recipes';
import { UNITES, valideBrouillon, type Brouillon } from '../../../lib/recette-brouillon';
import { choisirPhoto, deposerPhoto } from '../../../lib/photo-recette';
import { colors } from '../../../lib/theme';

type Ligne = ChoixIngredient & { key:number; total:string };
export default function NouvelleRecette() {
  const router=useRouter(),{produits}=useProducts(),seq=useRef(0),lock=useRef(false);
  const [nom,setNom]=useState(''),[parts,setParts]=useState(4),[ingredients,setIngredients]=useState<Ligne[]>([]);
  const [prep,setPrep]=useState(''),[cuisson,setCuisson]=useState('');
  const [selecteur,setSelecteur]=useState(false),[unites,setUnites]=useState<number|null>(null),[abandon,setAbandon]=useState(false);
  const [photo,setPhoto]=useState<{base64:string}|null>(null),[photoMenu,setPhotoMenu]=useState(false);
  const [erreur,setErreur]=useState(''),[busy,setBusy]=useState(false),[termine,setTermine]=useState(false),[avertissement,setAvertissement]=useState('');
  const scroll=useRef<ScrollView>(null);
  const modifie=!!nom||ingredients.length>0||!!photo||parts!==4||!!prep||!!cuisson;
  function quitter(){if(busy)return;if(modifie&&!termine)setAbandon(true);else router.replace('/recettes');}
  async function photoDepuis(source:'appareil'|'bibliotheque') {
    setPhotoMenu(false);
    try {const p=await choisirPhoto(source);if(p)setPhoto(p);}catch{setErreur('Impossible d’ouvrir les photos. Vérifie les permissions de l’application.');}
  }
  function ajouter(choix:ChoixIngredient) {
    setIngredients(l=>[...l,{...choix,key:++seq.current,total:''}]);setSelecteur(false);setErreur('');
  }
  function modifier(key:number,patch:Partial<Ligne>){setErreur('');setIngredients(l=>l.map(i=>i.key===key?{...i,...patch}:i));}
  async function enregistrer() {
    if(lock.current)return;
    const b:Brouillon={name:nom,servings_default:parts,ingredients:ingredients.map(i=>({name:i.name,product_id:i.product_id,rayon:i.rayon,unit:i.unit,quantity_per_serving:Number(i.total.replace(',','.'))/parts})),prep_minutes:prep===''?null:Number(prep),cook_minutes:cuisson===''?null:Number(cuisson)};
    const quantiteInvalide=ingredients.find(i=>!i.total.trim()||!Number.isFinite(Number(i.total.replace(',','.')))||Number(i.total.replace(',','.'))<=0);
    const dureeInvalide=[prep,cuisson].some(t=>t!==''&&(!/^\d+$/.test(t)||Number(t)>10080));
    const probleme=valideBrouillon(b)||(quantiteInvalide?`Indique une quantité supérieure à zéro pour ${quantiteInvalide.name}.`:null)||(dureeInvalide?'Indique les durées en minutes entières, ou laisse-les vides.':null);
    if(probleme){setErreur(probleme);return;}
    lock.current=true;setBusy(true);setErreur('');setAvertissement('');
    try {
      if(photo){const p=await deposerPhoto(photo.base64);if(p.ok)b.image_url=p.url;else setAvertissement('La recette est enregistrée sans la photo. Tu pourras l’ajouter depuis Modifier.');}
      const r=await creerRecette(b);
      if(r.ok)setTermine(true);else{setErreur(r.erreur??'Enregistrement impossible. Tes saisies sont conservées.');setAvertissement('');}
    }catch{setErreur('Connexion interrompue. Vérifie tes recettes avant de réessayer.');setAvertissement('');}
    finally{setBusy(false);lock.current=false;}
  }
  return <SafeAreaView edges={['top']} style={rs.page}>
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
      <View style={rs.bar}><Pressable accessibilityRole="button" disabled={busy} onPress={quitter} style={rs.back}><Feather name="chevron-left" size={21} color={colors.accent}/><Text style={ui.link}>Recettes</Text></Pressable><Text style={ui.detail}>{termine?'Enregistrée':'Nouvelle recette'}</Text></View>
      {termine?<View style={[rs.body,{paddingTop:48}]}><Feather name="check-circle" size={42} color={colors.accent}/><Text style={rs.title}>Une recette de plus à partager.</Text><Text style={rs.text}>« {nom.trim()} » est dans ta collection, avec ses {ingredients.length} ingrédients pour {parts} personnes.</Text>{!!avertissement&&<Text style={ui.error}>{avertissement}</Text>}<Action onPress={()=>router.replace('/recettes')}>Retrouver mes recettes</Action></View>:<>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={rs.body}>
        <View style={{gap:8}}><Text style={rs.title}>On note une bonne recette ?</Text><Text style={rs.text}>Un nom, les ingrédients et leurs quantités. Tu pourras la retrouver pour préparer tes prochains repas.</Text></View>
        <View><Text style={rs.label}>Nom de la recette</Text><TextInput accessibilityLabel="Nom de la recette" editable={!busy} maxLength={160} value={nom} onChangeText={v=>{setNom(v);setErreur('');}} placeholder="Ex. Gratin de courgettes" placeholderTextColor={colors.textMuted} style={ui.input}/></View>
        <Pressable accessibilityRole="button" accessibilityLabel={photo?'Changer la photo':'Ajouter une photo'} disabled={busy} onPress={()=>Platform.OS==='web'?photoDepuis('bibliotheque'):setPhotoMenu(true)} style={[ui.row,{backgroundColor:'white',padding:12,borderRadius:14,gap:16}]}>
          {photo?<Image source={{uri:`data:image/jpeg;base64,${photo.base64}`}} style={{width:84,height:84,borderRadius:10}}/>:<View style={{width:84,height:84,borderRadius:10,backgroundColor:colors.accentSoft,alignItems:'center',justifyContent:'center'}}><Feather name="camera" size={26} color={colors.accent}/></View>}
          <View style={{flex:1,gap:4}}><Text style={ui.productName}>{photo?'Changer la photo':'Ajouter une photo'}</Text><Text style={ui.detail}>Facultatif, mais plus facile à retrouver.</Text></View><Feather name="plus" size={18} color={colors.accent}/>
        </Pressable>
        <View style={rs.row}><View><Text style={rs.label}>Cette recette est pour</Text><Text style={rs.text}>{parts} personne{parts>1?'s':''}</Text></View><Portions value={parts} onChange={v=>{setParts(v);setErreur('');}} disabled={busy}/></View>
        <View style={[ui.row,{alignItems:'flex-start'}]}>{([{label:'Préparation',value:prep,set:setPrep},{label:'Cuisson',value:cuisson,set:setCuisson}]).map(f=><View key={f.label} style={{flex:1}}><Text style={rs.label}>{f.label} · min</Text><TextInput accessibilityLabel={`${f.label} en minutes`} editable={!busy} value={f.value} onChangeText={v=>{f.set(v);setErreur('');}} keyboardType="number-pad" maxLength={5} placeholder="Facultatif" placeholderTextColor={colors.textMuted} style={ui.input}/></View>)}</View>
        <View style={{gap:7,marginTop:12}}><Text style={rs.section}>Les ingrédients{ingredients.length?` (${ingredients.length})`:''}</Text><Text style={rs.text}>Saisis les quantités pour la recette entière, soit {parts} personnes. L’app les adaptera au moment de choisir ce repas.</Text></View>
        {!ingredients.length&&<View style={{paddingVertical:14,gap:8}}><Text style={ui.productName}>Qu’est-ce qu’on met dedans ?</Text><Text style={rs.text}>Choisis un produit habituel, cherche dans Open Food Facts ou saisis simplement le nom.</Text></View>}
        {ingredients.map(ing=>{
          const produit=produits.find(p=>p.id===ing.product_id);
          return <View key={ing.key} style={{padding:14,borderRadius:14,backgroundColor:'white',gap:12}}>
            <View style={ui.row}><Photo name={ing.name} url={produit?.image_url} style={{width:48,height:48}}/><Text style={[ui.productName,{flex:1}]}>{ing.name}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${ing.name}`} disabled={busy} style={ui.iconButton} onPress={()=>setIngredients(l=>l.filter(i=>i.key!==ing.key))}><Feather name="x" size={19} color={colors.textMuted}/></Pressable></View>
            <View style={[ui.row,{alignItems:'flex-end'}]}><View style={{flex:1}}><Text style={rs.label}>Quantité totale</Text><TextInput accessibilityLabel={`Quantité totale de ${ing.name}`} editable={!busy} value={ing.total} onChangeText={total=>modifier(ing.key,{total})} keyboardType="decimal-pad" maxLength={12} placeholder="Ex. 500" placeholderTextColor={colors.textMuted} style={ui.input}/></View><View style={{flex:1}}><Text style={rs.label}>Unité</Text><Pressable accessibilityRole="button" accessibilityLabel={`Unité de ${ing.name} : ${ing.unit}`} disabled={busy} onPress={()=>setUnites(ing.key)} style={[ui.input,ui.row,{justifyContent:'space-between'}]}><Text style={{color:colors.text,fontSize:15,flex:1}}>{ing.unit}</Text><Feather name="chevron-down" size={16} color={colors.accent}/></Pressable></View></View>
          </View>;
        })}
        <Action secondary disabled={busy} onPress={()=>setSelecteur(true)}>Ajouter un ingrédient</Action>
      </ScrollView>
      <View style={rs.footer}><View style={rs.footInner}>
        {!!erreur&&<Text accessibilityLiveRegion="assertive" style={ui.error}>{erreur}</Text>}
        <Text style={ui.detail}>{ingredients.length} ingrédient{ingredients.length>1?'s':''} · pour {parts} personnes</Text>
        <Action disabled={busy} onPress={enregistrer}>{busy?'Enregistrement…':'Enregistrer ma recette'}</Action>
      </View></View>
      </>}
    </KeyboardAvoidingView>
    <Modal visible={selecteur} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setSelecteur(false)}><SelecteurIngredient onChoisir={ajouter} onFermer={()=>setSelecteur(false)}/></Modal>
    <Modal visible={unites!==null} transparent animationType="fade" onRequestClose={()=>setUnites(null)}><View style={rs.sheet}><View style={rs.dialog}><Text style={rs.section}>Choisir l’unité</Text><ScrollView style={{maxHeight:360}}>{UNITES.map(u=><Pressable accessibilityRole="button" key={u} style={rs.back} onPress={()=>{if(unites!==null)modifier(unites,{unit:u});setUnites(null);}}><Text style={ui.link}>{u}</Text></Pressable>)}</ScrollView><Action secondary onPress={()=>setUnites(null)}>Fermer</Action></View></View></Modal>
    <Modal visible={photoMenu} transparent animationType="fade" onRequestClose={()=>setPhotoMenu(false)}><View style={rs.sheet}><View style={rs.dialog}><Text style={rs.section}>Photo de la recette</Text><Action onPress={()=>photoDepuis('bibliotheque')}>Choisir une photo</Action><Action secondary onPress={()=>photoDepuis('appareil')}>Prendre une photo</Action><Action secondary onPress={()=>setPhotoMenu(false)}>Annuler</Action></View></View></Modal>
    <Modal visible={abandon} transparent animationType="fade" onRequestClose={()=>setAbandon(false)}><View style={rs.sheet}><View style={rs.dialog}><Text style={rs.section}>Quitter sans enregistrer ?</Text><Text style={rs.text}>Les informations saisies seront perdues.</Text><Action onPress={()=>setAbandon(false)}>Continuer ma recette</Action><Action secondary onPress={()=>router.replace('/recettes')}>Quitter sans enregistrer</Action></View></View></Modal>
  </SafeAreaView>;
}
