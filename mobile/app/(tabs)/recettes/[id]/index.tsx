import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Action, Photo, ui } from '../../../../components/MaisonUI';
import { Portions, rs } from '../../../../components/RecipeUI';
import { SelecteurIngredient, type ChoixIngredient } from '../../../../components/SelecteurIngredient';
import { useRecette, supprimerRecette, rattacherIngredient } from '../../../../stores/recipes';
import { useProducts } from '../../../../stores/products';
import { useWizard } from '../../../../contexts/WizardContext';
import { formatDuree, quantitePourParts } from '../../../../lib/recettes-affichage';
import { formatIngredientQty } from '../../../../lib/unites';
import { colors } from '../../../../lib/theme';

export default function DetailRecette() {
  const {id}=useLocalSearchParams<{id:string}>(), router=useRouter();
  const {recette,chargement,erreur,recharger}=useRecette(id), {produits}=useProducts(), w=useWizard();
  const [parts,setParts]=useState<number|null>(null),[avis,setAvis]=useState('');
  const [erreurAction,setErreurAction]=useState(''),[suppression,setSuppression]=useState(false),[busy,setBusy]=useState(false);
  const [cible,setCible]=useState<{id:string;nom:string}|null>(null);
  useEffect(()=>{setParts(null);setAvis('');setErreurAction('');},[id]);
  useFocusEffect(useCallback(()=>{recharger();},[recharger]));
  async function rattacher(choix:ChoixIngredient) {
    if(!cible)return;
    const ing=cible;setCible(null);setErreurAction('');
    const r=await rattacherIngredient(ing.id,choix.product_id,choix.rayon);
    if(r.ok)recharger();else setErreurAction(r.erreur??'Impossible de choisir ce produit. Réessaie.');
  }
  async function supprimer() {
    if(busy||!recette)return;setBusy(true);
    try {
      const r=await supprimerRecette(recette.id);
      if(r.ok){if(w.selectedRecipes[recette.id])w.toggleRecette(recette.id,recette.servings_default);router.replace('/recettes');}
      else {setErreurAction(r.erreur??'Suppression impossible. Réessaie.');setSuppression(false);}
    } catch {setErreurAction('Suppression impossible. Vérifie ta connexion.');setSuppression(false);} finally {setBusy(false);}
  }
  const n=parts??(id?w.selectedRecipes[id]:undefined)??recette?.servings_default??2;
  const choisi=!!recette&&w.selectedRecipes[recette.id]!=null;
  const aJour=choisi&&w.selectedRecipes[recette!.id]===n;
  return <SafeAreaView edges={['top']} style={rs.page}>
    <View style={rs.bar}>
      <Pressable accessibilityRole="button" onPress={()=>router.replace('/recettes')} style={rs.back}><Feather name="chevron-left" size={21} color={colors.accent}/><Text style={ui.link}>Recettes</Text></Pressable>
      {recette&&<Pressable accessibilityRole="button" style={rs.back} onPress={()=>router.push(`/recettes/${recette.id}/modifier`)}><Feather name="edit-2" size={16} color={colors.accent}/><Text style={ui.link}>Modifier</Text></Pressable>}
    </View>
    {!recette?<View style={rs.body}>{chargement?<ActivityIndicator color={colors.accent}/>:<><Text style={rs.title}>{erreur?'Impossible de charger la recette':'Recette introuvable'}</Text><Text style={rs.text}>{erreur??'Elle a peut-être été supprimée.'}</Text><Action secondary onPress={recharger}>Réessayer</Action></>}</View>:<>
      <ScrollView contentContainerStyle={rs.body}>
        <Photo recipe name={recette.name} url={recette.image_url} style={{width:'100%',height:230,borderRadius:16}}/>
        <Text style={rs.title}>{recette.name}</Text>
        <View style={[rs.row,{justifyContent:'flex-start',columnGap:22}]}>
          {recette.prep_minutes!=null&&<Text style={rs.text}>Préparation · {formatDuree(recette.prep_minutes)??'0 min'}</Text>}
          {recette.cook_minutes!=null&&<Text style={rs.text}>Cuisson · {formatDuree(recette.cook_minutes)??'Sans cuisson'}</Text>}
          {!!recette.kcal_per_serving&&<Text style={rs.text}>{recette.kcal_per_serving} kcal / personne</Text>}
        </View>
        <View style={[rs.row,{paddingVertical:12,borderTopWidth:1,borderBottomWidth:1,borderColor:colors.border}]}>
          <View><Text style={rs.label}>À table pour</Text><Text style={rs.text}>{n} personne{n>1?'s':''}</Text></View>
          <Portions value={n} onChange={v=>{setParts(v);setAvis('');}}/>
        </View>
        <View style={{gap:4}}><Text style={rs.section}>Les ingrédients</Text><Text style={rs.text}>Quantités adaptées à {n} personne{n>1?'s':''}. Touche une ligne pour choisir le produit à acheter.</Text></View>
        <View>{recette.ingredients.map(ing=>{
          const produit=produits.find(p=>p.id===ing.product_id);
          return <Pressable key={ing.id} accessibilityRole="button" accessibilityLabel={`Choisir le produit pour ${ing.name}`} onPress={()=>setCible({id:ing.id,nom:ing.name})} style={rs.ingredient}>
            <Photo name={ing.name} url={produit?.image_url} style={{width:52,height:56}}/>
            <View style={{flex:1,gap:3}}><Text style={ui.productName}>{ing.name}</Text><Text style={rs.quantity}>{formatIngredientQty(quantitePourParts(ing.quantity_per_serving,n),ing.unit)}</Text><Text style={ui.detail}>{produit?.name??'Choisir un produit'}</Text></View>
            <Feather name="chevron-right" size={18} color={colors.accent}/>
          </Pressable>;
        })}{!recette.ingredients.length&&<Text style={rs.text}>Ajoute les ingrédients en modifiant cette recette pour préparer ta liste.</Text>}</View>
        {!!recette.description&&<View style={{gap:10}}><Text style={rs.section}>À propos de cette recette</Text><Text style={[rs.text,{color:colors.text,lineHeight:26}]}>{recette.description}</Text></View>}
        {!!avis&&<Text accessibilityLiveRegion="polite" style={ui.link}>{avis}</Text>}
        {!!erreurAction&&<Text accessibilityLiveRegion="polite" style={ui.error}>{erreurAction}</Text>}
        {choisi&&<Pressable accessibilityRole="button" style={rs.back} onPress={()=>{w.toggleRecette(recette.id,recette.servings_default);setAvis('Ce repas a été retiré de ton menu.');}}><Feather name="minus-circle" size={17} color={colors.accent}/><Text style={ui.link}>Retirer de mes repas</Text></Pressable>}
        <Pressable accessibilityRole="button" onPress={()=>setSuppression(true)} style={rs.back}><Feather name="trash-2" size={16} color={colors.textMuted}/><Text style={rs.text}>Supprimer la recette…</Text></Pressable>
      </ScrollView>
      <View style={rs.footer}><View style={rs.footInner}>
        <Text style={ui.detail}>{aJour?`Dans tes repas · ${n} personne${n>1?'s':''}`:'Les ingrédients rejoindront ta liste de courses.'}</Text>
        <Action disabled={!recette.ingredients.length} onPress={()=>{if(aJour)router.push('/liste');else{w.setParts(recette.id,n);setAvis('Repas choisi. Les ingrédients sont dans ta liste.');}}}>{aJour?'Voir ma liste de courses':choisi?`Mettre à jour pour ${n} personnes`:'Choisir ce repas'}</Action>
      </View></View>
    </>}
    <Modal visible={!!cible} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setCible(null)}><SelecteurIngredient onChoisir={rattacher} onFermer={()=>setCible(null)}/></Modal>
    <Modal visible={suppression} transparent animationType="fade" onRequestClose={()=>!busy&&setSuppression(false)}><View style={rs.sheet}><View style={rs.dialog}><Text style={rs.section}>Supprimer cette recette ?</Text><Text style={rs.text}>La recette et ses ingrédients seront supprimés. Cette action est définitive.</Text><Action disabled={busy} onPress={supprimer}>{busy?'Suppression…':'Supprimer définitivement'}</Action><Action disabled={busy} secondary onPress={()=>setSuppression(false)}>Garder la recette</Action></View></View></Modal>
  </SafeAreaView>;
}
