import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuthStore } from '../store/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Stethoscope } from 'lucide-react';
import { toast } from 'sonner';
import BotCheckSlider from '../components/BotCheckSlider';

export default function DoctorLogin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { doctorUser, setDoctorUser } = useAuthStore();
  
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (doctorUser) {
      navigate('/doctor/dashboard');
    }
  }, [doctorUser, navigate]);

  const handleGoogleLogin = async () => {
    if (!isVerified) {
      toast.error("Please complete the bot check first.");
      return;
    }
    try {
      setIsLoading(true);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const docRef = doc(db, 'doctors', user.uid);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        await setDoc(docRef, {
          uid: user.uid,
          email: user.email,
          name: user.displayName || 'Doctor',
        });
      }
      
      setDoctorUser(user);
      navigate('/doctor/dashboard');
    } catch (error: any) {
      console.error("Login error:", error);
      toast.error("Failed to login: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVerified) {
      toast.error("Please complete the bot check first.");
      return;
    }

    try {
      setIsLoading(true);
      if (isLoginView) {
        const result = await signInWithEmailAndPassword(auth, email, password);
        setDoctorUser(result.user);
        navigate('/doctor/dashboard');
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;
        
        await setDoc(doc(db, 'doctors', user.uid), {
          uid: user.uid,
          email: user.email,
          name: name || 'Doctor',
        });
        
        setDoctorUser(user);
        navigate('/doctor/dashboard');
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-slate-50 overflow-y-auto">
      <Card className="w-full max-w-md shadow-xl border-slate-200 my-auto">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <Stethoscope className="w-8 h-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">
            {isLoginView ? 'Sign in to Doctor Portal' : 'Apply for Doctor Portal'}
          </CardTitle>
          <CardDescription className="text-slate-500 mt-2">
            Secure access for healthcare professionals
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          {/* Tabs */}
          <div className="flex p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => setIsLoginView(true)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${isLoginView ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsLoginView(false)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${!isLoginView ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleEmailAuth} className="flex flex-col gap-4">
            {!isLoginView && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input 
                  id="name" 
                  placeholder="Dr. John Doe" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  required={!isLoginView}
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="doctor@hospital.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <BotCheckSlider onVerify={() => setIsVerified(true)} />

            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!isVerified || isLoading}
            >
              {isLoading ? 'Processing...' : (isLoginView ? 'Sign In' : 'Sign Up')}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-500">Or continue with</span>
            </div>
          </div>

          <Button 
            onClick={(e) => {
              e.preventDefault();
              handleGoogleLogin();
            }} 
            variant="outline"
            disabled={!isVerified || isLoading}
            className="w-full bg-white border-slate-300 text-slate-700 hover:bg-slate-50 h-10 text-sm font-medium flex items-center justify-center gap-3"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
              <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
              </g>
            </svg>
            Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
