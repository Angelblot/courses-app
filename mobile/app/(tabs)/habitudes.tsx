import { instantaneHabitude, manqueActif, type InstantaneHabitude } from '../../lib/session-courses';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../lib/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Head, Photo, Action, ui, useAnnulation } from '../../components/MaisonUI';
import { revenirAuBilan } from '../../components/SessionProgress';
import { useProducts } from '../../stores/products';
import { useWizard } from '../../contexts/WizardContext';
import { RAYONS, rayonDepuisLibelle } from '../../lib/rayons';
import { nombreArticles } from '../../lib/ajouts-quotidiens';
/**
 * Habitudes : une liste à cocher par rayon. On touche ce qu'il faut acheter ;
 * le reste du rayon est considéré comme déjà à la maison quand on passe au
 * rayon suivant. Un rayon se passe en un geste, même avec beaucoup de produits.
 */
export default function Habitudes({session=false}:{session?:boolean}){
 const p=useProducts(),w=useWizard();useFocusEffect(useCallback(()=>{p.recharger();},[p.recharger]));
 const categories=RAYONS.filter(c=>p.produits.some(p=>p.favorite&&rayonDepuisLibelle(p.category)===c.cle));
 const [rayon,setRayon]=useState('');
 const cat=categories.find(c=>c.cle===rayon)??categories[0];
 const itemsDe=(cle:string)=>p.produits.filter(x=>x.favorite&&rayonDepuisLibelle(x.category)===cle&&!(session&&w.manques?.[`produit:${x.id}`]&&manqueActif(w,`produit:${x.id}`)));
 const items=cat?itemsDe(cat.cle):[];
 const fini=(cle:string)=>{const l=itemsDe(cle);return l.length>0&&l.every(x=>w.habitudesVues?.[x.id]);};
 const annulation=useAnnulation();
 // Cocher, c'est ajouter à la liste tout de suite ; décocher, c'est « déjà
 // chez moi ». « Rayon suivant » ne fait que classer le reste du rayon.
 const choix:Record<string,number>=Object.fromEntries(items.filter(x=>w.quotidien[x.id]==='needed'&&!w.lignePossedees[`produit:${x.id}`]).map(x=>[x.id,nombreArticles(w.quotidienQty[x.id]??1)]));
 const basculer=(id:string)=>w.deciderHabituel(id,nombreArticles(w.quotidienQty[id]??1),!(id in choix));
 const quantite=(id:string,n:number)=>w.deciderHabituel(id,nombreArticles(n),true);
 // Rayon suivant encore à passer, sinon le premier resté en arrière.
 const index=categories.findIndex(c=>c.cle===cat?.cle),aPasser=categories.filter(c=>c.cle!==cat?.cle&&itemsDe(c.cle).some(x=>!w.habitudesVues?.[x.id]));
 const suivant=aPasser.find(c=>categories.indexOf(c)>index)??aPasser[0];
 // En session, les habitudes sont une correction du bilan : on y revient.
 const terminer=()=>session?revenirAuBilan():router.push('/liste');
 const allerA=(cle:string)=>{setRayon(cle);annulation.effacer();};
 const retenus=items.filter(x=>x.id in choix).length;
 function valider(){
  if(cat&&items.length){
   const avant:Record<string,InstantaneHabitude>=Object.fromEntries(items.map(x=>[x.id,instantaneHabitude(w,x.id)]));
   items.forEach(x=>w.deciderHabituel(x.id,choix[x.id]??1,x.id in choix));
   // Le toast ne vaut que si l'on reste ici ; après le dernier rayon, le
   // retour du pied rouvre la liste, qui reflète les choix faits.
   if(!suivant){terminer();return;}
   allerA(suivant.cle);
   annulation.proposer(`${cat.label} : ${retenus} retenu${retenus>1?'s':''}`,()=>{items.forEach(x=>w.annulerHabituel(x.id,avant[x.id]));setRayon(cat.cle);});
  }else if(suivant)allerA(suivant.cle);else terminer();
 }
 const libelle=`${suivant?'Rayon suivant':session?'Revenir au bilan':'Vérifier ma liste'}${retenus?` · ${retenus} retenu${retenus>1?'s':''}`:''}`;
 return <SafeAreaView edges={session?[]:['top']} style={ui.screen}><View style={{paddingHorizontal:20,paddingTop:session?4:20,paddingBottom:4}}><Head title="Mes habitudes" back={!session} avatar={!session}/></View>
 <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingHorizontal:20,paddingTop:session?8:0,paddingBottom:8}}>{categories.map(c=>{const actif=cat?.cle===c.cle,ok=fini(c.cle)&&!actif;return <Pressable key={c.cle} accessibilityRole="tab" accessibilityState={{selected:actif}} aria-selected={actif} accessibilityLabel={`${c.label}${ok?', passé en revue':''}`} onPress={()=>allerA(c.cle)} style={[h.rayon,actif&&{backgroundColor:colors.accent,borderColor:colors.accent}]}>{ok&&<Feather name="check" size={15} color={colors.accent}/>}<Text style={{color:actif?colors.accentContrast:colors.accent,fontWeight:'600'}}>{c.label}</Text></Pressable>;})}</ScrollView></View>
 <ScrollView contentContainerStyle={[ui.content,{paddingTop:4,gap:8}]}>
 {p.chargement&&<ActivityIndicator/>}{p.erreur&&<><Text style={ui.error}>{p.erreur}</Text><Action secondary onPress={p.recharger}>Réessayer</Action></>}
 {cat&&items.length>0&&<Text style={ui.detail}>Touche ce qu’il te faut. Le reste est considéré comme déjà chez toi.</Text>}
 {items.map(x=>{const pris=x.id in choix,q=choix[x.id]??1,detail=[x.brand,x.grammage_g?`${x.grammage_g} g`:x.volume_ml?`${x.volume_ml} ml`:null].filter(Boolean).join(' · ');return <View key={x.id} style={[h.ligne,pris&&h.ligneOn]}>
  <Pressable accessibilityRole="checkbox" accessibilityState={{checked:pris}} aria-checked={pris} accessibilityLabel={x.name} onPress={()=>basculer(x.id)} style={[ui.row,{flex:1,minHeight:52}]}>
   <Photo name={x.name} url={x.image_url} style={h.photo}/>
   <View style={{flex:1}}><Text style={ui.productName}>{x.name}</Text>{!!detail&&<Text style={[ui.detail,{marginTop:1}]}>{detail}</Text>}</View>
   {!pris&&<View style={h.case}/>}
  </Pressable>
  {pris&&<View style={[ui.row,{gap:4}]}><View style={ui.counter}><Pressable accessibilityRole="button" accessibilityLabel={`Diminuer ${x.name}`} style={ui.iconButton} onPress={()=>q>1?quantite(x.id,q-1):basculer(x.id)}><Text style={ui.title}>−</Text></Pressable><Text style={ui.num}>{q}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Augmenter ${x.name}`} style={ui.iconButton} onPress={()=>quantite(x.id,q+1)}><Text style={ui.title}>+</Text></Pressable></View><Pressable accessibilityRole="button" accessibilityLabel={`Ne plus acheter ${x.name}`} onPress={()=>basculer(x.id)} style={h.cible}><View style={[h.case,h.caseOn]}><Feather name="check" size={16} color={colors.accentContrast}/></View></Pressable></View>}
 </View>;})}
 {cat&&!items.length&&!p.chargement&&<Text style={ui.subtitle}>Rien à passer en revue dans ce rayon : ses produits sont déjà dans tes manques.</Text>}
 {!cat&&!p.chargement&&!p.erreur&&<><Text style={ui.heading}>Tes habitudes commencent ici.</Text><Text style={ui.subtitle}>Enregistre tes produits préférés avec le scanner.</Text><Action secondary onPress={()=>router.push('/scan')}>Scanner un premier favori</Action></>}
 </ScrollView>
 <View style={ui.footer}>{annulation.toast}<Action onPress={valider}>{libelle}</Action></View></SafeAreaView>
}
const h=StyleSheet.create({
 rayon:{minHeight:44,flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:14,borderRadius:22,backgroundColor:colors.accentSoft,borderWidth:1,borderColor:colors.traitControle},
 ligne:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:colors.surface,borderRadius:12,paddingLeft:6,paddingRight:10,borderWidth:1,borderColor:colors.surface},
 ligneOn:{borderWidth:2,borderColor:colors.accent},
 photo:{width:44,height:44,borderRadius:8},
 case:{width:28,height:28,borderRadius:14,borderWidth:1.5,borderColor:colors.traitControle,alignItems:'center',justifyContent:'center'},
 cible:{width:44,height:44,alignItems:'center',justifyContent:'center'},
 caseOn:{backgroundColor:colors.accent,borderColor:colors.accent,width:32,height:32,borderRadius:16},
});
