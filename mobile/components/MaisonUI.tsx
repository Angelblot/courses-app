import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Image, Pressable, Text, View, StyleSheet, type ImageStyle, type StyleProp } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '../lib/theme';
import { photoSecours } from '../lib/photos-maison';
import { SESSION_STEPS, type SessionStep } from '../lib/session-courses';
export function Photo({name,url,style,recipe=false}:{name:string;url?:string|null;style?:StyleProp<ImageStyle>;recipe?:boolean}) {
  const [failed,setFailed] = useState(false);
  useEffect(()=>setFailed(false),[url,name]);
  const fallback=photoSecours(name),source=!failed&&url?.trim()?{uri:url}:fallback;
  return source?<Image source={source} accessibilityLabel={name} style={[ui.photo,style]} resizeMode={recipe?'cover':'contain'} onError={()=>setFailed(true)}/>:<View style={[ui.photo,style as any,ui.placeholder]}><Feather name={recipe?'image':'package'} size={25} color={colors.textMuted}/></View>;
}
/** Principal plein, secondaire à contour, désactivé gris neutre : trois formes qu'on ne confond pas. */
export function Action({children,onPress,secondary=false,disabled=false}:{children:ReactNode;onPress:()=>void;secondary?:boolean;disabled?:boolean}) {return <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={[ui.button,secondary&&ui.secondary,disabled&&ui.disabled]}><Text style={[ui.buttonText,secondary&&{color:colors.accent},disabled&&{color:colors.offText}]}>{children}</Text></Pressable>}
/** La raison d'un bouton bloqué, sous le bouton, avec le geste qui le débloque. */
export function Raison({children,action,onPress}:{children:ReactNode;action?:string;onPress?:()=>void}) {return <View accessibilityLiveRegion="polite" style={ui.raison}><Text style={[ui.detail,{marginTop:0,textAlign:'center'}]}>{children}</Text>{!!action&&!!onPress&&<Pressable accessibilityRole="button" onPress={onPress} hitSlop={10}><Text style={ui.link}>{action}</Text></Pressable>}</View>}
export function Head({title,back=false,onBack,action,avatar=true}:{title:string;back?:boolean;onBack?:()=>void;action?:ReactNode;avatar?:boolean}) {return <View style={ui.header}>{back&&<Pressable accessibilityRole="button" accessibilityLabel="Revenir aux courses" onPress={onBack??(()=>router.replace('/'))} style={ui.iconButton}><Feather name="chevron-left" size={24} color={colors.text}/></Pressable>}<Text accessibilityRole="header" style={[ui.title,{flex:1}]}>{title}</Text>{action??(avatar&&<Pressable accessibilityRole="button" accessibilityLabel="Réglages" onPress={()=>router.push('/compte')} style={ui.avatar}><Feather name="user" size={21} color="white"/></Pressable>)}</View>}
/**
 * Retour à l'étape d'avant, dans le pied, sous le pouce : un carré à contour
 * posé à gauche du bouton principal. Dépile si possible, sinon remplace.
 */
export function PiedAvecRetour({vers,children}:{vers:SessionStep;children:ReactNode}){
 const nom=SESSION_STEPS.find(e=>e.cle===vers)?.label;
 return <View style={[ui.row,{gap:8}]}><Pressable accessibilityRole="button" accessibilityLabel={`Revenir à l’étape ${nom}`} onPress={()=>router.canGoBack()?router.back():router.replace(`/wizard/${vers}`)} style={({pressed})=>[ui.retour,pressed&&{opacity:.7}]}><Feather name="chevron-left" size={22} color={colors.accent}/></Pressable><View style={{flex:1}}>{children}</View></View>;
}
export function ScanAction(){return <Pressable accessibilityRole="button" onPress={()=>router.push('/scan')} style={ui.scan}><Feather name="maximize" size={20} color={colors.accent}/><Text style={ui.link}>Scanner un produit</Text></Pressable>}
/**
 * Un geste qui retire ou décide peut s'annuler quelques secondes. Le toast
 * se pose au-dessus du bloc du bas qui le contient (pied, bandeau).
 */
export function useAnnulation(duree=6000){
 const [offre,setOffre]=useState<{texte:string;annuler:()=>void}|null>(null);
 useEffect(()=>{if(!offre)return;const t=setTimeout(()=>setOffre(null),duree);return()=>clearTimeout(t);},[offre,duree]);
 const proposer=useCallback((texte:string,annuler:()=>void)=>setOffre({texte,annuler}),[]);
 const effacer=useCallback(()=>setOffre(null),[]);
 const toast=offre?<View style={ui.toast}><Text accessibilityLiveRegion="polite" style={ui.toastTexte} numberOfLines={2}>{offre.texte}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Annuler : ${offre.texte}`} onPress={()=>{offre.annuler();setOffre(null);}} hitSlop={8} style={{minHeight:44,justifyContent:'center'}}><Text style={[ui.toastTexte,{fontWeight:'700'}]}>Annuler</Text></Pressable></View>:null;
 return {proposer,effacer,toast};
}
export const ui=StyleSheet.create({
 toast:{position:'absolute',left:16,right:16,bottom:'100%',marginBottom:8,borderRadius:14,backgroundColor:colors.text,paddingLeft:16,paddingRight:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,boxShadow:'0 6px 14px rgba(38,51,32,0.25)',zIndex:10},
 toastTexte:{color:colors.accentContrast,fontSize:14,flexShrink:1},
 retour:{width:48,height:48,borderRadius:12,borderWidth:1.5,borderColor:colors.accent,alignItems:'center',justifyContent:'center'},
 screen:{flex:1,backgroundColor:colors.bg},content:{padding:20,paddingBottom:28,gap:12},header:{flexDirection:'row',alignItems:'center',gap:6,marginBottom:12},title:{fontSize:27,fontWeight:'700',color:colors.text,letterSpacing:-.6},heading:{fontSize:29,lineHeight:33,fontWeight:'700',color:colors.text,letterSpacing:-.6},subtitle:{fontSize:15,lineHeight:22,color:colors.textMuted},section:{fontSize:20,fontWeight:'600',color:colors.text,marginTop:14},avatar:{width:44,height:44,borderRadius:22,backgroundColor:colors.accent,alignItems:'center',justifyContent:'center'},iconButton:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},button:{minHeight:48,borderRadius:12,backgroundColor:colors.accent,padding:14,alignItems:'center',justifyContent:'center'},secondary:{backgroundColor:'transparent',borderWidth:1.5,borderColor:colors.accent},disabled:{backgroundColor:colors.off,borderWidth:0},raison:{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',alignItems:'center',columnGap:6},buttonText:{fontSize:15,fontWeight:'600',color:'white'},scan:{minHeight:48,borderRadius:12,borderWidth:1.5,borderColor:colors.accent,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10},link:{fontSize:14,color:colors.accent,fontWeight:'600'},row:{flexDirection:'row',alignItems:'center',gap:10},sectionRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},product:{backgroundColor:'white',borderRadius:12,padding:10,flexDirection:'row',alignItems:'center',gap:10},photo:{width:60,height:64,borderRadius:8},placeholder:{alignItems:'center',justifyContent:'center',backgroundColor:colors.accentSoft},productName:{fontSize:15,fontWeight:'600',color:colors.text},detail:{fontSize:13,lineHeight:19,color:colors.textMuted,marginTop:3},add:{width:44,height:44,borderRadius:22,backgroundColor:colors.accent,alignItems:'center',justifyContent:'center'},input:{borderWidth:1,borderColor:colors.border,borderRadius:12,minHeight:48,padding:12,backgroundColor:'white',color:colors.text,fontSize:16},notice:{backgroundColor:colors.accentSoft,padding:14,borderRadius:12},error:{color:colors.danger,fontSize:14,lineHeight:20},footer:{padding:16,gap:8,backgroundColor:'white',borderTopWidth:1,borderTopColor:colors.border},counter:{flexDirection:'row',alignItems:'center',backgroundColor:colors.bg,borderRadius:10},num:{minWidth:25,textAlign:'center',fontSize:16,color:colors.text,fontVariant:['tabular-nums']}
});
