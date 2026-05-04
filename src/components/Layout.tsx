import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Activity } from 'lucide-react';
import { useEffect } from 'react';

export default function Layout() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { doctorUser, patientData, logout } = useAuthStore();

  useEffect(() => {
    // If we navigate away from dashboards to landing/login pages, ensure dark mode is disabled
    if (!location.pathname.includes('/dashboard')) {
      document.documentElement.classList.remove('dark');
    }
  }, [location.pathname]);

  const handleLogout = async () => {
    if (doctorUser) {
      await signOut(auth);
    }
    logout();
    navigate('/');
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="h-[100dvh] w-screen overflow-hidden bg-slate-50 flex flex-col font-sans">
      <main className="flex-1 flex flex-col min-h-0 overflow-y-auto md:overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
