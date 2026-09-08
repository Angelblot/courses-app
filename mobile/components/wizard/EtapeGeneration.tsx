import { useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMaison } from '../../contexts/useMaison';
import { construireItems } from '../../lib/consolidation';
import { envoyerListe } from '../../lib/cart-jobs';
import { Action, ui } from '../MaisonUI';
export function EtapeGeneration(){
 const {w,acheter,loading,erreur:loadError,stale,p,r}=useMaison();
 const [sending,setSending]=useState(false),[error,setError]=useState<string|null>(null);const lock=useRef(false);
 const disabled=loading||!!loadError||stale||!acheter.length||acheter.some(l=>l.aPreciser)||!w.drives.length||sending;
 async function send(){if(disabled||lock.current)return;lock.current=true;setSending(true);setError(null);try{const result=await envoyerListe(construireItems(acheter),w.drives);if(result.ok&&result.id){w.reinitialiser();router.replace(`/suivi/${result.id}`);}else setError(result.erreur??'L’envoi n’a pas abouti. Réessaie.');}catch{setError('Connexion interrompue. Vérifie le suivi avant de réessayer.');}finally{lock.current=false;setSending(false);}}
 return <ScrollView contentContainerStyle={ui.content}><Text style={ui.heading}>Où fait-on les courses ?</Text><Text style={ui.subtitle}>{acheter.length} articles à acheter</Text>
 {loadError&&<><Text style={ui.error}>{loadError}</Text><Action secondary onPress={()=>{p.recharger();r.recharger();}}>Réessayer le chargement</Action></>}
 {['carrefour','leclerc'].map(d=><Action key={d} disabled={sending} secondary={!w.drives.includes(d)} onPress={()=>w.basculerDrive(d)}>{w.drives.includes(d)?'✓ ':''}{d==='carrefour'?'Carrefour':'E.Leclerc'}</Action>)}
 <View style={ui.notice}><Text style={ui.productName}>La suite se passe sur ton ordinateur.</Text><Text style={ui.subtitle}>Ouvre Chrome et connecte l’extension Courses au même compte que sur ton iPhone. Après l’envoi, clique sur « Remplir le panier » dans l’extension. Tu vérifies puis paies sur le site du drive.</Text></View>
 {(stale||acheter.some(l=>l.aPreciser))&&<Text style={ui.error}>Retourne dans ta liste pour vérifier les recettes et conditionnements signalés.</Text>}
 {error&&<Text accessibilityLiveRegion="polite" style={ui.error}>{error}</Text>}{sending&&<ActivityIndicator/>}
 <Action disabled={disabled} onPress={send}>{sending?'Envoi en cours…':'Envoyer à mon ordinateur'}</Action><Action disabled={sending} secondary onPress={()=>router.replace('/liste')}>Modifier ma liste</Action>
 </ScrollView>
}
