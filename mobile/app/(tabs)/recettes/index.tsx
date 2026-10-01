import { useState, useCallback, useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useRecipes } from '../../../stores/recipes';
import { useWizard } from '../../../contexts/WizardContext';
import { usePersonnesFoyer } from '../../../stores/foyer';
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
 // Un repas choisi part pour le nombre de personnes du foyer, sinon celui de la recette.
 const personnes=usePersonnesFoyer(),portions=(rec:Recipe)=>personnes??rec.servings_default??2;
 // La pastille du pied filtre les repas choisis ; plus rien à filtrer, on revoit tout.
 useEffect(()=>{if(!choisis.length)setSeuls(false);},[choisis.length]);
 const recettes=r.recettes.filter(r=>(!seuls||w.selectedRecipes[r.id]!=null)&&r.name.toLowerCase().includes(query.toLowerCase())&&(!rapides||((r.prep_minutes??0)+(r.cook_minutes??0)>0&&(r.prep_minutes??0)+(r.cook_minutes??0)<=30)));
 const columns=width>=360&&fontScale<1.4&&recettes.length>1?2:1;
 // Taille en points, pas en pourcentage + aspectRatio : dans une rangée qui
 // passe à la ligne, iOS réservait la place des tuiles mais les dessinait
 // hautes de 0 (constaté le 01/10/2026, React Native 0.86).
 const largeur=columns===2?Math.floor((width-40-10)/2):width-40,tuile={width:largeur,height:Math.round(columns===2?largeur*1.08:largeur/1.5)};
 return <SafeAreaView edges={session?[]:['top']} style={ui.screen}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}>
 <Head title="On mange quoi ?" avatar={false}/>
 {seuls&&<View style={ui.sectionRow}><Text style={ui.productName}>{choisis.length} repas choisi{choisis.length>1?'s':''}</Text><Pressable accessibilityRole="button" onPress={()=>setSeuls(false)} style={ui.iconButton}><Text style={ui.link}>Tout voir</Text></Pressable></View>}
 <TextInput value={query} onChangeText={setQuery} style={ui.input} placeholder="Une recette, une envie…" accessibilityLabel="Chercher une recette"/>
 {!seuls&&<View style={ui.sectionRow}><Pressable accessibilityRole="checkbox" accessibilityState={{checked:rapides}} aria-checked={rapides} onPress={()=>setRapides(!rapides)} style={{minHeight:44,padding:12,borderRadius:22,backgroundColor:rapides?colors.accent:colors.accentSoft,borderWidth:1,borderColor:rapides?colors.accent:colors.traitControle}}><Text style={{color:rapides?'white':'#48613A'}}>30 min ou moins</Text></Pressable><Text style={ui.detail}>{recettes.length} recette{recettes.length>1?'s':''}</Text></View>}
 {r.chargement&&<ActivityIndicator/>}{r.erreur&&<><Text style={ui.error}>{r.erreur}</Text><Action secondary onPress={r.recharger}>Réessayer</Action></>}
 <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>{recettes.map(rec=>{const parts=w.selectedRecipes[rec.id],temps=(rec.prep_minutes??0)+(rec.cook_minutes??0);return <View key={rec.id} style={[t.tuile,tuile]}>
  {/* La tuile ouvre l'aperçu ; le bouton rond du coin choisit ou retire. */}
  <Pressable accessibilityRole="button" accessibilityLabel={`Voir la recette ${rec.name}${temps?`, ${temps} min`:''}`} onPress={()=>session?setApercu(rec):router.push(`/recettes/${rec.id}`)} style={({pressed})=>[StyleSheet.absoluteFill,pressed&&{opacity:.9}]}>
   <Photo recipe name={rec.name} url={rec.image_url} style={t.photo}/>
   <View style={t.voile} pointerEvents="none">{VOILE.map((o,k)=><View key={k} style={{flex:1,backgroundColor:`rgba(20,28,16,${o})`}}/>)}</View>
   <View style={t.legende} pointerEvents="none"><Text style={t.nom} numberOfLines={2}>{rec.name}</Text>{temps>0&&<Text style={t.meta}>{temps} min</Text>}</View>
   {!!parts&&<View style={t.pers} pointerEvents="none"><Text style={t.persTexte}>{parts} pers.</Text></View>}
  </Pressable>
  {!!parts&&<View style={t.contour} pointerEvents="none"/>}
  <Pressable accessibilityRole="checkbox" accessibilityState={{checked:!!parts}} aria-checked={!!parts} accessibilityLabel={`Choisir ${rec.name}`} hitSlop={6} onPress={()=>w.toggleRecette(rec.id,portions(rec))} style={({pressed})=>[t.rond,parts?t.rondOn:null,pressed&&{opacity:.85}]}><Feather name={parts?'check':'plus'} size={18} color={parts?colors.accentContrast:colors.accent}/></Pressable>
 </View>})}</View>
 {!r.chargement&&!r.erreur&&!recettes.length&&<View style={ui.notice}><Text style={ui.productName}>Aucune recette trouvée.</Text><Text style={ui.subtitle}>Essaie un autre nom ou enlève le filtre de durée.</Text></View>}
 <View style={ui.sectionRow}><Text style={ui.detail}>Compléter ma collection</Text><Pressable accessibilityRole="button" style={ui.iconButton} onPress={()=>router.push('/recettes/nouvelle')}><Text style={ui.link}>Créer</Text></Pressable><Pressable accessibilityRole="button" style={ui.iconButton} onPress={()=>router.push('/recettes/importer')}><Text style={ui.link}>Importer</Text></Pressable></View>
 </ScrollView><View style={[ui.footer,ui.row,{gap:8}]}>
 {choisis.length>0&&<Pressable accessibilityRole="button" accessibilityLabel={`${choisis.length} repas choisi${choisis.length>1?'s':''}, ${seuls?'tout voir':'ne voir qu’eux'}`} accessibilityState={{selected:seuls}} onPress={()=>setSeuls(!seuls)} style={({pressed})=>[f.pastille,seuls&&f.pastilleOn,pressed&&{opacity:.7}]}><View style={ui.row}>{choisis.slice(0,2).map((rec,i)=><Photo key={rec.id} recipe name={rec.name} url={rec.image_url} style={[f.vignette,i>0&&{marginLeft:-18}]}/>)}</View><Text style={[ui.link,seuls&&{color:colors.accentContrast}]}>{choisis.length} repas</Text></Pressable>}
 <View style={{flex:1}}><Action onPress={()=>router.push(session?'/wizard/recap':'/wizard/recettes')}>{session?'Voir le bilan':'Préparer mes courses'}</Action></View></View>
 <ApercuRecette recette={apercu} parts={apercu?w.selectedRecipes[apercu.id]:undefined} onFermer={()=>setApercu(null)} onBasculer={()=>apercu&&w.toggleRecette(apercu.id,portions(apercu))} onParts={n=>apercu&&w.setParts(apercu.id,n)}/></SafeAreaView>
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

// Dégradé du bas de la tuile, en fines bandes : lisible sur toutes les photos, sans palier visible.
const VOILE=Array.from({length:16},(_,k)=>+(0.76*Math.pow(k/15,1.6)).toFixed(3));
/**
 * Tuile d'une recette à choisir : la photo d'abord, le nom posé dessus.
 * Choisie, elle prend un contour vert, une coche et le nombre de personnes.
 */
const t=StyleSheet.create({
 tuile:{borderRadius:16,overflow:'hidden',backgroundColor:colors.accentSoft},
 photo:{width:'100%',height:'100%',borderRadius:0},
 voile:{position:'absolute',left:0,right:0,bottom:0,height:'58%'},
 legende:{position:'absolute',left:10,right:10,bottom:10,gap:2},
 nom:{color:'white',fontSize:15,fontWeight:'700',lineHeight:19},
 meta:{color:'white',fontSize:12,fontWeight:'500'},
 pers:{position:'absolute',top:10,left:10,backgroundColor:'rgba(255,255,255,.95)',borderRadius:12,paddingHorizontal:8,paddingVertical:3},
 persTexte:{fontSize:12,fontWeight:'700',color:colors.text,fontVariant:['tabular-nums']},
 contour:{position:'absolute',top:0,left:0,right:0,bottom:0,borderRadius:16,borderWidth:3,borderColor:colors.accent},
 rond:{position:'absolute',top:6,right:6,width:44,height:44,borderRadius:22,backgroundColor:'white',alignItems:'center',justifyContent:'center',shadowColor:'#141C10',shadowOpacity:.22,shadowRadius:6,shadowOffset:{width:0,height:2},elevation:3},
 rondOn:{backgroundColor:colors.accent,borderWidth:2,borderColor:'white'},
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
