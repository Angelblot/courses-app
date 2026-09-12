import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../lib/theme';
export function Portions({value,onChange,disabled=false}:{value:number;onChange:(n:number)=>void;disabled?:boolean}) {
  return <View style={rs.counter}>
    <Pressable accessibilityRole="button" accessibilityLabel="Moins de personnes" disabled={disabled||value<=1} onPress={()=>onChange(value-1)} style={[rs.control,value<=1&&{opacity:.35}]}><Feather name="minus" size={20} color={colors.accent}/></Pressable>
    <Text style={rs.number}>{value}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Plus de personnes" disabled={disabled||value>=99} onPress={()=>onChange(value+1)} style={rs.control}><Feather name="plus" size={20} color={colors.accent}/></Pressable>
  </View>;
}
export const rs=StyleSheet.create({
  page:{flex:1,backgroundColor:colors.bg},
  body:{width:'100%',maxWidth:760,alignSelf:'center',padding:20,gap:18,paddingBottom:32},
  bar:{width:'100%',maxWidth:760,alignSelf:'center',paddingHorizontal:16,paddingVertical:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},
  back:{minHeight:44,flexDirection:'row',alignItems:'center',gap:5},
  title:{fontSize:30,lineHeight:35,fontWeight:'700',letterSpacing:-.6,color:colors.text},
  section:{fontSize:22,fontWeight:'600',color:colors.text},
  text:{fontSize:15,lineHeight:22,color:colors.textMuted},
  label:{fontSize:14,fontWeight:'600',color:colors.text,marginBottom:7},
  row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'},
  counter:{flexDirection:'row',alignItems:'center',backgroundColor:colors.accentSoft,borderRadius:12},
  control:{width:44,height:44,alignItems:'center',justifyContent:'center'},
  number:{minWidth:26,textAlign:'center',fontSize:18,fontWeight:'600',color:colors.text,fontVariant:['tabular-nums']},
  ingredient:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:14,borderBottomWidth:1,borderBottomColor:colors.border},
  quantity:{fontSize:17,fontWeight:'700',color:colors.accent},
  footer:{backgroundColor:colors.surface,borderTopWidth:1,borderTopColor:colors.border},
  footInner:{width:'100%',maxWidth:760,alignSelf:'center',padding:16,gap:8},
  sheet:{flex:1,justifyContent:'center',padding:24,backgroundColor:'rgba(24,35,20,.4)'},
  dialog:{width:'100%',maxWidth:480,alignSelf:'center',backgroundColor:colors.bg,borderRadius:16,padding:24,gap:16},
});
