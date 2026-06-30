import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Navbar from './components/Navbar';
import { ToastProvider } from './components/Toast';
import ChatPage from './modules/chat/pages/ChatPage';
import ComparePage from './modules/chat/pages/ComparePage';
import ConversationsPage from './modules/chat/pages/ConversationsPage';
import PresetsPage from './modules/chat/pages/PresetsPage';
import './index.css';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <div className="flex flex-col min-h-screen bg-neu-base text-neu-text selection:bg-neu-accent selection:text-white font-sans antialiased overflow-x-hidden">
            <Navbar />
            <main className="flex-1 px-8 pb-8 container mx-auto max-w-7xl animate-in fade-in duration-500">
              <Routes>
                <Route path="/" element={<Navigate to="/chat" />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/compare" element={<ComparePage />} />
                <Route path="/conversations" element={<ConversationsPage />} />
                <Route path="/presets" element={<PresetsPage />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
