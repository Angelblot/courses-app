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

# Node n'est pas garanti sur l'image Xcode Cloud, et sa présence VARIE d'une
# exécution à l'autre : présent au build 5, absent au build 6. Quand il manque,
# Homebrew est la voie documentée — mais elle dépend de ghcr.io, qui était
# injoignable au build 6 et a fait perdre l'archivage entier.
#
# On tente donc Homebrew, puis, s'il échoue, l'archive officielle de nodejs.org.
# Les deux hôtes sont indépendants : la panne de l'un ne dit rien de l'autre.
if ! command -v node > /dev/null 2>&1; then
  echo "Node absent, installation"
  export HOMEBREW_NO_AUTO_UPDATE=1
  export HOMEBREW_NO_INSTALL_CLEANUP=1

  if brew install node; then
    echo "Node installé par Homebrew"
  else
    echo "Homebrew a échoué, repli sur l'archive officielle"
    VERSION_NODE="v22.20.0"
    case "$(uname -m)" in
      arm64) ARCH_NODE="darwin-arm64" ;;
      *)     ARCH_NODE="darwin-x64" ;;
    esac
    ARCHIVE="node-${VERSION_NODE}-${ARCH_NODE}"
    mkdir -p "$HOME/outils"
    curl -fsSL --retry 3 --retry-delay 5 \
      "https://nodejs.org/dist/${VERSION_NODE}/${ARCHIVE}.tar.xz" \
      -o "$HOME/outils/node.tar.xz"
    tar -xJf "$HOME/outils/node.tar.xz" -C "$HOME/outils"
    # Le PATH doit valoir aussi pour les phases de build suivantes :
    # `ios/.xcode.env` résout Node par `command -v node`.
    PATH="$HOME/outils/${ARCHIVE}/bin:$PATH"
    export PATH
    echo "export PATH=\"$HOME/outils/${ARCHIVE}/bin:\$PATH\"" >> "$HOME/.zshrc"
  fi
fi

if ! command -v node > /dev/null 2>&1; then
  echo "Node reste introuvable après les deux tentatives."
  exit 1
fi
echo "Node $(node --version)"

# npm ci exige un package-lock.json cohérent : il échoue plutôt que de résoudre
# silencieusement des versions différentes de celles validées ici.
echo "Dépendances JavaScript"
npm ci --no-audit --no-fund

echo "Pods"
cd ios

# CocoaPods télécharge hermes-engine depuis Maven Central à chaque build, et ce
# téléchargement a déjà coupé en plein vol : curl 35, « Connection reset by
# peer », build 2 du 21/08/2026. Tout l'archivage tombe alors sur un incident
# réseau de quelques secondes. CocoaPods ne retente que deux fois, aussitôt.
# On rejoue donc l'installation entière avec une pause, plutôt que de perdre
# vingt-cinq minutes de compilation. Trois échecs d'affilée ne sont plus un
# incident passager : on abandonne pour de bon.
for tentative in 1 2 3; do
  if pod install; then
    break
  fi
  if [ "$tentative" = 3 ]; then
    echo "pod install a échoué trois fois — ce n'est plus une coupure réseau."
    exit 1
  fi
  echo "pod install a échoué (tentative $tentative), nouvel essai dans 15 s"
  sleep 15
done

echo "Prêt pour l'archivage"
