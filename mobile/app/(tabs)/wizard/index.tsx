import { Redirect } from 'expo-router';
import { useWizard } from '../../../contexts/WizardContext';
export default function WizardIndex(){const w=useWizard();return <Redirect href={`/wizard/${w.sessionEtape??'recettes'}`}/>;}
