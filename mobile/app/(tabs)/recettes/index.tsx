import { useState, useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useRecipes } from '../../../stores/recipes';
import { useWizard } from '../../../contexts/WizardContext';
import { Photo, Action, Head, ui } from '../../../components/MaisonUI';
export default function Recettes(){
 const r=useRecipes(),w=useWizard(),{width,fontScale}=useWindowDimensions();const [query,setQuery]=useState(''),[tab,setTab]=useState<'choisir'|'menu'>('choisir'),[rapides,setRapides]=useState(false);
 useFocusEffect(useCallback(()=>{r.recharger();},[r.recharger]));
 const choisis=r.recettes.filter(r=>w.selectedRecipes[r.id]!=null);
 const recettes=r.recettes.filter(r=>(tab==='choisir'||w.selectedRecipes[r.id]!=null)&&r.name.toLowerCase().includes(query.toLowerCase())&&(!rapides||((r.prep_minutes??0)+(r.cook_minutes??0)>0&&(r.prep_minutes??0)+(r.cook_minutes??0)<=30)));
 const columns=width>=360&&fontScale<1.4&&tab==='choisir'&&recettes.length>1?2:1;
 return <SafeAreaView edges={['top']} style={ui.screen}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}>
 <Head title="On mange quoi ?"/><Text style={ui.subtitle}>Choisis tes repas. Les ingrédients rejoignent ta liste déjà commencée.</Text>
 <View style={ui.row}>{(['choisir','menu'] as const).map(t=><Pressable key={t} accessibilityRole="tab" accessibilityState={{selected:tab===t}} onPress={()=>{setTab(t);setQuery('');setRapides(false);}} style={{flex:1,minHeight:48,borderBottomWidth:tab===t?3:1,borderBottomColor:tab===t?'#48613A':'#DCE1D6',justifyContent:'center'}}><Text style={[ui.link,{textAlign:'center'}]}>{t==='choisir'?'Choisir des recettes':`Mes repas (${choisis.length})`}</Text></Pressable>)}</View>
 <TextInput value={query} onChangeText={setQuery} style={ui.input} placeholder="Une recette, une envie…" accessibilityLabel="Chercher une recette"/>
 {tab==='choisir'&&<View style={ui.sectionRow}><Pressable accessibilityRole="checkbox" accessibilityState={{checked:rapides}} onPress={()=>setRapides(!rapides)} style={{minHeight:44,padding:12,borderRadius:22,backgroundColor:rapides?'#48613A':'#E4EBDC'}}><Text style={{color:rapides?'white':'#48613A'}}>30 min ou moins</Text></Pressable><Text style={ui.detail}>{recettes.length} recettes</Text></View>}
 {r.chargement&&<ActivityIndicator/>}{r.erreur&&<><Text style={ui.error}>{r.erreur}</Text><Action secondary onPress={r.recharger}>Réessayer</Action></>}
 <View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>{recettes.map(rec=>{const parts=w.selectedRecipes[rec.id],temps=(rec.prep_minutes??0)+(rec.cook_minutes??0);return <View key={rec.id} style={{width:columns===2?'48%':'100%',backgroundColor:'white',borderRadius:14,overflow:'hidden'}}>
 <Pressable accessibilityRole="button" accessibilityLabel={`Voir la recette ${rec.name}`} onPress={()=>router.push(`/recettes/${rec.id}`)}><Photo recipe name={rec.name} url={rec.image_url} style={{width:'100%',height:columns===2?135:175,borderRadius:0}}/></Pressable>
 <View style={{padding:12,gap:10,flex:1}}><Text style={[ui.productName,{minHeight:40}]}>{rec.name}</Text><View style={ui.row}><Feather name="clock" size={13} color="#656D60"/><Text style={ui.detail}>{temps?`${temps} min`:'Durée non renseignée'}</Text></View>
 {parts?<><View style={[ui.counter,{justifyContent:'space-between'}]}><Pressable accessibilityRole="button" accessibilityLabel={`Moins de portions pour ${rec.name}`} style={ui.iconButton} onPress={()=>w.setParts(rec.id,parts-1)}><Text style={ui.title}>−</Text></Pressable><Text style={ui.num}>{parts}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Plus de portions pour ${rec.name}`} style={ui.iconButton} onPress={()=>w.setParts(rec.id,parts+1)}><Text style={ui.title}>+</Text></Pressable></View><Text style={[ui.detail,{textAlign:'center'}]}>personnes</Text><Action secondary onPress={()=>w.toggleRecette(rec.id,rec.servings_default)}>Retirer du menu</Action></>:<View style={{marginTop:'auto'}}><Action secondary onPress={()=>w.toggleRecette(rec.id,rec.servings_default)}>+ Choisir</Action></View>}</View>
 </View>})}</View>
 {!r.chargement&&!r.erreur&&!recettes.length&&<View style={ui.notice}><Text style={ui.productName}>{tab==='menu'?'Ton menu est encore ouvert.':'Aucune recette trouvée.'}</Text><Text style={ui.subtitle}>{tab==='menu'?'Choisis quelques repas, ou passe directement aux produits habituels.':'Essaie un autre nom ou enlève le filtre de durée.'}</Text>{tab==='menu'&&<Action secondary onPress={()=>setTab('choisir')}>Choisir mes repas</Action>}</View>}
 <View style={ui.sectionRow}><Text style={ui.detail}>Compléter ma collection</Text><Pressable accessibilityRole="button" style={ui.iconButton} onPress={()=>router.push('/recettes/nouvelle')}><Text style={ui.link}>Créer</Text></Pressable><Pressable accessibilityRole="button" style={ui.iconButton} onPress={()=>router.push('/recettes/importer')}><Text style={ui.link}>Importer</Text></Pressable></View>
 </ScrollView><View style={ui.footer}><Text accessibilityLiveRegion="polite" style={ui.detail}>{choisis.length} repas choisi{choisis.length>1?'s':''} · tes ajouts quotidiens restent dans la liste</Text><Action onPress={()=>router.push('/habitudes')}>{choisis.length?'Continuer avec mes habitudes':'Passer aux produits habituels'}</Action><Pressable accessibilityRole="button" style={{minHeight:44,justifyContent:'center'}} onPress={()=>router.push('/liste')}><Text style={[ui.link,{textAlign:'center'}]}>Voir ma liste complète</Text></Pressable></View></SafeAreaView>
}
