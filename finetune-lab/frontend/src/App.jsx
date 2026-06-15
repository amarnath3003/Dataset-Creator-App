import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ModelSelectionPage from './modules/finetune/pages/ModelSelectionPage';
import DatasetSelectionPage from './modules/finetune/pages/DatasetSelectionPage';
import TrainingConfigPage from './modules/finetune/pages/TrainingConfigPage';
import HardwareSelectionPage from './modules/finetune/pages/HardwareSelectionPage';
import RunDashboard from './modules/finetune/pages/RunDashboard';
import WizardLayout from './components/WizardLayout';
import Navbar from './components/Navbar';
import { ToastProvider } from './components/Toast';
import './index.css';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <div className="flex flex-col min-h-screen bg-neu-base text-neu-text selection:bg-neu-accent selection:text-white font-sans antialiased overflow-x-hidden">
            <Navbar />
            <main className="flex-1 p-8 container mx-auto max-w-7xl animate-in fade-in duration-500">
              <Routes>
                <Route path="/" element={<Navigate to="/finetune/models" />} />
                <Route element={<WizardLayout />}>
                  <Route path="/finetune/models" element={<ModelSelectionPage />} />
                  <Route path="/finetune/datasets" element={<DatasetSelectionPage />} />
                  <Route path="/finetune/config" element={<TrainingConfigPage />} />
                  <Route path="/finetune/hardware" element={<HardwareSelectionPage />} />
                  <Route path="/finetune/runs/:id" element={<RunDashboard />} />
                </Route>
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
