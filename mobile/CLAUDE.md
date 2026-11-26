@AGENTS.md

## Itérer sans build (Expo Updates)
- Mise à jour iPhone sans build TestFlight : `bash mobile/scripts/cloud-update.sh "message"` (depuis la racine ou `mobile/`),
  avec `EXPO_TOKEN` ou la session `eas login` du Mac.
  Le bundle est construit en local avec la configuration Supabase de l'environnement EAS `production`
  (ou celle déjà exportée dans le shell), vérifié, puis publié sur le canal `production`.
- Le canal est embarqué dans l'app : `updates.requestHeaders` d'`app.json`, recopié dans `ios/Courses/Supporting/Expo.plist`
  (Xcode Cloud compile le projet versionné, EAS Build n'injecte rien). `eas.json` porte aussi `channel: production` pour un build EAS.
- Ne marche que si le natif n'a pas changé (`runtimeVersion` = fingerprint, calculé au build par le pod EXUpdates).
  `scripts/runtime-installe.txt` contient le fingerprint du build installé : le remettre à jour après chaque build TestFlight
  (`npx expo-updates fingerprint:generate --platform ios`, champ `hash`).
- Demandent encore un build Xcode Cloud : nouveau module natif, greffon ou permission dans `app.json`, icône, écran de lancement,
  toute modification sous `ios/`, et le `.gitignore` racine, qui entre dans le fingerprint.
- `ios/Podfile.lock` est exclu du fingerprint (`.fingerprintignore`) : `pod install` le réécrit selon la machine
  (modules Expo précompilés ou non), ce qui donnait une empreinte différente sur le Mac, sur Xcode Cloud et dans le script.
  Après un build, vérifier la valeur réellement gravée : `EXUpdates.bundle/fingerprint` dans le `.app`.
- `ios/` contient du natif écrit à la main (widget Tablee, intents Siri) : `expo prebuild --clean` l'efface.
  Pour un réglage d'`app.json` qui touche le natif, reporter la modification à la main (comme `Expo.plist` ici) puis
  `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install`, et relire le diff de `ios/` avant de committer.
- Le bandeau `components/BandeauMiseAJour.tsx` (monté dans `app/_layout.tsx`) télécharge la version en arrière-plan
  et propose de redémarrer ; il est inactif en développement.
