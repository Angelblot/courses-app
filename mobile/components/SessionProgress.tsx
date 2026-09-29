import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PauseSheet } from './PauseSheet';
import { router } from 'expo-router';
// Ionicons pour la pause : les deux barres pleines se reconnaissent, là où
// les rectangles à contour de Feather se lisaient comme une petite boîte.
import { Feather, Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SESSION_STEPS, type SessionStep } from '../lib/session-courses';
import { ui } from './MaisonUI';
import { colors } from '../lib/theme';
/**
 * En-tête de session : une ligne d'étape, une pause, une barre en cinq
 * segments. Les segments déjà atteints ramènent à leur étape.
 *
 * Navigation : chaque étape s'empile sur la précédente, si bien que le
 * retour (geste iOS, bouton Android) ramène toujours à l'étape d'avant.
 * Un segment dépile jusqu'à son étape ; la pause ouvre une feuille pour
 * finir plus tard ou abandonner, et vide la pile dans les deux cas.
 */
export function SessionProgress({step}:{step:SessionStep}) {
 const index=SESSION_STEPS.findIndex(s=>s.cle===step),[pause,setPause]=useState(false);
 return <SafeAreaView edges={['top']} style={{backgroundColor:colors.bg,paddingHorizontal:20,paddingBottom:4}}>
 <View style={[ui.sectionRow,{minHeight:52}]}>
  <Text accessibilityRole="header" style={[ui.detail,{marginTop:0,fontVariant:['tabular-nums']}]}>Étape {index+1} sur {SESSION_STEPS.length} · {SESSION_STEPS[index].label}</Text>
  <Pressable accessibilityRole="button" accessibilityLabel="Faire une pause" onPress={()=>setPause(true)} style={({pressed})=>[s.pause,pressed&&{opacity:.7}]}><Ionicons name="pause" size={20} color={colors.accent}/></Pressable>
 </View>
 <View style={s.barre}>{SESSION_STEPS.map((e,i)=><Pressable key={e.cle} accessibilityRole="button" accessibilityLabel={`Étape ${i+1} sur ${SESSION_STEPS.length} : ${e.label}`} accessibilityState={{selected:i===index,disabled:i>index}} disabled={i>index} hitSlop={{top:14,bottom:14}} onPress={()=>{if(i<index)router.dismissTo(`/wizard/${e.cle}`);}} style={s.segment}><View style={[s.trait,i<=index&&{backgroundColor:colors.accent}]}/></Pressable>)}</View>
 <PauseSheet visible={pause} onFermer={()=>setPause(false)}/>
 </SafeAreaView>;
}
const s=StyleSheet.create({
 pause:{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:colors.surface,borderWidth:1,borderColor:colors.traitControle},
 barre:{flexDirection:'row',gap:4,paddingVertical:6},
 segment:{flex:1,justifyContent:'center'},
 trait:{height:4,borderRadius:2,backgroundColor:colors.border},
});

/** Revient au bilan : `back` quand on y vient de là, sinon on le remplace. */
export const revenirAuBilan=()=>router.canGoBack()?router.back():router.replace('/wizard/recap');

/**
 * En-tête d'une correction (Manques, Habitudes, Extras) ouverte depuis le
 * bilan : un retour au bilan à gauche, la pause à droite, pas de barre
 * d'étapes puisque ce ne sont plus des étapes.
 */
export function EnteteCorrection(){
 const [pause,setPause]=useState(false);
 return <SafeAreaView edges={['top']} style={{backgroundColor:colors.bg,paddingHorizontal:12,paddingBottom:4}}>
 <View style={[ui.sectionRow,{minHeight:52}]}>
  <Pressable accessibilityRole="button" accessibilityLabel="Revenir au bilan" onPress={revenirAuBilan} style={({pressed})=>[ui.row,{minHeight:44,gap:2,paddingRight:8},pressed&&{opacity:.7}]}><Feather name="chevron-left" size={24} color={colors.accent}/><Text style={ui.link}>Bilan</Text></Pressable>
  <Pressable accessibilityRole="button" accessibilityLabel="Faire une pause" onPress={()=>setPause(true)} style={({pressed})=>[s.pause,pressed&&{opacity:.7}]}><Ionicons name="pause" size={20} color={colors.accent}/></Pressable>
 </View>
 <PauseSheet visible={pause} onFermer={()=>setPause(false)}/>
 </SafeAreaView>;
}
