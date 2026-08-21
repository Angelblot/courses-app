#!/bin/sh
# Exécuté par Xcode Cloud juste après le clone, avant la résolution des
# dépendances et l'archivage.
#
# Xcode Cloud ne clone que le dépôt : ni node_modules, ni Pods. Sans ce script,
# l'archivage échoue sur des en-têtes introuvables.
set -e

# Le dépôt est un monorepo ; le projet Expo vit dans mobile/.
cd "$CI_PRIMARY_REPOSITORY_PATH/mobile"

# CocoaPods plante en formatant ses propres erreurs si la locale n'est pas
# UTF-8, ce qui masque le vrai message. Rencontré en local.
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# Node n'est pas garanti sur l'image Xcode Cloud. On l'installe par Homebrew,
# présent sur ces images, ce qui le place aussi sur le PATH des phases de build
# ultérieures — `ios/.xcode.env` le résout par `command -v node`.
if ! command -v node > /dev/null 2>&1; then
  echo "Node absent, installation par Homebrew"
  export HOMEBREW_NO_AUTO_UPDATE=1
  export HOMEBREW_NO_INSTALL_CLEANUP=1
  brew install node
fi
echo "Node $(node --version)"

# npm ci exige un package-lock.json cohérent : il échoue plutôt que de résoudre
# silencieusement des versions différentes de celles validées ici.
echo "Dépendances JavaScript"
npm ci --no-audit --no-fund

echo "Pods"
cd ios
pod install

echo "Prêt pour l'archivage"
