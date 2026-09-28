import { instantaneHabitude, manqueActif } from '../../lib/session-courses';
import { useRecipes } from '../../stores/recipes';
import { listeMaison } from '../../lib/liste-maison';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, ActivityIndicator, AccessibilityInfo } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../lib/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Head, Photo, Action, ui, useAnnulation } from '../../components/MaisonUI';
import { useProducts } from '../../stores/products';
import { useWizard } from '../../contexts/WizardContext';
import { RAYONS, rayonDepuisLibelle } from '../../lib/rayons';
import { nombreArticles } from '../../lib/ajouts-quotidiens';
export default function Habitudes({session=false}:{session?:boolean}){
 const p=useProducts(),r=useRecipes(),w=useWizard();useFocusEffect(useCallback(()=>{p.recharger();},[p.recharger]));
 const categories=RAYONS.filter(c=>p.produits.some(p=>p.favorite&&rayonDepuisLibelle(p.category)===c.cle));
 const [rayon,setRayon]=useState(''),[qty,setQty]=useState(1),[reduce,setReduce]=useState(false);
 const cat=categories.find(c=>c.cle===rayon)??categories[0];
 const itemsDe=(cle:string)=>p.produits.filter(x=>x.favorite&&rayonDepuisLibelle(x.category)===cle&&!(session&&w.manques?.[`produit:${x.id}`]&&manqueActif(w,`produit:${x.id}`)));
 const items=cat?itemsDe(cat.cle):[];
 const produit=items.find(p=>!w.habitudesVues?.[p.id]);const faits=items.filter(p=>w.habitudesVues?.[p.id]).length;
 const ligne=produit?listeMaison(w,r.recettes,p.produits).find(l=>l.product_id===produit.id):undefined;
 const quantiteInitiale=ligne?.totalQuantity??(produit?w.quotidienQty[produit.id]??1:1);
 const x=useRef(new Animated.Value(0)).current,lock=useRef(false),action=useRef((acheter:boolean)=>{});
 const annulation=useAnnulation();
 useEffect(()=>{AccessibilityInfo.isReduceMotionEnabled().then(setReduce);const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduce);return()=>sub.remove();},[]);
 useEffect(()=>{setQty(nombreArticles(quantiteInitiale));x.setValue(0);lock.current=false;},[produit?.id,quantiteInitiale,x]);
 action.current=(acheter)=>{if(!produit||lock.current)return;lock.current=true;const avant=instantaneHabitude(w,produit.id);const fin=()=>{w.deciderHabituel(produit.id,qty,acheter);const id=produit.id;annulation.proposer(acheter?`${qty} × ${produit.name} retenu${qty>1?'s':''}`:`${produit.name} : déjà chez moi`,()=>w.annulerHabituel(id,avant));x.setValue(0);lock.current=false;};if(reduce)fin();else Animated.timing(x,{toValue:acheter?450:-450,duration:180,useNativeDriver:true}).start(({finished})=>{if(finished)fin();else lock.current=false;});};
 const pan=useRef(PanResponder.create({onMoveShouldSetPanResponder:(_,g)=>Math.abs(g.dx)>14&&Math.abs(g.dx)>Math.abs(g.dy)*1.5,onPanResponderMove:(_,g)=>{if(!lock.current)x.setValue(g.dx);},onPanResponderRelease:(_,g)=>{if(Math.abs(g.dx)>85)action.current(g.dx>0);else Animated.spring(x,{toValue:0,useNativeDriver:true}).start();},onPanResponderTerminate:()=>Animated.spring(x,{toValue:0,useNativeDriver:true}).start()})).current;
 // Rayon suivant encore à passer, sinon le premier resté en arrière.
 const index=categories.findIndex(c=>c.cle===cat?.cle),aPasser=categories.filter(c=>c.cle!==cat?.cle&&itemsDe(c.cle).some(x=>!w.habitudesVues?.[x.id]));
 const suivant=aPasser.find(c=>categories.indexOf(c)>index)??aPasser[0];
 const terminer=()=>router.push(session?'/wizard/exceptions':'/liste'),sortie=session?'Passer aux extras':'Voir ma liste';
 const allerA=(cle:string)=>{setRayon(cle);annulation.effacer();};
 return <SafeAreaView edges={session?[]:['top']} style={ui.screen}>{!session&&<View style={{padding:20,paddingBottom:8}}><Head title="Mes habitudes" back/></View>}
 <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingHorizontal:20,paddingTop:session?8:0,paddingBottom:8}}>{categories.map(c=><Pressable key={c.cle} accessibilityRole="tab" accessibilityState={{selected:cat?.cle===c.cle}} onPress={()=>allerA(c.cle)} style={[h.rayon,cat?.cle===c.cle&&{backgroundColor:colors.accent}]}><Text style={{color:cat?.cle===c.cle?colors.accentContrast:colors.accent,fontWeight:'600'}}>{c.label}</Text></Pressable>)}</ScrollView></View>
 <ScrollView contentContainerStyle={[ui.content,{paddingTop:4,flexGrow:1}]}>
 {p.chargement&&<ActivityIndicator/>}{p.erreur&&<><Text style={ui.error}>{p.erreur}</Text><Action secondary onPress={p.recharger}>Réessayer</Action></>}
 {cat&&produit&&<Text style={[ui.detail,{fontVariant:['tabular-nums']}]}>{faits+1} sur {items.length} dans ce rayon</Text>}
 {produit?<><Animated.View {...pan.panHandlers} style={{backgroundColor:colors.surface,borderRadius:20,padding:20,gap:8,transform:[{translateX:x},{rotate:x.interpolate({inputRange:[-400,0,400],outputRange:['-8deg','0deg','8deg']})}]}}><Photo name={produit.name} url={produit.image_url} style={{width:'100%',height:180}}/><Text style={[ui.heading,{fontSize:24}]}>{produit.name}</Text><Text style={ui.subtitle}>{[produit.brand,produit.grammage_g?`${produit.grammage_g} g`:produit.volume_ml?`${produit.volume_ml} ml`:null].filter(Boolean).join(' · ')}</Text>{ligne?.besoin&&<Text style={ui.detail}>{ligne.besoin}</Text>}{w.quotidien[produit.id]==='needed'&&<Text style={ui.link}>Déjà noté dans ta liste : {quantiteInitiale}</Text>}</Animated.View>
 <Pressable accessibilityRole="button" onPress={()=>suivant?allerA(suivant.cle):terminer()} style={[ui.iconButton,{marginTop:'auto'}]}><Text style={ui.link}>{suivant?'Passer ce rayon':sortie}</Text></Pressable></>
 :cat?<><Text style={ui.heading}>Ce rayon est prêt.</Text><Text style={ui.subtitle}>Tes choix sont conservés.</Text><Action secondary onPress={()=>w.revoirHabitudes(items.map(x=>x.id))}>Revoir ce rayon</Action>{!!suivant&&<Pressable accessibilityRole="button" onPress={terminer} style={ui.iconButton}><Text style={ui.link}>{sortie}</Text></Pressable>}</>
 :!p.chargement&&!p.erreur?<><Text style={ui.heading}>Tes habitudes commencent ici.</Text><Text style={ui.subtitle}>Enregistre tes produits préférés avec le scanner.</Text><Action secondary onPress={()=>router.push('/scan')}>Scanner un premier favori</Action></>:null}
 </ScrollView>
 <View style={ui.footer}>{annulation.toast}{produit?<View style={h.decision}>
  <Pressable accessibilityRole="button" accessibilityLabel={`${produit.name} : j’en ai déjà`} onPress={()=>action.current(false)} style={h.choix}>{({pressed})=><><View style={[h.rond,h.non,pressed&&{opacity:.7}]}><Feather name="x" size={28} color={colors.accent}/></View><Text style={h.legende}>J’en ai déjà</Text></>}</Pressable>
  <View style={ui.counter}><Pressable accessibilityRole="button" accessibilityLabel="Diminuer la quantité" style={ui.iconButton} onPress={()=>setQty(nombreArticles(qty-1))}><Text style={ui.title}>−</Text></Pressable><Text style={ui.num}>{qty}</Text><Pressable accessibilityRole="button" accessibilityLabel="Augmenter la quantité" style={ui.iconButton} onPress={()=>setQty(nombreArticles(qty+1))}><Text style={ui.title}>+</Text></Pressable></View>
  <Pressable accessibilityRole="button" accessibilityLabel={`${produit.name} : il m’en faut ${qty}`} onPress={()=>action.current(true)} style={h.choix}>{({pressed})=><><View style={[h.rond,h.oui,pressed&&{opacity:.85}]}><Feather name="check" size={28} color={colors.accentContrast}/></View><Text style={h.legende}>Il m’en faut</Text></>}</Pressable>
 </View>:suivant?<Action onPress={()=>allerA(suivant.cle)}>Passer à {suivant.label}</Action>:<Action onPress={terminer}>{session?'Continuer vers les extras':'Vérifier ma liste'}</Action>}</View></SafeAreaView>
}
/** Pied de décision : les deux gestes reprennent le sens du glissement de la carte. */
const h=StyleSheet.create({
 rayon:{minHeight:44,justifyContent:'center',paddingHorizontal:14,borderRadius:22,backgroundColor:colors.accentSoft},
 decision:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:4},
 choix:{alignItems:'center',gap:4,minWidth:88},
 rond:{width:64,height:64,borderRadius:32,alignItems:'center',justifyContent:'center'},
 non:{borderWidth:1.5,borderColor:colors.accent},
 oui:{backgroundColor:colors.accent},
 legende:{fontSize:12,fontWeight:'600',color:colors.accent},
});
