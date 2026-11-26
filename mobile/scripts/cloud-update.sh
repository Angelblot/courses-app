#!/usr/bin/env bash
# Envoie une mise à jour JavaScript aux iPhone qui ont l'app (Expo Updates), sans nouveau build TestFlight.
# Usage, depuis la racine du dépôt ou depuis mobile/ :
#   bash mobile/scripts/cloud-update.sh "Message de la mise à jour"
# Authentification : EXPO_TOKEN (jamais dans le dépôt), ou la session `eas login` du Mac.
# La configuration Supabase du bundle (EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY) vient de
# l'environnement EAS « production » ; si les deux sont déjà exportées dans le shell, elles sont prises telles quelles.
# Seuls les builds au même « fingerprint » natif reçoivent la mise à jour : après un changement natif
# (module, greffon, permission, icône, ios/), il faut un nouveau build Xcode Cloud.
set -euo pipefail
cd "$(dirname "$0")/.."

# EXPO_TOKEN, ou à défaut la session ouverte par `eas login` sur ce Mac.
if [ -z "${EXPO_TOKEN:-}" ] && ! npx --yes eas-cli@latest whoami > /dev/null 2>&1; then
  echo "Ni EXPO_TOKEN ni session EAS (eas login) : mise à jour annulée."; exit 1
fi

# Garde-fou : la mise à jour n'atteint que les builds au même fingerprint. S'il a changé, personne ne la
# recevrait : on s'arrête avant de publier.
if [ -f scripts/runtime-installe.txt ]; then
  WANT="$(grep -v '^#' scripts/runtime-installe.txt | tr -d '[:space:]')"
  HAVE="$(npx expo-updates fingerprint:generate --platform ios 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).hash))')"
  [ "$WANT" = "$HAVE" ] || { echo "Fingerprint différent du build installé ($HAVE au lieu de $WANT) : mise à jour annulée. Refaire un build, ou annuler le changement natif."; exit 1; }
else
  echo "Attention : scripts/runtime-installe.txt absent, fingerprint non vérifié."
fi

MSG="${1:-$(git log -1 --pretty=%s)}"
[ -d node_modules ] || npm ci --no-audit --no-fund

# Le bundle est construit ici puis vérifié : une mise à jour sans configuration Supabase ferait planter
# l'app au lancement sur tous les téléphones. Les guillemets simples sont voulus : les variables sont lues
# par le shell qui exécute la commande, jamais affichées.
EXPORT_VERIFIE='set -e
[ -n "${EXPO_PUBLIC_SUPABASE_URL:-}" ] && [ -n "${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}" ] || { echo "Configuration Supabase absente de l’environnement : mise à jour annulée."; exit 1; }
rm -rf dist
npx expo export --platform ios --output-dir dist
grep -rqaF "$EXPO_PUBLIC_SUPABASE_URL" dist/_expo/static/js/ios && grep -rqaF "$EXPO_PUBLIC_SUPABASE_ANON_KEY" dist/_expo/static/js/ios || { echo "Configuration Supabase absente du bundle : mise à jour annulée."; exit 1; }'

if [ -n "${EXPO_PUBLIC_SUPABASE_URL:-}" ] && [ -n "${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}" ]; then
  bash -c "$EXPORT_VERIFIE"
else
  npx --yes eas-cli@latest env:exec production "$EXPORT_VERIFIE" --non-interactive
fi

npx --yes eas-cli@latest update --channel production --environment production --platform ios --skip-bundler --input-dir dist --message "$MSG" --non-interactive
echo "Mise à jour envoyée. Ferme et rouvre l'app sur l'iPhone ; le bandeau « Nouvelle version prête » propose de redémarrer."
