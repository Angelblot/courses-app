import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { WizardPage } from './pages/WizardPage.jsx';
import { RecipesPage } from './pages/RecipesPage.jsx';
import { ProductsPage } from './pages/ProductsPage.jsx';
import { ListsPage } from './pages/ListsPage.jsx';
import { CategoriesPage } from './pages/CategoriesPage.jsx';
import { DrivesPage } from './pages/DrivesPage.jsx';
import { ResultsPage } from './pages/ResultsPage.jsx';
import { useAuthStore } from './stores/authStore.js';

export default function App() {
  const status = useAuthStore((s) => s.status);
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  // Session initiale inconnue : ne rien afficher plutôt qu'un flash de
  // l'écran de connexion pour un utilisateur déjà connecté.
  if (status === 'loading') return null;

  if (status === 'signed_out') return <LoginPage />;

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/wizard" element={<Navigate to="/wizard/recipes" replace />} />
          <Route path="/wizard/:step" element={<WizardPage />} />
          <Route path="/results/:sessionId" element={<ResultsPage />} />
          <Route path="/recipes" element={<RecipesPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/lists" element={<ListsPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/drives" element={<DrivesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
