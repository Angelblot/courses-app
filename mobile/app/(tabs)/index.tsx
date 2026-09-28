import { ScrollView, Text, View, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../lib/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMaison } from '../../contexts/useMaison';
import { Head, Photo, Action, ui } from '../../components/MaisonUI';
import { manquesDuBrouillon, manqueActif, SESSION_STEPS } from '../../lib/session-courses';
export default function Maison(){
 const {w,p,r,loading,erreur}=useMaison();
 const manques=Object.entries(manquesDuBrouillon(w)).filter(([key])=>manqueActif(w,key));
 return <SafeAreaView edges={['top']} style={ui.screen}><ScrollView contentContainerStyle={ui.content}>
 <Head title="Courses"/><Text style={ui.heading}>Les courses, à ton rythme.</Text><Text style={ui.subtitle}>Note ce qui manque au fil des jours. Prépare le reste quand tu es prêt.</Text>
 <View style={[ui.notice,{marginTop:8,gap:12,padding:20}]}><Text style={ui.section}>{w.sessionEtape?'Ta session est en cours.':'On prépare les prochaines courses ?'}</Text><Text style={ui.subtitle}>{w.sessionEtape?`Reprends à l’étape « ${SESSION_STEPS.find(s=>s.cle===w.sessionEtape)?.label} ». Tes choix sont conservés.`:'Choisis tes repas, vérifie tes manques et passe tes habitudes en revue.'}</Text><Action onPress={()=>{w.demarrerSession();router.push(`/wizard/${w.sessionEtape??'recettes'}`);}}>{w.sessionEtape?'Reprendre ma session':'Commencer une session'}</Action></View>
 <View style={ui.sectionRow}><Text style={ui.section}>Ce qu’il me manque</Text>{manques.length>0&&<Pressable accessibilityRole="button" accessibilityLabel={`Tout voir, ${manques.length} produit${manques.length>1?'s':''}`} onPress={()=>router.push('/manques')} style={[ui.iconButton,{marginTop:14}]}><Text style={ui.link}>Tout voir</Text></Pressable>}</View>
 {loading&&<ActivityIndicator/>}{erreur&&<><Text style={ui.error}>{erreur}</Text><Action secondary onPress={()=>{p.recharger();r.recharger();}}>Réessayer</Action></>}{w.sauvegardeErreur&&<Text style={ui.error}>{w.sauvegardeErreur}</Text>}
 {manques.slice(0,4).map(([key,m])=>{const id=key.startsWith('produit:')?key.slice(8):undefined,prod=p.produits.find(p=>p.id===id),extra=w.extras.find(x=>`extra:${x.id}`===key);const nom=prod?.name??extra?.name??m.name,qty=id?w.quotidienQty[id]??1:extra?.quantity??1;return <Pressable key={key} accessibilityRole="button" accessibilityLabel={`${nom}, ${qty} article${qty>1?'s':''}. Modifier`} onPress={()=>router.push('/manques')} style={({pressed})=>[ui.product,pressed&&{opacity:.85}]}><Photo name={nom} url={prod?.image_url}/><View style={{flex:1}}><Text style={ui.productName}>{nom}</Text><Text style={ui.detail}>{m.source==='widget'?'Widget':m.source==='siri'?'Siri':'Noté pour les courses'}</Text></View><Text style={ui.num}>× {qty}</Text><Feather name="chevron-right" size={18} color={colors.textMuted}/></Pressable>})}
 {!loading&&!manques.length&&<Text style={ui.subtitle}>Rien de noté pour le moment. Le prochain produit ajouté au widget apparaîtra ici.</Text>}
 <Pressable accessibilityRole="button" accessibilityLabel="Noter un produit…" onPress={()=>router.push('/ajout')} style={({pressed})=>[ui.product,a.noter,pressed&&{opacity:.85}]}><Feather name="plus" size={22} color={colors.accent}/><Text style={ui.link}>Noter un produit…</Text></Pressable>
 </ScrollView></SafeAreaView>;
}
const a=StyleSheet.create({ noter:{minHeight:56,paddingLeft:18,gap:12} });
