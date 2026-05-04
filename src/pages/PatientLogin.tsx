import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuthStore } from '../store/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { UserRound } from 'lucide-react';
import { toast } from 'sonner';

export default function PatientLogin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { patientData, setPatientData } = useAuthStore();
  const [patientId, setPatientId] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Clear any leftover Firebase Auth session so Patient Portal operates unauthenticated
    const clearAuth = async () => {
      const { getAuth, signOut } = await import('firebase/auth');
      const auth = getAuth();
      if (auth.currentUser) await signOut(auth);
      
      if (patientData) {
        navigate('/patient/dashboard');
      }
    };
    clearAuth();
  }, [patientData, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !loginCode) {
      toast.error("Please enter both Patient ID and Login Code");
      return;
    }

    setIsLoading(true);
    try {
      const q = query(
        collection(db, 'patients'), 
        where('id', '==', patientId),
        where('loginCode', '==', loginCode)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        toast.error("Invalid Patient ID or Login Code");
      } else {
        const doc = querySnapshot.docs[0];
        const data = { ...doc.data(), docId: doc.id };
        setPatientData(data);
        navigate('/patient/dashboard');
      }
    } catch (error: any) {
      console.error("Login error:", error);
      toast.error("Failed to login: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-slate-50 overflow-y-auto">
      <Card className="w-full max-w-md shadow-xl border-slate-200 my-auto">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto bg-emerald-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <UserRound className="w-8 h-8 text-emerald-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">{t('patient_portal')}</CardTitle>
          <CardDescription className="text-slate-500 mt-2">
            Enter your credentials provided by your doctor
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="patientId">{t('patient_id')}</Label>
              <Input 
                id="patientId" 
                placeholder="e.g. PAT-12345" 
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loginCode">{t('login_code')}</Label>
              <Input 
                id="loginCode" 
                type="password"
                placeholder="••••••" 
                value={loginCode}
                onChange={(e) => setLoginCode(e.target.value)}
                required
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white mt-6"
              disabled={isLoading}
            >
              {isLoading ? "Logging in..." : t('login')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
