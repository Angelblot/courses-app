import { useState, useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useRecipes } from '../../../stores/recipes';
import { useWizard } from '../../../contexts/WizardContext';
import { Photo, Action, Head, ui } from '../../../components/MaisonUI';
import { colors } from '../../../lib/theme';
export default function Recettes(){
 const r=useRecipes(),w=useWizard();const [query,setQuery]=useState('');
 useFocusEffect(useCallback(()=>{r.recharger();},[r.recharger]));
 const recettes=r.recettes.filter(r=>r.name.toLowerCase().includes(query.toLowerCase()));
 return <SafeAreaView edges={['top']} style={ui.screen}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}><Head title="Mes recettes"/><Text style={ui.subtitle}>Choisis tes repas, ta liste suit.</Text>
 <TextInput value={query} onChangeText={setQuery} style={ui.input} placeholder="Chercher une recette…" accessibilityLabel="Chercher une recette"/>
 {r.chargement&&<ActivityIndicator color={colors.accent}/>}{r.erreur&&<><Text style={ui.error}>{r.erreur}</Text><Action secondary onPress={r.recharger}>Réessayer</Action></>}
 {recettes.map(rec=>{const parts=w.selectedRecipes[rec.id],temps=(rec.prep_minutes??0)+(rec.cook_minutes??0);return <View key={rec.id} style={{backgroundColor:'white',borderRadius:14,overflow:'hidden'}}><Pressable accessibilityRole="button" accessibilityLabel={`Ouvrir ${rec.name}`} onPress={()=>router.push(`/recettes/${rec.id}`)}><Photo recipe name={rec.name} url={rec.image_url} style={{width:'100%',height:180,borderRadius:0}}/></Pressable><View style={{padding:14,gap:10}}><Text style={ui.section}>{rec.name}</Text><Text style={ui.detail}>{temps?`${temps} min · `:''}{rec.servings_default} personnes</Text>{parts?<><View style={ui.sectionRow}><Text style={ui.link}>Au menu</Text><View style={ui.counter}><Pressable accessibilityRole="button" accessibilityLabel={`Moins de portions pour ${rec.name}`} style={ui.iconButton} onPress={()=>w.setParts(rec.id,parts-1)}><Text style={ui.title}>−</Text></Pressable><Text style={ui.num}>{parts}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Plus de portions pour ${rec.name}`} style={ui.iconButton} onPress={()=>w.setParts(rec.id,parts+1)}><Text style={ui.title}>+</Text></Pressable></View></View><Action secondary onPress={()=>w.toggleRecette(rec.id,rec.servings_default)}>Retirer du menu</Action></>:<Action secondary onPress={()=>w.toggleRecette(rec.id,rec.servings_default)}>Ajouter aux repas</Action>}</View></View>})}
 {!r.chargement&&!r.erreur&&!recettes.length&&<Text style={ui.subtitle}>Aucune recette trouvée. Crée une recette ou importe un lien.</Text>}
 <View style={ui.row}><View style={{flex:1}}><Action secondary onPress={()=>router.push('/recettes/importer')}>Importer un lien</Action></View><View style={{flex:1}}><Action secondary onPress={()=>router.push('/recettes/nouvelle')}>Créer une recette</Action></View></View>
 </ScrollView><View style={ui.footer}><Action onPress={()=>router.push('/liste')}>Voir ma liste · {Object.keys(w.selectedRecipes).length} repas</Action></View></SafeAreaView>
}
