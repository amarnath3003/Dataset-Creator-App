import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AppShell from "./components/AppShell";
import { ToastProvider } from "./components/Toast";
import ChatPage from "./modules/chat/pages/ChatPage";
import ComparePage from "./modules/chat/pages/ComparePage";
import ConversationsPage from "./modules/chat/pages/ConversationsPage";
import PresetsPage from "./modules/chat/pages/PresetsPage";
import "./index.css";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppShell />}>
              <Route index element={<Navigate to="/chat" replace />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="compare" element={<ComparePage />} />
              <Route path="conversations" element={<ConversationsPage />} />
              <Route path="presets" element={<PresetsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/chat" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
