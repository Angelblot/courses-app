import { ScrollView, Text, View, ActivityIndicator } from 'react-native';
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
 <View style={ui.sectionRow}><Text style={ui.section}>Ce qu’il me manque</Text><Text style={ui.detail}>{manques.length} produit{manques.length>1?'s':''}</Text></View>
 <Text style={ui.detail}>Depuis le widget, Siri ou tes ajouts dans l’app.</Text>
 {loading&&<ActivityIndicator/>}{erreur&&<><Text style={ui.error}>{erreur}</Text><Action secondary onPress={()=>{p.recharger();r.recharger();}}>Réessayer</Action></>}{w.sauvegardeErreur&&<Text style={ui.error}>{w.sauvegardeErreur}</Text>}
 {manques.slice(0,4).map(([key,m])=>{const id=key.startsWith('produit:')?key.slice(8):undefined,prod=p.produits.find(p=>p.id===id),extra=w.extras.find(x=>`extra:${x.id}`===key);return <View key={key} style={ui.product}><Photo name={prod?.name??m.name} url={prod?.image_url}/><View style={{flex:1}}><Text style={ui.productName}>{prod?.name??extra?.name??m.name}</Text><Text style={ui.detail}>{m.source==='widget'?'Widget':m.source==='siri'?'Siri':'Noté pour les courses'}</Text></View><Text style={ui.num}>× {id?w.quotidienQty[id]??1:extra?.quantity??1}</Text></View>})}
 {!loading&&!manques.length&&<Text style={ui.subtitle}>Rien de noté pour le moment. Le prochain produit ajouté au widget apparaîtra ici.</Text>}
 {manques.length>0&&<Action secondary onPress={()=>router.push('/manques')}>Voir mes manques</Action>}
 <Action secondary onPress={()=>router.push('/ajout')}>Noter un produit manquant</Action>
 </ScrollView></SafeAreaView>;
}
