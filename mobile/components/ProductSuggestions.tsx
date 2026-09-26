import { Keyboard, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Photo, ui } from './MaisonUI';
import { colors } from '../lib/theme';
import type { Product } from '../stores/products';
export type Suggestion = { id:string; name:string; image?:string|null; brand?:string|null; detail?:string|null };
export function productSuggestion(p:Product):Suggestion {
 return {id:p.id,name:p.name,image:p.image_url,brand:p.brand,detail:p.volume_ml?`${p.volume_ml} ml`:p.grammage_g?`${p.grammage_g} g`:p.unit};
}
/** Shared photo choices; callers retain their existing selection or add action. */
export function ProductSuggestions({items,selectedId,onSelect,actionLabel='Choisir ce produit'}:{items:Suggestion[];selectedId?:string|null;onSelect:(id:string)=>void;actionLabel?:string}) {
 const {fontScale}=useWindowDimensions();
 if(!items.length)return null;
 return <View style={{gap:6}}>
 <Text style={ui.detail}>{items.length} produit{items.length>1?'s':''}{items.length>1?' · Fais défiler pour comparer':''}</Text>
 <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator contentContainerStyle={{gap:10,paddingBottom:8}}>
 {items.map(item=>{const selected=item.id===selectedId;return <Pressable key={item.id} accessibilityRole="button" accessibilityState={{selected}} accessibilityLabel={`${selected?'Produit sélectionné':actionLabel} : ${item.name}, ${[item.brand,item.detail].filter(Boolean).join(', ')}`} onPress={()=>{Keyboard.dismiss();onSelect(item.id);}} style={({pressed})=>({width:fontScale>1.3?210:144,padding:10,gap:6,borderWidth:2,borderColor:selected?colors.accent:colors.border,borderRadius:12,backgroundColor:selected?colors.accentSoft:colors.surface,opacity:pressed?.8:1})}>
 <Photo name={item.name} url={item.image} style={{width:'100%',height:84,backgroundColor:'white'}}/>
 <Text style={ui.productName} numberOfLines={3}>{item.name}</Text>
 {!!item.brand&&<Text style={ui.detail} numberOfLines={1}>{item.brand}</Text>}
 {!!item.detail&&<Text style={ui.detail}>{item.detail}</Text>}
 <View style={[ui.row,{marginTop:'auto',minHeight:28,gap:5}]}><Feather name={selected?'check-circle':'plus-circle'} size={16} color={colors.accent}/><Text style={[ui.link,{flexShrink:1}]}>{selected?'Sélectionné':actionLabel}</Text></View>
 </Pressable>})}
 </ScrollView></View>;
}
