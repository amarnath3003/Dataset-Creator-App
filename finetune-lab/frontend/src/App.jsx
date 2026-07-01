import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import AppShell from "./components/AppShell";
import WizardLayout from "./components/WizardLayout";
import { ToastProvider } from "./components/Toast";
import { WizardProvider } from "./modules/finetune/context/WizardContext";
import { SettingsProvider } from "./modules/finetune/context/SettingsContext";

import DashboardPage from "./modules/finetune/pages/DashboardPage";
import RunsPage from "./modules/finetune/pages/RunsPage";
import ModelsPage from "./modules/finetune/pages/ModelsPage";
import ExportsPage from "./modules/finetune/pages/ExportsPage";
import SettingsPage from "./modules/finetune/pages/SettingsPage";
import RunDashboard from "./modules/finetune/pages/RunDashboard";

import ModelSelectionPage from "./modules/finetune/pages/ModelSelectionPage";
import DatasetSelectionPage from "./modules/finetune/pages/DatasetSelectionPage";
import TrainingConfigPage from "./modules/finetune/pages/TrainingConfigPage";
import HardwareSelectionPage from "./modules/finetune/pages/HardwareSelectionPage";
import ReviewPage from "./modules/finetune/pages/ReviewPage";

import "./index.css";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <WizardProvider>
          <ToastProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Navigate to="/finetune/dashboard" replace />} />
                <Route path="/finetune" element={<AppShell />}>
                  <Route index element={<Navigate to="/finetune/dashboard" replace />} />
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="runs" element={<RunsPage />} />
                  <Route path="runs/:id" element={<RunDashboard />} />
                  <Route path="models" element={<ModelsPage />} />
                  <Route path="exports" element={<ExportsPage />} />
                  <Route path="settings" element={<SettingsPage />} />

                  <Route path="new" element={<WizardLayout />}>
                    <Route index element={<Navigate to="/finetune/new/model" replace />} />
                    <Route path="model" element={<ModelSelectionPage />} />
                    <Route path="dataset" element={<DatasetSelectionPage />} />
                    <Route path="config" element={<TrainingConfigPage />} />
                    <Route path="hardware" element={<HardwareSelectionPage />} />
                    <Route path="review" element={<ReviewPage />} />
                  </Route>
                </Route>
                <Route path="*" element={<Navigate to="/finetune/dashboard" replace />} />
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </WizardProvider>
      </SettingsProvider>
    </QueryClientProvider>
  );
}

export default App;
