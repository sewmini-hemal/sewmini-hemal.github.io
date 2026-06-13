import { useState, useEffect } from 'react';
import { login, logout, auth } from '../lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { LogIn, LogOut, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';

export default function AdminLogin() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        if (u.email === 'h.githmin@gmail.com' || u.email === 'h.githmin@gmail') {
          toast.success(`Welcome, ${u.displayName}`);
          navigate('/admin');
        } else {
          toast.error("Unauthorized access.");
          logout();
        }
      }
    });
  }, [navigate]);

  const handleLogin = async () => {
    try {
      await login();
    } catch (error) {
      toast.error("Failed to sign in. Please try again.");
    }
  };

  if (loading) return <div className="flex justify-center p-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" /></div>;

  return (
    <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-gold/10 p-8 text-center space-y-6">
      <div className="flex justify-center">
        <div className="w-16 h-16 bg-gold/5 rounded-full flex items-center justify-center text-gold">
          <ShieldCheck size={32} />
        </div>
      </div>
      <div>
        <h2 className="font-display text-2xl text-slate-800">Administrator Access</h2>
        <p className="text-slate-500 text-sm mt-2">Please sign in with your authorized email to manage guests and tables.</p>
      </div>

      <button
        onClick={handleLogin}
        className="w-full flex items-center justify-center gap-2 bg-gold-dark text-white py-3 rounded-xl font-medium hover:bg-gold transition-colors"
      >
        <LogIn size={20} />
        Sign in with Google
      </button>

      <p className="text-xs text-slate-400">
        Admin panel is restricted to authorized wedding organizers.
      </p>
    </div>
  );
}
