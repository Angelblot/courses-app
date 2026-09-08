import { ImageBackground, Pressable, ScrollView, Text, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useMaison } from '../../contexts/useMaison';
import { Head, Photo, ScanAction, Action, ui } from '../../components/MaisonUI';
import { colors } from '../../lib/theme';
export default function Maison(){
 const {w,p,r,acheter,loading,erreur}=useMaison();
 const mois=new Intl.DateTimeFormat('fr-FR',{month:'long'}).format(new Date());
 return <SafeAreaView edges={['top']} style={ui.screen}><ScrollView contentContainerStyle={ui.content}>
 <Head title="Courses"/><Text style={ui.heading}>On prépare les courses ?</Text><Text style={ui.subtitle}>Ta liste de {mois}</Text>
 {erreur?<View><Text style={ui.error}>{erreur}</Text><Action secondary onPress={()=>{p.recharger();r.recharger();}}>Réessayer</Action></View>:null}
 {w.sauvegardeErreur&&<Text style={ui.error}>{w.sauvegardeErreur}</Text>}
 <ImageBackground source={require('../../assets/tablee/grocery-banner.webp')} imageStyle={{borderRadius:16}} resizeMode="cover" style={{height:210,width:'100%',justifyContent:'center',padding:18,borderRadius:16,overflow:'hidden'}}>
 <View style={{alignSelf:'flex-start',backgroundColor:'#F5F7F2E8',borderRadius:12,padding:12,maxWidth:'74%',gap:8}}>
 {loading?<ActivityIndicator color={colors.accent}/>:<Text style={[ui.heading,{fontSize:30}]}>{acheter.length} article{acheter.length>1?'s':''}</Text>}
 <Text style={ui.detail}>Dans ta liste en cours</Text><Action onPress={()=>router.push('/liste')}>{acheter.length?'Reprendre ma liste':'Commencer ma liste'}</Action></View>
 </ImageBackground><ScanAction/>
 <View style={ui.sectionRow}><Text style={ui.section}>À reprendre d’habitude</Text><Pressable accessibilityRole="button" style={ui.iconButton} onPress={()=>router.push('/favoris')}><Text style={ui.link}>Tout voir</Text></Pressable></View>
 {p.produits.filter(p=>p.favorite).slice(0,3).map(p=><View key={p.id} style={ui.product}><Photo name={p.name} url={p.image_url}/><View style={{flex:1}}><Text style={ui.productName}>{p.name}</Text><Text style={ui.detail}>{p.volume_ml?`${p.volume_ml} ml`:p.grammage_g?`${p.grammage_g} g`:p.brand}</Text>{w.quotidien[p.id]==='needed'&&<Text style={ui.detail}>{w.quotidienQty[p.id]??1} demandé{(w.quotidienQty[p.id]??1)>1?'s':''}</Text>}</View><Pressable accessibilityRole="button" accessibilityLabel={`Ajouter ${p.name} à ma liste`} onPress={()=>w.ajouterProduitListe(p.id)} style={ui.add}><Feather name="plus" size={24} color="white"/></Pressable></View>)}
 {!loading&&!erreur&&!p.produits.some(p=>p.favorite)&&<Text style={ui.subtitle}>Scanne un produit pour enregistrer ton premier favori.</Text>}
 <Action secondary onPress={()=>router.push('/favoris')}>Rechercher ou ajouter un produit</Action>
 </ScrollView></SafeAreaView>
}
