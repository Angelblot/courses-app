import { useCallback } from 'react';
import { Redirect, router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Head, ui } from '../../../components/MaisonUI';
import { EtapeGeneration } from '../../../components/wizard/EtapeGeneration';
import { EnteteCorrection, SessionProgress } from '../../../components/SessionProgress';
import { Manques } from '../../../components/Manques';
import { CORRECTIONS, SESSION_STEPS } from '../../../lib/session-courses';
import { useWizard } from '../../../contexts/WizardContext';
import Recettes from '../recettes/index';
import Habitudes from '../habitudes';
import Ajout from '../ajout';
import Liste from '../liste';
export default function EtapeWizard(){
 const {etape}=useLocalSearchParams<{etape:string}>(),w=useWizard();
 const step=SESSION_STEPS.find(s=>s.cle===etape)?.cle,correction=CORRECTIONS.find(c=>c.cle===etape)?.cle;
 useFocusEffect(useCallback(()=>{if(step){w.demarrerSession();w.allerEtape(step);}},[step,w.demarrerSession,w.allerEtape]));
 if(etape==='generation')return <SafeAreaView edges={['top']} style={ui.screen}><View style={{padding:20,paddingBottom:0}}><Head title="Mon drive" back avatar={false} onBack={()=>router.canGoBack()?router.back():router.replace('/wizard/recap')}/></View><EtapeGeneration/></SafeAreaView>;
 // Une correction s'ouvre depuis le bilan et y revient ; elle ne change pas l'étape.
 if(correction)return <View style={ui.screen}><EnteteCorrection/>{correction==='manques'?<Manques session/>:correction==='habitudes'?<Habitudes session/>:<Ajout session/>}</View>;
 if(!step)return <Redirect href="/wizard/recettes"/>;
 return <View style={ui.screen}><SessionProgress step={step}/>{step==='recettes'?<Recettes session/>:<Liste session/>}</View>;
}
