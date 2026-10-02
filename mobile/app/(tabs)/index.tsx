import { sources } from '../../components/Manques';
import { useEffect } from 'react';
import { ScrollView, Text, View, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../lib/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMaison } from '../../contexts/useMaison';
import { Head, Photo, Action, ui, useAnnulation } from '../../components/MaisonUI';
import { manquesDuBrouillon, manqueActif, SESSION_STEPS } from '../../lib/session-courses';
import { usePistes } from '../../stores/pistes';
export default function Maison(){
 const {w,p,r,loading,erreur}=useMaison();
 const manques=Object.entries(manquesDuBrouillon(w)).filter(([key])=>manqueActif(w,key));
 const annulation=useAnnulation();
 // Des pistes d'économie ou de meilleure note : un rappel discret, une ligne.
 const {pistes}=usePistes(w.compte),gainAn=pistes.reduce((t,x)=>t+Math.max(0,x.economieAn??0),0);
 // Des courses abandonnées depuis la pause s'annulent ici, quelques secondes.
 useEffect(()=>{if(!w.abandonEnAttente)return;annulation.proposer('Courses abandonnées. Tes manques restent notés.',w.annulerAbandon);w.oublierAbandon();},[w.abandonEnAttente]);
 return <SafeAreaView edges={['top']} style={ui.screen}><ScrollView contentContainerStyle={ui.content}>
 <Head title="Courses"/><Text style={ui.heading}>Les courses, à ton rythme.</Text><Text style={ui.subtitle}>Note ce qui manque au fil des jours. Prépare le reste quand tu es prêt.</Text>
 <View style={[ui.notice,{marginTop:8,gap:12,padding:20}]}><Text style={ui.section}>{w.sessionEtape?'Tes courses sont en cours.':'On prépare les prochaines courses ?'}</Text><Text style={ui.subtitle}>{w.sessionEtape?`Reprends à l’étape « ${SESSION_STEPS.find(s=>s.cle===w.sessionEtape)?.label} ». Tes choix sont conservés.`:'Choisis tes repas : tes manques et tes habitudes t’attendent déjà dans le bilan.'}</Text><Action onPress={()=>{w.demarrerSession();router.navigate(`/wizard/${w.sessionEtape??'recettes'}`);}}>{w.sessionEtape?'Reprendre mes courses':'Préparer mes courses'}</Action></View>
 {pistes.length>0&&<Pressable accessibilityRole="button" accessibilityLabel={`${pistes.length} piste${pistes.length>1?'s':''}${gainAn>=1?`, environ ${gainAn} euros par an`:''}. Voir`} onPress={()=>router.push('/pistes')} style={({pressed})=>[ui.product,a.pistes,pressed&&{opacity:.85}]}>
  <View style={a.pistesIcone}><Feather name="trending-down" size={20} color="#2F6B2F"/></View>
  <View style={{flex:1}}><Text style={ui.productName}>{pistes.length} piste{pistes.length>1?'s':''} pour tes prochaines courses</Text><Text style={ui.detail}>{gainAn>=1?`Environ ${gainAn} € par an, d’après les prix vus sur tes drives`:'Des produits mieux notés, d’après les prix vus sur tes drives'}</Text></View>
  <Feather name="chevron-right" size={18} color={colors.textMuted}/>
 </Pressable>}
 <View style={ui.sectionRow}><Text style={ui.section}>Mes manques</Text>{manques.length>0&&<Pressable accessibilityRole="button" accessibilityLabel={`Tout voir, ${manques.length} produit${manques.length>1?'s':''}`} onPress={()=>router.push('/manques')} style={[ui.iconButton,{marginTop:14}]}><Text style={ui.link}>Tout voir</Text></Pressable>}</View>
 {loading&&<ActivityIndicator/>}{erreur&&<><Text style={ui.error}>{erreur}</Text><Action secondary onPress={()=>{p.recharger();r.recharger();}}>Réessayer</Action></>}{w.sauvegardeErreur&&<Text style={ui.error}>{w.sauvegardeErreur}</Text>}
 {manques.slice(0,4).map(([key,m])=>{const id=key.startsWith('produit:')?key.slice(8):undefined,prod=p.produits.find(p=>p.id===id),extra=w.extras.find(x=>`extra:${x.id}`===key);const nom=prod?.name??extra?.name??m.name,qty=id?w.quotidienQty[id]??1:extra?.quantity??1;return <Pressable key={key} accessibilityRole="button" accessibilityLabel={`${nom}, ${qty} article${qty>1?'s':''}. Modifier`} onPress={()=>router.push('/manques')} style={({pressed})=>[ui.product,pressed&&{opacity:.85}]}><Photo name={nom} url={prod?.image_url}/><View style={{flex:1}}><Text style={ui.productName}>{nom}</Text><Text style={ui.detail}>{sources[m.source]??'Noté'}</Text></View><Text style={ui.num}>× {qty}</Text><Feather name="chevron-right" size={18} color={colors.textMuted}/></Pressable>})}
 {!loading&&!manques.length&&<Text style={ui.subtitle}>Rien de noté pour le moment. Le prochain produit ajouté au widget apparaîtra ici.</Text>}
 <Pressable accessibilityRole="button" accessibilityLabel="Noter un manque…" onPress={()=>router.push('/ajout')} style={({pressed})=>[ui.product,a.noter,pressed&&{opacity:.85}]}><Feather name="plus" size={22} color={colors.accent}/><Text style={ui.link}>Noter un manque…</Text></Pressable>
 </ScrollView><View style={{marginBottom:8}}>{annulation.toast}</View></SafeAreaView>;
}
const a=StyleSheet.create({ noter:{minHeight:56,paddingLeft:18,gap:12}, pistes:{gap:12,marginTop:4}, pistesIcone:{width:40,height:40,borderRadius:12,backgroundColor:'#E4EFDC',alignItems:'center',justifyContent:'center'} });
