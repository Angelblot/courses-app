import { useState, useCallback } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useProducts, type Product } from '../../stores/products';
import { useWizard } from '../../contexts/WizardContext';
import { DetailProduit } from '../../components/DetailProduit';
import { Action, Head, Photo, ScanAction, ui } from '../../components/MaisonUI';
import { colors } from '../../lib/theme';
export default function Favoris(){
 const p=useProducts(),w=useWizard();const [query,setQuery]=useState(''),[all,setAll]=useState(false),[detail,setDetail]=useState<Product|null>(null),[notice,setNotice]=useState('');
 useFocusEffect(useCallback(()=>{p.recharger();},[p.recharger]));
 const produits=p.produits.filter(p=>(all||p.favorite)&&p.name.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')));
 return <SafeAreaView edges={['top']} style={ui.screen}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}><Head title="Mes favoris" back/><Action onPress={()=>router.push('/habitudes')}>Passer mes habitudes par rayon</Action><ScanAction/>
 <TextInput accessibilityLabel="Chercher un produit" style={ui.input} placeholder="Chercher un produit…" value={query} onChangeText={setQuery}/>
 <View style={ui.row}><View style={{flex:1}}><Action secondary={all} onPress={()=>setAll(false)}>Favoris</Action></View><View style={{flex:1}}><Action secondary={!all} onPress={()=>setAll(true)}>Tous les produits</Action></View></View>
 {notice&&<Text accessibilityLiveRegion="polite" style={ui.link}>{notice}</Text>}{p.chargement&&<ActivityIndicator color={colors.accent}/>}{p.erreur&&<><Text style={ui.error}>{p.erreur}</Text><Action secondary onPress={p.recharger}>Réessayer</Action></>}
 {produits.map(p=><View style={ui.product} key={p.id}><Pressable accessibilityRole="button" accessibilityLabel={`Consulter ${p.name}`} onPress={()=>setDetail(p)} style={[ui.row,{flex:1}]}><Photo name={p.name} url={p.image_url}/><View style={{flex:1}}><Text style={ui.productName}>{p.name}</Text><Text style={ui.detail}>{p.volume_ml?`${p.volume_ml} ml`:p.grammage_g?`${p.grammage_g} g`:p.brand}</Text></View></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Ajouter ${p.name} à la liste`} style={ui.add} onPress={()=>{w.ajouterProduitListe(p.id);setNotice(`${p.name} ajouté à ta liste`);}}><Feather name="plus" color="white" size={23}/></Pressable></View>)}
 {!p.chargement&&!produits.length&&!p.erreur&&<Text style={ui.subtitle}>Aucun produit ici. Scanne un produit ou ajoute-le à la main dans ta liste.</Text>}
 <Action onPress={()=>router.push('/liste')}>Voir ma liste</Action></ScrollView><DetailProduit produit={detail?p.produits.find(p=>p.id===detail.id)??detail:null} onFermer={()=>setDetail(null)} onChange={p.recharger}/></SafeAreaView>
}
