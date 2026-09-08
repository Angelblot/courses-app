import { Redirect, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Head, ui } from '../../../components/MaisonUI';
import { EtapeGeneration } from '../../../components/wizard/EtapeGeneration';
export default function EtapeWizard(){const {etape}=useLocalSearchParams<{etape:string}>();if(etape!=='generation')return <Redirect href={etape==='recettes'?'/recettes':etape==='quotidien'?'/favoris':'/liste'}/>;return <SafeAreaView edges={['top']} style={ui.screen}><View style={{padding:20,paddingBottom:0}}><Head title="Mon drive" back/></View><EtapeGeneration/></SafeAreaView>}
