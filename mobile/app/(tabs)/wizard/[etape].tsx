import { useCallback } from 'react';
import { Redirect, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Head, ui } from '../../../components/MaisonUI';
import { EtapeGeneration } from '../../../components/wizard/EtapeGeneration';
import { SessionProgress } from '../../../components/SessionProgress';
import { Manques } from '../../../components/Manques';
import { SESSION_STEPS, type SessionStep } from '../../../lib/session-courses';
import { useWizard } from '../../../contexts/WizardContext';
import Recettes from '../recettes/index';
import Habitudes from '../habitudes';
import Ajout from '../ajout';
import Liste from '../liste';
export default function EtapeWizard(){
 const {etape}=useLocalSearchParams<{etape:string}>(),w=useWizard();
 const step=SESSION_STEPS.find(s=>s.cle===etape)?.cle;
 useFocusEffect(useCallback(()=>{if(step){w.demarrerSession();w.allerEtape(step);}},[step,w.demarrerSession,w.allerEtape]));
 if(etape==='generation')return <SafeAreaView edges={['top']} style={ui.screen}><View style={{padding:20,paddingBottom:0}}><Head title="Mon drive" back/></View><EtapeGeneration/></SafeAreaView>;
 if(!step)return <Redirect href="/wizard/recettes"/>;
 return <View style={ui.screen}><SessionProgress step={step}/>{step==='recettes'?<Recettes session/>:step==='manques'?<Manques session/>:step==='habitudes'?<Habitudes session/>:step==='exceptions'?<Ajout session/>:<Liste session/>}</View>;
}
