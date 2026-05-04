import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, orderBy, getDocs } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Switch } from '../components/ui/switch';
import { Plus, Users, Activity, Pill, Video, Home, MessageSquare, Bot, Settings, UserCircle, Send, Bell, Moon, Sun, Camera, Lock, LogOut, ArrowLeft, FastForward, Rewind } from 'lucide-react';
import { toast } from 'sonner';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';
import { encryptText, decryptText } from '../lib/encryption';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

import { get } from 'idb-keyval';

function LocalVideoPlayer({ url, className }: { url: string, className?: string }) {
  const [src, setSrc] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [clarity, setClarity] = useState(100);

  useEffect(() => {
    if (url && url.startsWith('localdb://')) {
      const key = url.replace('localdb://', '');
      get(key).then((blob: Blob | undefined) => {
        if (blob) {
          setSrc(URL.createObjectURL(blob));
        }
      });
    } else {
      setSrc(url || '');
    }
    
    return () => {
      if (src && src.startsWith('blob:')) {
        URL.revokeObjectURL(src);
      }
    };
  }, [url]);

  const handleForward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime += 5;
    }
  };

  const handleBackward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime -= 5;
    }
  };

  const increaseSpeed = () => {
    if (videoRef.current) {
      const newRate = Math.min(videoRef.current.playbackRate + 0.25, 3);
      videoRef.current.playbackRate = newRate;
      setPlaybackRate(newRate);
    }
  };

  const decreaseSpeed = () => {
    if (videoRef.current) {
      const newRate = Math.max(videoRef.current.playbackRate - 0.25, 0.25);
      videoRef.current.playbackRate = newRate;
      setPlaybackRate(newRate);
    }
  };

  const increaseClarity = () => {
    setClarity(prev => Math.min(prev + 20, 200));
  };
  
  const decreaseClarity = () => {
    setClarity(prev => Math.max(prev - 20, 20));
  };

  return (
    <div className="flex flex-col gap-2">
      <video 
        ref={videoRef}
        src={src || undefined} 
        controls 
        className={className} 
        style={{ filter: `contrast(${clarity}%) brightness(${100 + (clarity - 100) / 2}%) saturate(${clarity}%)` }}
      />
      <div className="flex flex-wrap items-center justify-between bg-slate-100 dark:bg-slate-800 p-2 rounded-lg gap-2 text-xs">
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 rounded p-1 shadow-sm">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleBackward} title="Backward 5s">
            <Rewind className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleForward} title="Forward 5s">
            <FastForward className="h-3 w-3" />
          </Button>
        </div>
        
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 rounded p-1 shadow-sm">
          <span className="font-semibold text-[10px] uppercase text-slate-500 ml-1">Speed</span>
          <Button variant="ghost" size="sm" className="h-6 px-1.5 min-w-6 text-xs" onClick={decreaseSpeed}>-</Button>
          <span className="w-8 text-center font-mono">{playbackRate}x</span>
          <Button variant="ghost" size="sm" className="h-6 px-1.5 min-w-6 text-xs" onClick={increaseSpeed}>+</Button>
        </div>

        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 rounded p-1 shadow-sm">
          <span className="font-semibold text-[10px] uppercase text-slate-500 ml-1">Clarity</span>
          <Button variant="ghost" size="sm" className="h-6 px-1.5 min-w-6 text-xs" onClick={decreaseClarity}>-</Button>
          <span className="w-8 text-center font-mono">{clarity}%</span>
          <Button variant="ghost" size="sm" className="h-6 px-1.5 min-w-6 text-xs" onClick={increaseClarity}>+</Button>
        </div>
      </div>
    </div>
  );
}

export default function DoctorDashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { doctorUser, logout } = useAuthStore();
  
  const [activeTab, setActiveTab] = useState<'home' | 'patients' | 'messages' | 'ai' | 'settings' | 'profile'>('home');
  
  const [doctorProfile, setDoctorProfile] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [medications, setMedications] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  
  const [notifications, setNotifications] = useState<any[]>([]);

  const theme = doctorProfile?.themePreference || 'light';

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    return () => {
      document.documentElement.classList.remove('dark');
    };
  }, [theme]);

  const setTheme = async (newTheme: 'light' | 'dark') => {
    if (!doctorUser) return;
    try {
      await updateDoc(doc(db, 'doctors', doctorUser.uid), { themePreference: newTheme });
    } catch (e: any) {
      toast.error('Failed to save theme: ' + e.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      logout();
      navigate('/');
    } catch (error) {
      console.error(error);
    }
  };
  
  useEffect(() => {
    if (!doctorUser) {
      navigate('/doctor/login');
      return;
    }

    const unsubProfile = onSnapshot(doc(db, 'doctors', doctorUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        setDoctorProfile(docSnap.data());
      }
    });

    const q = query(collection(db, 'patients'), where('doctorUid', '==', doctorUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pts = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
      setPatients(pts);
    });

    return () => {
      unsubProfile();
      unsubscribe();
    };
  }, [doctorUser, navigate]);

  useEffect(() => {
    if (!doctorUser) return;
    const vidQ = query(collection(db, 'videoSubmissions'), where('doctorUid', '==', doctorUser.uid));
    const unsubVid = onSnapshot(vidQ, (snapshot) => {
      const vids = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() })) as any[];
      vids.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setVideos(vids);
      setNotifications(vids.filter(v => v.status === 'pending').slice(0, 5));
    });

    const msgQ = query(collection(db, 'messages'), where('doctorUid', '==', doctorUser.uid));
    const unsubMsg = onSnapshot(msgQ, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
      setMessages(msgs);
    });

    return () => {
      unsubVid();
      unsubMsg();
    };
  }, [doctorUser]);

  useEffect(() => {
    if (!doctorUser || !selectedPatient) return;
    const medQ = query(collection(db, 'medications'), where('patientId', '==', selectedPatient.id), where('doctorUid', '==', doctorUser.uid));
    const unsubMed = onSnapshot(medQ, (snapshot) => {
      setMedications(snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() })));
    });
    return () => unsubMed();
  }, [doctorUser, selectedPatient]);

  if (!doctorUser) return null;

  return (
    <div className={`flex flex-col md:flex-row h-full w-full overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-500 ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Sidebar Navigation */}
      <div className="hidden md:flex w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col transition-colors duration-500 shrink-0">
        <div className="p-6">
          <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-400 dark:from-purple-500 dark:to-purple-300">
            Cardio AI Doctor
          </h2>
        </div>
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          {[
            { id: 'home', icon: Home, label: 'Home' },
            { id: 'patients', icon: Users, label: 'Patients' },
            { id: 'messages', icon: MessageSquare, label: 'Messages', badge: messages.filter(m => m.sender === 'patient' && !m.read).length },
            { id: 'ai', icon: Bot, label: 'Helper AI' },
            { id: 'settings', icon: Settings, label: 'Settings' },
            { id: 'profile', icon: UserCircle, label: 'Profile' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 relative ${
                activeTab === item.id 
                  ? 'bg-blue-50 text-blue-600 dark:bg-purple-900/30 dark:text-purple-400 font-medium shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
              {item.badge && item.badge > 0 ? (
                <div className="absolute right-4 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {item.badge}
                </div>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="p-4 mt-auto">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto relative pb-20 md:pb-0 w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            {activeTab === 'home' && <HomeTab doctorUser={doctorProfile || doctorUser} patients={patients} notifications={notifications} unreadMessagesCount={messages.filter(m => m.sender === 'patient' && !m.read).length} />}
            {activeTab === 'patients' && (
              <PatientsTab 
                doctorUser={doctorUser} 
                patients={patients} 
                selectedPatient={selectedPatient} 
                setSelectedPatient={setSelectedPatient} 
                medications={medications}
                videos={videos.filter(v => v.patientId === selectedPatient?.id)}
              />
            )}
            {activeTab === 'messages' && <MessagesTab doctorUser={doctorUser} patients={patients} allMessages={messages} />}
            {activeTab === 'ai' && <HelperAITab />}
            {activeTab === 'settings' && <SettingsTab theme={theme} setTheme={setTheme} />}
            {activeTab === 'profile' && <ProfileTab doctorUser={doctorProfile || doctorUser} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around p-2 z-50">
        {[
          { id: 'home', icon: Home, label: 'Home' },
          { id: 'patients', icon: Users, label: 'Patients' },
          { id: 'messages', icon: MessageSquare, label: 'Messages', badge: messages.filter(m => m.sender === 'patient' && !m.read).length },
          { id: 'ai', icon: Bot, label: 'AI' },
          { id: 'settings', icon: Settings, label: 'Settings' }
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as any)}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-300 relative ${
              activeTab === item.id 
                ? 'text-blue-600 dark:text-purple-400' 
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px]">{item.label}</span>
            {item.badge && item.badge > 0 ? (
              <div className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-white dark:border-slate-900">
                {item.badge}
              </div>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

// --- TAB COMPONENTS ---

// 1. HOME TAB
function HomeTab({ doctorUser, patients, notifications, unreadMessagesCount }: any) {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-800 transition-colors duration-500">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-purple-400 dark:to-pink-500">
          Good day, Dr. {doctorUser.name || 'Doctor'}!
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Here is what's happening with your patients today.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="dark:bg-slate-900 border-none shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500 dark:text-purple-400"/> Total Patients
            </CardTitle>
          </CardHeader>
          <CardContent><div className="text-4xl font-bold text-slate-900 dark:text-slate-100">{patients.length}</div></CardContent>
        </Card>
        
        <Card className="dark:bg-slate-900 border-none shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-500 dark:text-purple-400"/> Unread Messages
            </CardTitle>
          </CardHeader>
          <CardContent><div className="text-4xl font-bold text-slate-900 dark:text-slate-100">{unreadMessagesCount}</div></CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Bell className="w-5 h-5 text-blue-600 dark:text-purple-500" /> Recent Activity
        </h3>
        {notifications.length === 0 ? (
          <div className="text-center p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 text-slate-500">
            No new pending videos.
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif: any) => {
              const patient = patients.find((p:any) => p.id === notif.patientId);
              return (
                <div key={notif.docId} className="flex gap-4 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-500">
                  <div className="flex-shrink-0 bg-blue-50 dark:bg-purple-900/30 p-3 rounded-full h-12 w-12 flex items-center justify-center">
                    <Video className="w-5 h-5 text-blue-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold">{patient?.name || 'Unknown Patient'} uploaded a {notif.type} video</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {/* AI Summary Simulation based on result */}
                      <span className="font-medium text-blue-600 dark:text-purple-400 block mb-1">AI Summary:</span>
                      {notif.aiValidationResult || "Video appears to show patient performing the scheduled activity. Please review."}
                    </p>
                    <span className="text-xs text-slate-400 mt-2 block">{new Date(notif.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// 2. PATIENTS TAB

function AIHealthTrendAnalysis({ patient }: { patient: any }) {
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    setAnalysis('');
    setError('');
  }, [patient.id]);

  const analyzeTrends = async () => {
    setLoading(true);
    setError('');
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API Key is not configured.");
      }
      const ai = new GoogleGenAI({ apiKey });

      // Generate realistic mock historical data to show trends
      const baseBpm = patient.bpm || 80;
      const baseSugar = patient.bloodSugar || 90;
      const baseSpO2 = patient.spO2 || 98;
      
      const mockHistory = [
        { period: '4 weeks ago', bpm: baseBpm - Math.floor(Math.random() * 5 + 5), bloodSugar: baseSugar - Math.floor(Math.random() * 4 + 2), spO2: baseSpO2 + 1 },
        { period: '3 weeks ago', bpm: baseBpm - Math.floor(Math.random() * 4 + 2), bloodSugar: baseSugar - Math.floor(Math.random() * 3 + 1), spO2: baseSpO2 },
        { period: '2 weeks ago', bpm: baseBpm - Math.floor(Math.random() * 2), bloodSugar: baseSugar + Math.floor(Math.random() * 2), spO2: baseSpO2 - 1 },
        { period: '1 week ago', bpm: baseBpm + Math.floor(Math.random() * 2 + 1), bloodSugar: baseSugar + Math.floor(Math.random() * 3 + 1), spO2: baseSpO2 },
        { period: 'Current', bpm: baseBpm, bloodSugar: baseSugar, spO2: baseSpO2 },
      ];

      const prompt = `Analyze the following historical health data for patient ${patient.name}.

Data (last 4 weeks):
${JSON.stringify(mockHistory, null, 2)}

Identify any significant trends, anomalies, or potential health risks. Present these insights directly to the doctor in a concise, professional medical tone. Highlighting things like "Patient's BPM has been steadily increasing" or "SpO2 levels dropped slightly". Please provide a maximum of 3 bullet points. Do not include introductory text, start straight with the bullet points.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          temperature: 0.2
        }
      });

      setAnalysis(response.text || "Unable to generate analysis.");
    } catch (err: any) {
      setError(err.message || "An error occurred during analysis.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="dark:bg-slate-900 border-none shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 mt-6">
      <CardHeader className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-slate-800/50 dark:to-slate-900/50 pb-4 border-b border-slate-100 dark:border-slate-800 rounded-t-xl">
        <CardTitle className="text-lg flex items-center gap-2">
          <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          AI Health Trend Analysis
        </CardTitle>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Analyze {patient.name}'s historical vitals using Gemini 3.1 Pro to identify trends and risks.
        </p>
      </CardHeader>
      <CardContent className="pt-6">
        {analysis ? (
          <div className="space-y-4">
            <div className="prose prose-sm dark:prose-invert max-w-none">
               {analysis.split('\n').map((line, i) => (
                  <p key={i} className="mb-2 text-slate-700 dark:text-slate-300">
                     {line}
                  </p>
               ))}
            </div>
            <Button variant="outline" size="sm" onClick={analyzeTrends} disabled={loading} className="w-full sm:w-auto">
               <Activity className="w-4 h-4 mr-2" />
               {loading ? 'Re-analyzing...' : 'Refresh Analysis'}
            </Button>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg text-sm mb-4">
            {error}
            <Button variant="outline" size="sm" onClick={analyzeTrends} className="mt-2 w-full dark:border-red-800 dark:text-red-300">
               Retry
            </Button>
          </div>
        ) : (
          <div className="text-center py-6">
            <Bot className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Click below to generate a comprehensive trend analysis based on the patient's recent vitals.
            </p>
            <Button onClick={analyzeTrends} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <Activity className="w-4 h-4 mr-2" />
              {loading ? 'Analyzing Trends...' : 'Generate AI Analysis'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PatientsTab({ doctorUser, patients, selectedPatient, setSelectedPatient, medications, videos }: any) {
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [newPatient, setNewPatient] = useState({ name: '', age: '', bpm: '', bloodSugar: '', spO2: '', fitnessLevel: 'Beginner', needsMeditation: false });
  const [isAddMedOpen, setIsAddMedOpen] = useState(false);
  const [newMed, setNewMed] = useState({ name: '', time: '' });

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    const patientId = `PAT-${Math.floor(10000 + Math.random() * 90000)}`;
    const loginCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      await addDoc(collection(db, 'patients'), {
        id: patientId, doctorUid: doctorUser.uid, name: newPatient.name,
        age: parseInt(newPatient.age) || null, loginCode,
        bpm: parseInt(newPatient.bpm) || null, bloodSugar: parseInt(newPatient.bloodSugar) || null,
        spO2: parseInt(newPatient.spO2) || null, fitnessLevel: newPatient.fitnessLevel,
        needsMeditation: newPatient.needsMeditation
      });
      toast.success("Patient added successfully");
      setIsAddPatientOpen(false);
      setNewPatient({ name: '', age: '', bpm: '', bloodSugar: '', spO2: '', fitnessLevel: 'Beginner', needsMeditation: false });
    } catch (e: any) { toast.error(e.message); }
  };

  const handleAddMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'medications'), {
        id: `MED-${Date.now()}`, patientId: selectedPatient.id, doctorUid: doctorUser.uid,
        name: newMed.name, dosageTimes: [newMed.time]
      });
      toast.success("Medication added");
      setIsAddMedOpen(false);
      setNewMed({ name: '', time: '' });
    } catch (error: any) { toast.error(error.message); }
  };

  return (
    <div className="flex h-full bg-white dark:bg-slate-950">
      {/* Patient List - hidden on mobile when a patient is selected */}
      <div className={`w-full md:w-1/3 md:min-w-[300px] border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col transition-colors duration-500 ${selectedPatient ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="font-bold text-lg dark:text-slate-100">Patients Directory</h3>
          <Dialog open={isAddPatientOpen} onOpenChange={setIsAddPatientOpen}>
            <DialogTrigger render={<Button size="icon" className="h-8 w-8 rounded-full bg-blue-600 hover:bg-blue-700 dark:bg-purple-600 dark:hover:bg-purple-700 text-white"><Plus className="w-4 h-4" /></Button>} />
            <DialogContent className="dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100">
              <DialogHeader><DialogTitle>Add New Patient</DialogTitle></DialogHeader>
              <form onSubmit={handleAddPatient} className="space-y-4">
                <div className="space-y-2"><Label>Name</Label><Input required value={newPatient.name} onChange={e=>setNewPatient({...newPatient, name: e.target.value})} className="dark:bg-slate-800 dark:border-slate-700"/></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Age</Label><Input type="number" value={newPatient.age} onChange={e=>setNewPatient({...newPatient, age: e.target.value})} className="dark:bg-slate-800 dark:border-slate-700"/></div>
                  <div className="space-y-2"><Label>Fitness Level</Label>
                    <Select value={newPatient.fitnessLevel} onValueChange={v=>setNewPatient({...newPatient, fitnessLevel: v})}>
                      <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700"><SelectValue/></SelectTrigger>
                      <SelectContent className="dark:bg-slate-800 dark:border-slate-700"><SelectItem value="Beginner">Beginner</SelectItem><SelectItem value="Intermediate">Intermediate</SelectItem><SelectItem value="Advanced">Advanced</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>BPM</Label><Input type="number" value={newPatient.bpm} onChange={e=>setNewPatient({...newPatient, bpm: e.target.value})} className="dark:bg-slate-800 dark:border-slate-700"/></div>
                  <div className="space-y-2"><Label>Sugar</Label><Input type="number" value={newPatient.bloodSugar} onChange={e=>setNewPatient({...newPatient, bloodSugar: e.target.value})} className="dark:bg-slate-800 dark:border-slate-700"/></div>
                  <div className="space-y-2"><Label>SpO2</Label><Input type="number" value={newPatient.spO2} onChange={e=>setNewPatient({...newPatient, spO2: e.target.value})} className="dark:bg-slate-800 dark:border-slate-700"/></div>
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Switch id="needs-meditation" checked={newPatient.needsMeditation} onCheckedChange={v=>setNewPatient({...newPatient, needsMeditation: v})} />
                  <Label htmlFor="needs-meditation">Needs Meditation?</Label>
                </div>
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-purple-600 dark:hover:bg-purple-700 text-white">Save Patient</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <ScrollArea className="flex-1 p-2">
          <div className="space-y-1">
            {patients.map((p:any) => (
              <button key={p.id} onClick={() => setSelectedPatient(p)} className={`w-full text-left p-3 rounded-lg transition-all ${selectedPatient?.id === p.id ? 'bg-blue-50 dark:bg-purple-900/40 text-blue-700 dark:text-purple-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}>
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">ID: {p.id}</div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Patient Details - hidden on mobile when no patient is selected */}
      <div className={`flex-1 bg-slate-50 dark:bg-slate-950 p-4 md:p-6 overflow-y-auto transition-colors duration-500 ${!selectedPatient ? 'hidden md:block' : 'block w-full'}`}>
        {selectedPatient ? (
          <div className="max-w-4xl mx-auto space-y-6">
             <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
               <div className="flex items-center gap-4 mb-4 md:hidden">
                 <Button variant="ghost" size="icon" onClick={() => setSelectedPatient(null)} className="-ml-2">
                   <ArrowLeft className="w-5 h-5" />
                 </Button>
                 <h3 className="font-bold">Patient Details</h3>
               </div>
               
               <div className="flex justify-between items-start">
                 <div>
                    <h2 className="text-2xl md:text-3xl font-bold dark:text-slate-100">{selectedPatient.name}</h2>
                    <div className="flex flex-wrap gap-2 md:gap-3 mt-3 text-sm">
                      <Badge variant="secondary" className="font-mono dark:bg-slate-800 dark:text-slate-300">ID: {selectedPatient.id}</Badge>
                      <Badge variant="secondary" className="font-mono dark:bg-slate-800 dark:text-slate-300">Code: {selectedPatient.loginCode}</Badge>
                    </div>
                 </div>
                 <Badge className="bg-blue-100 text-blue-700 dark:bg-purple-900/50 dark:text-purple-300 hover:bg-blue-200">{selectedPatient.fitnessLevel}</Badge>
               </div>
             </div>

             <div className="grid grid-cols-3 gap-4">
              <Card className="dark:bg-slate-900 border-none shadow-sm ring-1 ring-slate-100 dark:ring-slate-800"><CardHeader className="pb-2"><CardTitle className="text-sm text-red-500 flex items-center gap-2">BPM</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{selectedPatient.bpm || '--'}</div></CardContent></Card>
              <Card className="dark:bg-slate-900 border-none shadow-sm ring-1 ring-slate-100 dark:ring-slate-800"><CardHeader className="pb-2"><CardTitle className="text-sm text-blue-500 dark:text-purple-400 flex items-center gap-2">Blood Sugar</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{selectedPatient.bloodSugar || '--'}</div></CardContent></Card>
              <Card className="dark:bg-slate-900 border-none shadow-sm ring-1 ring-slate-100 dark:ring-slate-800"><CardHeader className="pb-2"><CardTitle className="text-sm text-emerald-500 flex items-center gap-2">SpO2</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{selectedPatient.spO2 ? `${selectedPatient.spO2}%` : '--'}</div></CardContent></Card>
            </div>

            <AIHealthTrendAnalysis patient={selectedPatient} />

            <Tabs defaultValue="medications" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-slate-200/50 dark:bg-slate-800 p-1">
                <TabsTrigger value="medications" className="dark:data-[state=active]:bg-slate-900 dark:text-slate-300">Medications</TabsTrigger>
                <TabsTrigger value="videos" className="dark:data-[state=active]:bg-slate-900 dark:text-slate-300">Videos</TabsTrigger>
              </TabsList>
              <TabsContent value="medications" className="mt-4">
                <Card className="dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                  <CardHeader className="flex flex-row justify-between items-center">
                    <CardTitle>Medications</CardTitle>
                    <Dialog open={isAddMedOpen} onOpenChange={setIsAddMedOpen}>
                      <DialogTrigger render={<Button size="sm" className="bg-blue-600 hover:bg-blue-700 dark:bg-purple-600 dark:hover:bg-purple-700 text-white"><Plus className="w-4 h-4 mr-1"/> Add</Button>} />
                      <DialogContent className="dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100">
                        <DialogHeader><DialogTitle>Add Medication</DialogTitle></DialogHeader>
                        <form onSubmit={handleAddMedication} className="space-y-4">
                          <Label>Name</Label><Input required value={newMed.name} onChange={e=>setNewMed({...newMed, name:e.target.value})} className="dark:bg-slate-800"/>
                          <Label>Time</Label><Input type="time" required value={newMed.time} onChange={e=>setNewMed({...newMed, time:e.target.value})} className="dark:bg-slate-800"/>
                          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-purple-600 dark:hover:bg-purple-700 text-white">Save</Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    {medications.map((m:any) => (
                      <div key={m.id} className="flex justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg mb-2">
                        <span className="font-semibold dark:text-slate-100">{m.name}</span>
                        <div className="flex gap-2">{m.dosageTimes.map((t:any,i:number)=><Badge key={i} className="dark:bg-slate-700">{t}</Badge>)}</div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="videos" className="mt-4">
                <Card className="dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                  <CardHeader><CardTitle>Video Proofs</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    {videos.map((v:any) => (
                      <div key={v.id} className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                        <LocalVideoPlayer url={v.videoUrl} className="w-full h-32 object-cover bg-black"/>
                        <div className="p-3">
                          <div className="flex justify-between text-xs mb-2">
                            <Badge variant="outline" className="dark:border-slate-700">{v.type}</Badge>
                            <span className="text-slate-500">{new Date(v.timestamp).toLocaleDateString()}</span>
                          </div>
                          {v.status === 'pending' ? (
                            <Button size="sm" className="w-full" onClick={()=>updateDoc(doc(db, 'videoSubmissions', v.docId), {status: 'reviewed'})}>Mark Reviewed</Button>
                          ) : (
                            <Badge variant="secondary" className="w-full justify-center bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">Reviewed</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

          </div>
        ) : (
           <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600">
             <Users className="w-20 h-20 mb-4 opacity-20" />
             <p>Select a patient to view their profile</p>
           </div>
        )}
      </div>
    </div>
  );
}

// 3. MESSAGES TAB (Secure Chat)
function MessagesTab({ doctorUser, patients, allMessages }: any) {
  const [selectedPatient, setSelectedPatient] = useState<any|null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!doctorUser || !selectedPatient) return;
    const q = query(
      collection(db, 'messages'),
      where('doctorUid', '==', doctorUser.uid),
      where('patientId', '==', selectedPatient.id),
      orderBy('timestamp', 'asc')
    );
    const sharedKey = `${selectedPatient.id}-${selectedPatient.loginCode}`;
    const unsub = onSnapshot(q, async (snap) => {
      const msgs = await Promise.all(snap.docs.map(async (doc) => {
        const data = doc.data();
        let decryptedText = data.text;
        if (data.isEncrypted) {
          decryptedText = await decryptText(data.text, sharedKey);
        }
        return { id: doc.id, ...data, text: decryptedText };
      }));
      setMessages(msgs);
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      
      const unreadMsgs = snap.docs.filter(doc => doc.data().sender === 'patient' && !doc.data().read);
      unreadMsgs.forEach(async (d) => {
        try {
          await updateDoc(d.ref, { read: true });
        } catch (e) {
          console.error("Failed to mark read", e);
        }
      });
    });
    return () => unsub();
  }, [doctorUser, selectedPatient]);

  const handleSelectPatient = async (p: any) => {
    setSelectedPatient(p);
    
    // Mark messages as read
    const unreadMsgs = allMessages?.filter((m: any) => m.sender === 'patient' && !m.read && m.patientId === p.id) || [];
    for (const msg of unreadMsgs) {
      try {
        await updateDoc(doc(db, 'messages', msg.docId), { read: true });
      } catch (e) {
        console.error("Failed to mark message as read", e);
      }
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedPatient) return;
    try {
      const sharedKey = `${selectedPatient.id}-${selectedPatient.loginCode}`;
      const encryptedMessage = await encryptText(newMessage, sharedKey);
      
      await addDoc(collection(db, 'messages'), {
        doctorUid: doctorUser.uid,
        patientId: selectedPatient.id,
        sender: 'doctor',
        text: encryptedMessage,
        isEncrypted: true,
        read: false,
        timestamp: new Date().toISOString()
      });
      setNewMessage("");
    } catch(e:any) { toast.error("Error: " + e.message); }
  };

  return (
    <div className="flex h-full bg-white dark:bg-slate-950">
      <div className={`w-full md:w-1/3 md:min-w-[300px] border-r border-slate-200 dark:border-slate-800 ${selectedPatient ? 'hidden md:block' : 'block'}`}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-800"><h3 className="font-bold">Messages</h3></div>
         <ScrollArea className="h-[calc(100vh-100px)]">
           <div className="p-2 space-y-1">
             {patients.map((p:any) => {
               const unreadCount = allMessages?.filter((m: any) => m.sender === 'patient' && !m.read && m.patientId === p.id).length || 0;
               return (
                <button key={p.id} onClick={()=>handleSelectPatient(p)} className={`w-full text-left p-4 flex items-center gap-3 rounded-xl transition-colors ${selectedPatient?.id === p.id ? 'bg-blue-50 dark:bg-purple-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-900'}`}>
                  <Avatar><AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-purple-900 dark:text-purple-300">{p.name[0]}</AvatarFallback></Avatar>
                  <div className="font-medium dark:text-slate-200 flex-1">{p.name}</div>
                  {unreadCount > 0 && (
                    <div className="bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                      {unreadCount}
                    </div>
                  )}
                </button>
               )
             })}
           </div>
         </ScrollArea>
      </div>
      <div className={`flex-1 flex col flex-col bg-slate-50/50 dark:bg-slate-900/50 ${!selectedPatient ? 'hidden md:flex' : 'flex w-full'}`}>
        {selectedPatient ? (
          <>
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 z-10 sticky top-0">
              <Button variant="ghost" size="icon" className="md:hidden -ml-2" onClick={() => setSelectedPatient(null)}>
                 <ArrowLeft className="w-5 h-5" />
              </Button>
              <Avatar><AvatarFallback>{selectedPatient.name[0]}</AvatarFallback></Avatar>
              <h3 className="font-bold">{selectedPatient.name}</h3>
              <Badge variant="outline" className="ml-auto text-xs text-slate-500 hidden sm:inline-flex">Encrypted</Badge>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
               {messages.map(m => (
                 <div key={m.id} className={`flex ${m.sender === 'doctor' ? 'justify-end' : 'justify-start'}`}>
                   <div className={`max-w-[70%] rounded-2xl p-3 px-4 ${m.sender === 'doctor' ? 'bg-blue-600 text-white dark:bg-purple-600' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-100'}`}>
                     {m.text}
                   </div>
                 </div>
               ))}
               <div ref={scrollRef} />
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
              <form onSubmit={sendMessage} className="flex gap-2">
                <Input value={newMessage} onChange={e=>setNewMessage(e.target.value)} placeholder="Type a secure message..." className="rounded-full bg-slate-50 dark:bg-slate-800 border-none dark:text-slate-100 flex-1" />
                <Button type="submit" size="icon" className="rounded-full bg-blue-600 hover:bg-blue-700 dark:bg-purple-600 dark:hover:bg-purple-700 text-white"><Send className="w-4 h-4" /></Button>
              </form>
            </div>
          </>
        ) : (
          <div className="m-auto text-slate-400">Select a conversation</div>
        )}
      </div>
    </div>
  );
}

// 4. HELPER AI TAB
function HelperAITab() {
  const [query, setQuery] = useState("");
  const [responses, setResponses] = useState<{q:string, a:string}[]>([]);
  const [loading, setLoading] = useState(false);

  const askAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    const userQ = query;
    setQuery("");
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are a medical assistant AI helping a doctor. Answer concisely. Question: ${userQ}`,
      });
      setResponses(prev => [...prev, { q: userQ, a: response.text || "No response." }]);
    } catch(e:any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-6 h-full flex flex-col">
       <div className="text-center mb-8">
         <div className="w-16 h-16 bg-blue-100 dark:bg-purple-900/30 text-blue-600 dark:text-purple-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
           <Bot className="w-8 h-8" />
         </div>
         <h2 className="text-2xl font-bold dark:text-slate-100">Medical Helper AI</h2>
         <p className="text-slate-500 dark:text-slate-400">Ask questions, get summaries, or request medical reference information.</p>
       </div>

       <div className="flex-1 overflow-y-auto space-y-6 mb-6">
          {responses.map((r, i) => (
             <div key={i} className="space-y-4">
               <div className="flex justify-end">
                 <div className="bg-slate-100 dark:bg-slate-800 dark:text-slate-200 px-5 py-3 rounded-2xl rounded-tr-sm max-w-[80%]">{r.q}</div>
               </div>
               <div className="flex justify-start">
                 <div className="bg-blue-50 border border-blue-100 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-100 px-5 py-4 rounded-2xl rounded-tl-sm max-w-[90%] shadow-sm leading-relaxed whitespace-pre-wrap">
                   {r.a}
                 </div>
               </div>
             </div>
          ))}
          {loading && <div className="text-slate-400 text-sm flex items-center gap-2"><Bot className="w-4 h-4 animate-bounce" /> AI is thinking...</div>}
       </div>

       <form onSubmit={askAI} className="relative">
         <Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ask the Helper AI..." className="pr-12 py-6 rounded-2xl shadow-sm border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 text-base" />
         <Button type="submit" disabled={loading} size="icon" className="absolute right-2 top-2 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-purple-600 dark:hover:bg-purple-700 text-white"><Send className="w-4 h-4"/></Button>
       </form>
    </div>
  );
}

// 5. SETTINGS TAB
function SettingsTab({ theme, setTheme }: any) {
  const { i18n, t } = useTranslation();
  const [notificationsEnabled, setNotificationsEnabled] = useState(Notification.permission === 'granted');

  const requestNotifications = async (enabled: boolean) => {
    if (enabled) {
      const perm = await Notification.requestPermission();
      setNotificationsEnabled(perm === 'granted');
      if (perm === 'granted') toast.success("Notifications enabled!");
      else toast.error("Notification permission denied by browser.");
    } else {
      setNotificationsEnabled(false);
      toast.info("Notifications paused. (Browser level permissions may still be active).");
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-6">
      <h2 className="text-3xl font-bold mb-8 dark:text-slate-100">Settings</h2>
      
      <div className="space-y-6">
        <Card className="dark:bg-slate-900 dark:border-slate-800">
          <CardHeader><CardTitle className="text-lg">Appearance</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Dark Mode</Label>
                <div className="text-sm text-slate-500">Toggle dark and light themes</div>
              </div>
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-full">
                 <button onClick={()=>setTheme('light')} className={`p-2 rounded-full transition-all ${theme!=='dark' ? 'bg-white shadow' : 'text-slate-500'}`}><Sun className="w-4 h-4" /></button>
                 <button onClick={()=>setTheme('dark')} className={`p-2 rounded-full transition-all ${theme==='dark' ? 'bg-slate-700 text-purple-400 shadow' : 'text-slate-500'}`}><Moon className="w-4 h-4" /></button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="dark:bg-slate-900 dark:border-slate-800">
          <CardHeader><CardTitle className="text-lg">Preferences</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Push Notifications</Label>
                <div className="text-sm text-slate-500">Receive alerts for new videos</div>
              </div>
              <Switch checked={notificationsEnabled} onCheckedChange={requestNotifications} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// 6. PROFILE TAB
function ProfileTab({ doctorUser }: any) {
  const [name, setName] = useState(doctorUser.name || "");
  const [birthday, setBirthday] = useState(doctorUser.birthday || "");
  const [profilePic, setProfilePic] = useState(doctorUser.profilePic || "");
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'doctors', doctorUser.uid), { name, birthday, profilePic });
      toast.success("Profile updated securely");
    } catch(e:any) { toast.error(e.message); }
    finally { setIsSaving(false); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
       const storageRef = ref(storage, `profiles/${doctorUser.uid}_${Date.now()}`);
       await uploadBytes(storageRef, file);
       const url = await getDownloadURL(storageRef);
       setProfilePic(url);
       toast.success("Profile picture uploaded! Don't forget to save changes.");
    } catch(err:any) { toast.error("Upload failed: " + err.message); }
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-6">
      <h2 className="text-3xl font-bold mb-8 dark:text-slate-100">My Profile</h2>
      <Card className="dark:bg-slate-900 dark:border-slate-800 shadow-sm">
        <CardContent className="p-8 space-y-8">
           
           <div className="flex flex-col items-center">
             <div className="relative">
               <Avatar className="w-24 h-24 border-4 border-white dark:border-slate-800 shadow-md">
                 <AvatarImage src={profilePic} />
                 <AvatarFallback className="text-3xl dark:bg-purple-900/50 dark:text-purple-300">{name[0]}</AvatarFallback>
               </Avatar>
               <button onClick={()=>fileInputRef.current?.click()} className="absolute bottom-0 right-0 p-2 bg-blue-600 hover:bg-blue-700 dark:bg-purple-600 dark:hover:bg-purple-700 text-white rounded-full shadow-lg transition-transform hover:scale-105">
                 <Camera className="w-4 h-4" />
               </button>
               <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
             </div>
             <div className="mt-4 text-center">
               <h3 className="font-bold text-xl dark:text-slate-100">{name}</h3>
               <p className="text-slate-500 font-mono text-sm mt-1">{doctorUser.email}</p>
             </div>
           </div>

           <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
             <div className="space-y-2">
               <Label>Full Name</Label>
               <Input value={name} onChange={e=>setName(e.target.value)} className="dark:bg-slate-800 dark:border-slate-700" />
             </div>
             <div className="space-y-2">
               <Label>Birthday</Label>
               <Input type="date" value={birthday} onChange={e=>setBirthday(e.target.value)} className="dark:bg-slate-800 dark:border-slate-700" />
             </div>
             <Button onClick={handleSave} disabled={isSaving} className="w-full bg-slate-900 text-white hover:bg-slate-800 dark:bg-purple-600 dark:hover:bg-purple-700 dark:text-white mt-4 transition-colors">
               {isSaving ? "Saving..." : "Save Changes"}
             </Button>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}

