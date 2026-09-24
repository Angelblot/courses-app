# Démarrage iOS 27 et build 33

Le rapport iPhone de la build 33 indique `EXC_BREAKPOINT / SIGTRAP` dans
`UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`. La build Apple
utilisait Xcode 27 et le SDK iOS 27, qui imposent le cycle de vie `UIScene`.
Une compilation locale avec Xcode 26.6 ne reproduisait pas cette assertion.

Le projet iOS est maintenu à la main : ne pas le régénérer avec `prebuild --clean`,
qui supprimerait les intégrations du widget et de Siri.

- Expo 57.0.25 et ses dépendances compatibles apportent le support officiel des scènes.
- `AppDelegate` prépare la factory React Native et expose `ExpoReactNativeFactoryProvider`.
- `Info.plist` déclare `EXExpoAppSceneDelegate` avec une seule scène.
- Expo crée la fenêtre dans la scène et relaie les liens à froid/à chaud ainsi que
  les événements d’activation utilisés pour importer les ajouts du widget.
- Les anciens handlers de liens restent compatibles grâce à la déduplication Expo.

Référence : https://github.com/expo/fyi/blob/main/ios-scene-lifecycle.md

Avant une publication qui modifie les dépendances natives, tester une build Release,
le lancement à froid, la reprise après arrière-plan et `coursesapp://ajout` à froid
et à chaud. Vérifier aussi le SDK de compilation Apple : il peut différer du Xcode local.

Validation du correctif : TypeScript, 204 tests JavaScript et tests Swift de stockage
widget/Siri réussis. Build native Release réussie. Sur simulateur iOS 27 : écran de
connexion affiché, session fictive restaurée, `coursesapp://ajout` atteint l’écran
« Il me manque… » à chaud et à froid. Compilation locale avec Xcode 26.6 ; la build
TestFlight est compilée avec Xcode 27 par Apple. Aucun test ne modifie le compte réel.
