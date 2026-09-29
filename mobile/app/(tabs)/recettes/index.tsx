import { useState, useCallback, useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useRecipes } from '../../../stores/recipes';
import { useWizard } from '../../../contexts/WizardContext';
import { Photo, Action, Head, ui } from '../../../components/MaisonUI';
import { AjoutRecetteSheet } from '../../../components/AjoutRecetteSheet';
import { ApercuRecette } from '../../../components/ApercuRecette';
import type { Recipe } from '../../../stores/recipes';
import { colors } from '../../../lib/theme';
/**
 * Choix des repas, étape « recettes » de la session de courses.
 * Hors session, l'onglet Recettes affiche la collection (voir `Collection`).
 */
function ChoixRepas({session=false}:{session?:boolean}){
 const r=useRecipes(),w=useWizard(),{width,fontScale}=useWindowDimensions();const [query,setQuery]=useState(''),[seuls,setSeuls]=useState(false),[rapides,setRapides]=useState(false),[apercu,setApercu]=useState<Recipe|null>(null);
 useFocusEffect(useCallback(()=>{r.recharger();},[r.recharger]));
 const choisis=r.recettes.filter(r=>w.selectedRecipes[r.id]!=null);
 // La pastille du pied filtre les repas choisis ; plus rien à filtrer, on revoit tout.
 useEffect(()=>{if(!choisis.length)setSeuls(false);},[choisis.length]);
 const recettes=r.recettes.filter(r=>(!seuls||w.selectedRecipes[r.id]!=null)&&r.name.toLowerCase().includes(query.toLowerCase())&&(!rapides||((r.prep_minutes??0)+(r.cook_minutes??0)>0&&(r.prep_minutes??0)+(r.cook_minutes??0)<=30)));
 const columns=width>=360&&fontScale<1.4&&recettes.length>1?2:1;
 return <SafeAreaView edges={session?[]:['top']} style={ui.screen}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}>
 <Head title="On mange quoi ?" avatar={false}/>
 {seuls&&<View style={ui.sectionRow}><Text style={ui.productName}>{choisis.length} repas choisi{choisis.length>1?'s':''}</Text><Pressable accessibilityRole="button" onPress={()=>setSeuls(false)} style={ui.iconButton}><Text style={ui.link}>Tout voir</Text></Pressable></View>}
 <TextInput value={query} onChangeText={setQuery} style={ui.input} placeholder="Une recette, une envie…" accessibilityLabel="Chercher une recette"/>
 {!seuls&&<View style={ui.sectionRow}><Pressable accessibilityRole="checkbox" accessibilityState={{checked:rapides}} aria-checked={rapides} onPress={()=>setRapides(!rapides)} style={{minHeight:44,padding:12,borderRadius:22,backgroundColor:rapides?colors.accent:colors.accentSoft,borderWidth:1,borderColor:rapides?colors.accent:colors.traitControle}}><Text style={{color:rapides?'white':'#48613A'}}>30 min ou moins</Text></Pressable><Text style={ui.detail}>{recettes.length} recette{recettes.length>1?'s':''}</Text></View>}
 {r.chargement&&<ActivityIndicator/>}{r.erreur&&<><Text style={ui.error}>{r.erreur}</Text><Action secondary onPress={r.recharger}>Réessayer</Action></>}
 <View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>{recettes.map(rec=>{const parts=w.selectedRecipes[rec.id],temps=(rec.prep_minutes??0)+(rec.cook_minutes??0);return <View key={rec.id} style={[c2.carte,{width:columns===2?'48%':'100%'},parts?c2.choisie:null]}>
 <Pressable accessibilityRole="button" accessibilityLabel={`Voir la recette ${rec.name}`} onPress={()=>session?setApercu(rec):router.push(`/recettes/${rec.id}`)}><Photo recipe name={rec.name} url={rec.image_url} style={{width:'100%',height:columns===2?135:175,borderRadius:0}}/>{!!parts&&<View style={c2.coche} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden><Feather name="check" size={18} color={colors.accentContrast}/></View>}</Pressable>
 <View style={{padding:12,gap:10,flex:1}}><Text style={[ui.productName,{minHeight:40}]}>{rec.name}</Text><View style={ui.row}><Feather name="clock" size={13} color="#656D60"/><Text style={ui.detail}>{temps?`${temps} min`:'Durée non renseignée'}</Text></View>
 {parts?<><View style={[ui.counter,{justifyContent:'space-between'}]}><Pressable accessibilityRole="button" accessibilityLabel={`Moins de portions pour ${rec.name}`} style={ui.iconButton} onPress={()=>w.setParts(rec.id,parts-1)}><Text style={ui.title}>−</Text></Pressable><Text style={ui.num}>{parts} pers.</Text><Pressable accessibilityRole="button" accessibilityLabel={`Plus de portions pour ${rec.name}`} style={ui.iconButton} onPress={()=>w.setParts(rec.id,parts+1)}><Text style={ui.title}>+</Text></Pressable></View><Pressable accessibilityRole="checkbox" accessibilityState={{checked:!!parts}} aria-checked={!!parts} accessibilityLabel={`Choisir ${rec.name}`} onPress={()=>w.toggleRecette(rec.id,rec.servings_default)} style={({pressed})=>[ui.button,!parts&&ui.secondary,pressed&&{opacity:.85}]}><View style={[ui.row,{gap:6}]}><Feather name={parts?'check':'plus'} size={16} color={parts?colors.accentContrast:colors.accent}/><Text style={[ui.buttonText,!parts&&{color:colors.accent}]}>{parts?'Choisi':'Choisir'}</Text></View></Pressable></>:<View style={{marginTop:'auto'}}><Pressable accessibilityRole="checkbox" accessibilityState={{checked:!!parts}} aria-checked={!!parts} accessibilityLabel={`Choisir ${rec.name}`} onPress={()=>w.toggleRecette(rec.id,rec.servings_default)} style={({pressed})=>[ui.button,!parts&&ui.secondary,pressed&&{opacity:.85}]}><View style={[ui.row,{gap:6}]}><Feather name={parts?'check':'plus'} size={16} color={parts?colors.accentContrast:colors.accent}/><Text style={[ui.buttonText,!parts&&{color:colors.accent}]}>{parts?'Choisi':'Choisir'}</Text></View></Pressable></View>}</View>
 </View>})}</View>
 {!r.chargement&&!r.erreur&&!recettes.length&&<View style={ui.notice}><Text style={ui.productName}>Aucune recette trouvée.</Text><Text style={ui.subtitle}>Essaie un autre nom ou enlève le filtre de durée.</Text></View>}
 <View style={ui.sectionRow}><Text style={ui.detail}>Compléter ma collection</Text><Pressable accessibilityRole="button" style={ui.iconButton} onPress={()=>router.push('/recettes/nouvelle')}><Text style={ui.link}>Créer</Text></Pressable><Pressable accessibilityRole="button" style={ui.iconButton} onPress={()=>router.push('/recettes/importer')}><Text style={ui.link}>Importer</Text></Pressable></View>
 </ScrollView><View style={[ui.footer,ui.row,{gap:8}]}>
 {choisis.length>0&&<Pressable accessibilityRole="button" accessibilityLabel={`${choisis.length} repas choisi${choisis.length>1?'s':''}, ${seuls?'tout voir':'ne voir qu’eux'}`} accessibilityState={{selected:seuls}} onPress={()=>setSeuls(!seuls)} style={({pressed})=>[f.pastille,seuls&&f.pastilleOn,pressed&&{opacity:.7}]}><View style={ui.row}>{choisis.slice(0,2).map((rec,i)=><Photo key={rec.id} recipe name={rec.name} url={rec.image_url} style={[f.vignette,i>0&&{marginLeft:-18}]}/>)}</View><Text style={[ui.link,seuls&&{color:colors.accentContrast}]}>{choisis.length} repas</Text></Pressable>}
 <View style={{flex:1}}><Action onPress={()=>router.push(session?'/wizard/recap':'/wizard/recettes')}>{session?'Voir le bilan':'Préparer mes courses'}</Action></View></View>
 <ApercuRecette recette={apercu} parts={apercu?w.selectedRecipes[apercu.id]:undefined} onFermer={()=>setApercu(null)} onBasculer={()=>apercu&&w.toggleRecette(apercu.id,apercu.servings_default)}/></SafeAreaView>
}

/**
 * Onglet Recettes : la collection. On la parcourt, on en ouvre une, on en
 * ajoute. Le choix des repas se fait dans la session de courses et sur la
 * fiche d'une recette, jamais depuis cette grille.
 */
function Collection(){
 const r=useRecipes(),{width,fontScale}=useWindowDimensions();
 const [query,setQuery]=useState(''),[rapides,setRapides]=useState(false),[ajout,setAjout]=useState(false);
 useFocusEffect(useCallback(()=>{r.recharger();},[r.recharger]));
 const recettes=r.recettes.filter(rec=>{const temps=(rec.prep_minutes??0)+(rec.cook_minutes??0);return rec.name.toLowerCase().includes(query.toLowerCase())&&(!rapides||(temps>0&&temps<=30));});
 const colonnes=width>=360&&fontScale<1.4&&recettes.length>1?2:1;
 const vide=!r.chargement&&!r.erreur&&r.recettes.length===0;
 const plus=<Pressable accessibilityRole="button" accessibilityLabel="Ajouter une recette" onPress={()=>setAjout(true)} style={ui.avatar}><Feather name="plus" size={24} color="white"/></Pressable>;
 return <SafeAreaView edges={['top']} style={ui.screen}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}>
  <Head title="Mes recettes" action={plus}/>
  {!vide&&<View style={c.recherche}>
   <View style={c.champ}><Feather name="search" size={17} color={colors.textMuted}/><TextInput value={query} onChangeText={setQuery} style={c.saisie} placeholder="Une recette, une envie…" placeholderTextColor={colors.textMuted} accessibilityLabel="Chercher une recette" returnKeyType="search"/></View>
   <Pressable accessibilityRole="checkbox" accessibilityState={{checked:rapides}} aria-checked={rapides} accessibilityLabel="30 minutes ou moins" onPress={()=>setRapides(!rapides)} style={[c.filtre,rapides&&c.filtreActif]}><Feather name="clock" size={15} color={rapides?'white':colors.accent}/><Text style={[c.filtreTexte,rapides&&{color:'white'}]}>30 min</Text></Pressable>
  </View>}
  {r.chargement&&!r.recettes.length&&<ActivityIndicator/>}
  {r.erreur&&<><Text style={ui.error}>{r.erreur}</Text><Action secondary onPress={r.recharger}>Réessayer</Action></>}
  {vide&&<View style={[ui.notice,{gap:10}]}><Text style={ui.productName}>Ta collection commence ici</Text><Text style={ui.subtitle}>Photographie une fiche, colle le lien d'une recette ou écris-la à la main.</Text><Action onPress={()=>setAjout(true)}>Ajouter une recette</Action></View>}
  <View style={c.grille}>{recettes.map(rec=>{const temps=(rec.prep_minutes??0)+(rec.cook_minutes??0);return <Pressable key={rec.id} accessibilityRole="button" accessibilityLabel={`Voir la recette ${rec.name}`} onPress={()=>router.push(`/recettes/${rec.id}`)} style={({pressed})=>[c.carte,{width:colonnes===2?'48%':'100%'},pressed&&{opacity:.85}]}>
   <Photo recipe name={rec.name} url={rec.image_url} style={{width:'100%',height:colonnes===2?135:175,borderRadius:0}}/>
   <View style={c.corps}><Text style={ui.productName} numberOfLines={2}>{rec.name}</Text>{temps>0&&<View style={ui.row}><Feather name="clock" size={13} color={colors.textMuted}/><Text style={ui.detail}>{temps} min</Text></View>}</View>
  </Pressable>})}</View>
  {!r.chargement&&!r.erreur&&!vide&&!recettes.length&&<View style={ui.notice}><Text style={ui.productName}>Aucune recette trouvée</Text><Text style={ui.subtitle}>Essaie un autre nom ou enlève le filtre de durée.</Text></View>}
 </ScrollView><AjoutRecetteSheet visible={ajout} onFermer={()=>setAjout(false)}/></SafeAreaView>;
}

export default function Recettes({session=false}:{session?:boolean}){
 return session?<ChoixRepas session/>:<Collection/>;
}

/** Carte d'une recette à choisir : une carte choisie a un contour vert et une coche. */
const c2=StyleSheet.create({
 carte:{backgroundColor:'white',borderRadius:14,overflow:'hidden',borderWidth:1,borderColor:colors.border},
 choisie:{borderWidth:2.5,borderColor:colors.accent},
 coche:{position:'absolute',top:8,right:8,width:32,height:32,borderRadius:16,backgroundColor:colors.accent,alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:'white'},
});
/** Pied de l'étape Repas : la pastille des repas choisis, puis l'étape suivante. */
const f=StyleSheet.create({
 pastilleOn:{backgroundColor:colors.accent},
 pastille:{minHeight:48,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:12,borderRadius:12,borderWidth:1.5,borderColor:colors.accent},
 vignette:{width:26,height:26,borderRadius:13,borderWidth:2,borderColor:colors.surface},
});

const c=StyleSheet.create({
 recherche:{flexDirection:'row',alignItems:'center',gap:8},
 champ:{flex:1,flexDirection:'row',alignItems:'center',gap:8,minHeight:46,paddingHorizontal:14,borderRadius:23,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.traitControle},
 saisie:{flex:1,fontSize:16,color:colors.text,paddingVertical:10},
 filtre:{flexDirection:'row',alignItems:'center',gap:6,minHeight:46,paddingHorizontal:14,borderRadius:23,backgroundColor:colors.accentSoft,borderWidth:1,borderColor:colors.traitControle},
 filtreActif:{backgroundColor:colors.accent,borderColor:colors.accent},
 filtreTexte:{fontSize:14,fontWeight:'600',color:colors.accent},
 grille:{flexDirection:'row',flexWrap:'wrap',gap:12},
 carte:{backgroundColor:colors.surface,borderRadius:14,overflow:'hidden'},
 corps:{padding:12,gap:6},
});
