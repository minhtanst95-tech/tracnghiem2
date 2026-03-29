import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, signInWithGoogle, logout } from './firebase';
import { Toaster, toast } from 'sonner';
import { LogIn, LogOut, Shield, User as UserIcon, Home } from 'lucide-react';
import Setup from './components/Setup';
import Quiz from './components/Quiz';
import AdminPanel from './components/AdminPanel';

const ADMIN_EMAIL = "minhtanst95@gmail.com";

function Layout({ children, user }: { children: React.ReactNode, user: User | null }) {
  const isAdmin = user?.email === ADMIN_EMAIL;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white py-4 shadow-sm border-b-4 border-agri-green sticky top-0 z-50">
        <div className="max-w-md mx-auto px-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <h1 className="text-xl font-black text-agri-red tracking-tighter uppercase italic leading-none">
              HỆ THỐNG ÔN TẬP TRẮC NGHIỆM
            </h1>
          </Link>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link to="/admin" className="p-2 text-agri-green hover:bg-green-50 rounded-full transition" title="Admin Panel">
                <Shield size={20} />
              </Link>
            )}
            {user ? (
              <button onClick={logout} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition" title="Logout">
                <LogOut size={20} />
              </button>
            ) : (
              <button onClick={signInWithGoogle} className="p-2 text-agri-red hover:bg-red-50 rounded-full transition" title="Login">
                <LogIn size={20} />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full">
        {children}
      </main>
      
      <Toaster position="top-center" />
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-agri-red"></div>
      </div>
    );
  }

  return (
    <Router>
      <Layout user={user}>
        <Routes>
          <Route path="/" element={<Setup />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/admin" element={user?.email === ADMIN_EMAIL ? <AdminPanel /> : <Setup />} />
        </Routes>
      </Layout>
    </Router>
  );
}
