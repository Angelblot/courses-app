#!/bin/bash

echo "🛒 Courses App - Lancement..."
echo "==========================="

# Lancer le backend
echo "🚀 Démarrage du backend FastAPI sur http://localhost:8000"
cd ~/courses-app/backend
python3 main.py &
BACKEND_PID=$!

sleep 3

# Lancer le frontend
echo "🎯 Démarrage du frontend React sur http://localhost:5173"
cd ~/courses-app/frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ App lancée!"
echo "   Frontend: http://localhost:5173"
echo "   Backend API: http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "Appuie sur Ctrl+C pour tout arrêter"

wait
