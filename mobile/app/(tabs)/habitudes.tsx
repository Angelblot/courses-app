import { useRecipes } from '../../stores/recipes';
import { listeMaison } from '../../lib/liste-maison';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, Text, View, ActivityIndicator, AccessibilityInfo } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Head, Photo, Action, ui } from '../../components/MaisonUI';
import { useProducts } from '../../stores/products';
import { useWizard } from '../../contexts/WizardContext';
import { RAYONS, rayonDepuisLibelle } from '../../lib/rayons';
import { nombreArticles } from '../../lib/ajouts-quotidiens';
export default function Habitudes(){
 const p=useProducts(),r=useRecipes(),w=useWizard();useFocusEffect(useCallback(()=>{p.recharger();},[p.recharger]));
 const categories=RAYONS.filter(c=>p.produits.some(p=>p.favorite&&rayonDepuisLibelle(p.category)===c.cle));
 const [rayon,setRayon]=useState(''),[qty,setQty]=useState(1),[notice,setNotice]=useState(''),[reduce,setReduce]=useState(false);
 const cat=categories.find(c=>c.cle===rayon)??categories[0];
 const items=p.produits.filter(p=>p.favorite&&rayonDepuisLibelle(p.category)===cat?.cle);
 const produit=items.find(p=>!w.habitudesVues?.[p.id]);const faits=items.filter(p=>w.habitudesVues?.[p.id]).length;
 const ligne=produit?listeMaison(w,r.recettes,p.produits).find(l=>l.product_id===produit.id):undefined;
 const quantiteInitiale=ligne?.totalQuantity??(produit?w.quotidienQty[produit.id]??1:1);
 const x=useRef(new Animated.Value(0)).current,lock=useRef(false),action=useRef((acheter:boolean)=>{});
 useEffect(()=>{AccessibilityInfo.isReduceMotionEnabled().then(setReduce);const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduce);return()=>sub.remove();},[]);
 useEffect(()=>{setQty(nombreArticles(quantiteInitiale));x.setValue(0);lock.current=false;},[produit?.id,quantiteInitiale,x]);
 action.current=(acheter)=>{if(!produit||lock.current)return;lock.current=true;const fin=()=>{w.deciderHabituel(produit.id,qty,acheter);setNotice(acheter?`${qty} × ${produit.name} retenu${qty>1?'s':''}`:`${produit.name} : déjà chez moi`);x.setValue(0);lock.current=false;};if(reduce)fin();else Animated.timing(x,{toValue:acheter?450:-450,duration:180,useNativeDriver:true}).start(({finished})=>{if(finished)fin();else lock.current=false;});};
 const pan=useRef(PanResponder.create({onMoveShouldSetPanResponder:(_,g)=>Math.abs(g.dx)>14&&Math.abs(g.dx)>Math.abs(g.dy)*1.5,onPanResponderMove:(_,g)=>{if(!lock.current)x.setValue(g.dx);},onPanResponderRelease:(_,g)=>{if(Math.abs(g.dx)>85)action.current(g.dx>0);else Animated.spring(x,{toValue:0,useNativeDriver:true}).start();},onPanResponderTerminate:()=>Animated.spring(x,{toValue:0,useNativeDriver:true}).start()})).current;
 const suivant=categories[categories.findIndex(c=>c.cle===cat?.cle)+1];
 return <SafeAreaView edges={['top']} style={ui.screen}><View style={{padding:20,paddingBottom:8}}><Head title="Mes habitudes" back/><Text style={ui.subtitle}>Un rayon à la fois. Ajuste la quantité, puis fais glisser la carte.</Text></View>
 <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingHorizontal:20,paddingBottom:12}}>{categories.map(c=><Pressable key={c.cle} accessibilityRole="tab" accessibilityState={{selected:cat?.cle===c.cle}} onPress={()=>{setRayon(c.cle);setNotice('');}} style={{backgroundColor:cat?.cle===c.cle?'#48613A':'#E4EBDC',borderRadius:20,padding:12}}><Text style={{color:cat?.cle===c.cle?'white':'#48613A',fontWeight:'600'}}>{c.label}</Text></Pressable>)}</ScrollView></View>
 <ScrollView contentContainerStyle={[ui.content,{paddingTop:4,flexGrow:1}]}>
 {p.chargement&&<ActivityIndicator/>}{p.erreur&&<><Text style={ui.error}>{p.erreur}</Text><Action secondary onPress={p.recharger}>Réessayer</Action></>}
 {cat&&<Text style={ui.detail}>{faits} sur {items.length} passés en revue · {cat.label}</Text>}
 {!!notice&&<Text accessibilityLiveRegion="polite" style={ui.link}>{notice}</Text>}
 {produit?<><Animated.View {...pan.panHandlers} style={{backgroundColor:'white',borderRadius:16,padding:20,gap:12,transform:[{translateX:x},{rotate:x.interpolate({inputRange:[-400,0,400],outputRange:['-8deg','0deg','8deg']})}]}}><Photo name={produit.name} url={produit.image_url} style={{width:'100%',height:140}}/><Text style={[ui.heading,{fontSize:24}]}>{produit.name}</Text><Text style={ui.subtitle}>{[produit.brand,produit.grammage_g?`${produit.grammage_g} g`:produit.volume_ml?`${produit.volume_ml} ml`:null].filter(Boolean).join(' · ')}</Text>{ligne?.besoin&&<Text style={ui.detail}>{ligne.besoin}</Text>}{w.quotidien[produit.id]==='needed'&&<Text style={ui.link}>Déjà noté dans ta liste : {quantiteInitiale}</Text>}</Animated.View>
 <View style={ui.sectionRow}><Text style={ui.productName}>Quantité à acheter</Text><View style={ui.counter}><Pressable accessibilityRole="button" accessibilityLabel="Diminuer la quantité" style={ui.iconButton} onPress={()=>setQty(nombreArticles(qty-1))}><Text style={ui.title}>−</Text></Pressable><Text style={ui.num}>{qty}</Text><Pressable accessibilityRole="button" accessibilityLabel="Augmenter la quantité" style={ui.iconButton} onPress={()=>setQty(nombreArticles(qty+1))}><Text style={ui.title}>+</Text></Pressable></View></View>
 <View style={ui.row}><View style={{flex:1}}><Action secondary onPress={()=>action.current(false)}>← J’en ai déjà</Action></View><View style={{flex:1}}><Action onPress={()=>action.current(true)}>Il m’en faut {qty} →</Action></View></View><Text style={ui.detail}>À gauche : déjà chez moi. À droite : à acheter.</Text></>:cat?<><Text style={ui.heading}>Ce rayon est prêt.</Text><Text style={ui.subtitle}>Tes choix sont conservés. Tu peux passer au rayon suivant ou les revoir.</Text>{suivant&&<Action onPress={()=>setRayon(suivant.cle)}>Passer à {suivant.label}</Action>}<Action secondary onPress={()=>w.revoirHabitudes(items.map(p=>p.id))}>Revoir ce rayon</Action></>:!p.chargement&&!p.erreur?<><Text style={ui.heading}>Tes habitudes commencent ici.</Text><Text style={ui.subtitle}>Enregistre tes produits préférés avec le scanner.</Text><Action onPress={()=>router.push('/scan')}>Scanner un premier favori</Action></>:null}
 </ScrollView><View style={ui.footer}><Pressable accessibilityRole="button" onPress={()=>router.push('/ajout')} style={{minHeight:40,justifyContent:'center'}}><Text style={[ui.link,{textAlign:'center'}]}>Chercher un produit exceptionnel</Text></Pressable><Action onPress={()=>router.push('/liste')}>Vérifier ma liste</Action></View></SafeAreaView>
}
