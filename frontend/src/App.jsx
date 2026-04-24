import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { WizardPage } from './pages/WizardPage.jsx';
import { RecipesPage } from './pages/RecipesPage.jsx';
import { ProductsPage } from './pages/ProductsPage.jsx';
import { ListsPage } from './pages/ListsPage.jsx';
import { DrivesPage } from './pages/DrivesPage.jsx';
import { ResultsPage } from './pages/ResultsPage.jsx';

export default function App() {
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
          <Route path="/drives" element={<DrivesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
