import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SESSION_STEPS, type SessionStep } from '../lib/session-courses';
import { ui } from './MaisonUI';
import { colors } from '../lib/theme';
export function SessionProgress({step}:{step:SessionStep}) {
 const index=SESSION_STEPS.findIndex(s=>s.cle===step);
 return <SafeAreaView edges={['top']} style={{backgroundColor:colors.bg}}>
 <View style={{paddingHorizontal:20,paddingTop:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={ui.detail}>Session de courses · {index+1} sur 5</Text><Pressable accessibilityRole="button" onPress={()=>router.replace('/')} style={{minHeight:44,justifyContent:'center'}}><Text style={ui.link}>Faire une pause</Text></Pressable></View>
 <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:20,gap:14,paddingBottom:8}}>{SESSION_STEPS.map((s,i)=><Pressable key={s.cle} accessibilityRole="button" accessibilityState={{selected:s.cle===step,disabled:i>index}} disabled={i>index} onPress={()=>router.replace(`/wizard/${s.cle}`)} style={{minHeight:44,justifyContent:'center',borderBottomWidth:s.cle===step?2:0,borderBottomColor:colors.accent}}><Text style={{color:i<=index?colors.accent:colors.textMuted,fontWeight:s.cle===step?'700':'400'}}>{s.label}</Text></Pressable>)}</ScrollView>
 </SafeAreaView>;
}
