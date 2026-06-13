import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Settings, Home, Heart, Flower } from 'lucide-react';
import GuestSearch from './components/GuestSearch';
import AdminPanel from './components/AdminPanel';
import AdminLogin from './components/AdminLogin';
import { auth } from './lib/firebase';
import { ReactNode, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';

function Layout({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const location = useLocation();

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  return (
    <div className="min-h-screen floral-gradient flex flex-col relative overflow-hidden">
      {/* Decorative Flowers */}
      <motion.div 
        initial={{ opacity: 0, rotate: -45 }}
        animate={{ opacity: 0.1, rotate: 0 }}
        className="fixed -top-10 -left-10 text-skyblue pointer-events-none"
      >
        <Flower size={200} />
      </motion.div>
      <motion.div 
        initial={{ opacity: 0, rotate: 45 }}
        animate={{ opacity: 0.1, rotate: 0 }}
        className="fixed -bottom-20 -right-20 text-beige pointer-events-none"
      >
        <Flower size={300} />
      </motion.div>

      <header className="py-4 md:py-8 px-4 text-center relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <div className="flex justify-center items-center gap-4 text-beige mb-2">
            <div className="h-px w-12 bg-beige/30" />
            <Flower size={20} className="text-beige" />
            <div className="h-px w-12 bg-beige/30" />
          </div>
          <h1 className="font-display text-4xl md:text-5xl text-darkblue italic">
            Sewmini & Hemal
          </h1>
          <p className="font-serif uppercase tracking-[0.2em] text-sm text-darkblue/60">
            Table Assignments • June 15, 2026
          </p>
        </motion.div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 pb-20 relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {user && (user.email === 'h.githmin@gmail.com' || user.email === 'h.githmin@gmail') && (
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md border border-beige/30 rounded-full px-6 py-3 shadow-xl flex items-center gap-8 z-50">
          <Link to="/" className={`flex items-center gap-2 hover:text-skyblue transition-colors ${location.pathname === '/' ? 'text-darkblue font-bold' : 'text-darkblue/40'}`}>
            <Search size={20} />
            <span className="text-sm font-medium">Search</span>
          </Link>
          <Link to="/admin" className={`flex items-center gap-2 hover:text-skyblue transition-colors ${location.pathname.startsWith('/admin') ? 'text-darkblue font-bold' : 'text-darkblue/40'}`}>
            <Settings size={20} />
            <span className="text-sm font-medium">Admin</span>
          </Link>
        </nav>
      )}
      <Toaster position="top-center" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<GuestSearch />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/admin/login" element={<AdminLogin />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
