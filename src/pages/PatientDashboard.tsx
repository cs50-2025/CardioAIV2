import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Webcam from 'react-webcam';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { GoogleGenAI, Type } from '@google/genai';
import { db, storage } from '../firebase';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Progress } from '../components/ui/progress';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Activity, Pill, Dumbbell, Video as VideoIcon, CheckCircle2, MessageSquare, Send, LogOut, Home, Bot, Settings, UserCircle, Plus, Trash2, Moon, Sun, Wind } from 'lucide-react';
import { VideoRecorder } from '../components/VideoRecorder';
import { ScrollArea } from '../components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import { encryptText, decryptText } from '../lib/encryption';
import { motion, AnimatePresence } from 'motion/react';

export default function PatientDashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { patientData, logout, setPatientData } = useAuthStore();
  
  const [activeTab, setActiveTab] = useState<'home' | 'fitness' | 'meditation' | 'messages' | 'ai' | 'settings' | 'profile'>('home');
  const [theme, setThemeState] = useState<'light' | 'dark'>(patientData?.themePreference || 'light');
  
  const [medications, setMedications] = useState<any[]>([]);
  const [fitnessPlan, setFitnessPlan] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  
  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const setTheme = async (newTheme: 'light' | 'dark') => {
    if (!patientData) return;
    
    // Fallback if docId isn't present from an older login
    let docIdToUpdate = patientData.docId;
    if (!docIdToUpdate) {
      const q = query(collection(db, 'patients'), where('id', '==', patientData.id));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        docIdToUpdate = snapshot.docs[0].id;
      }
    }

    try {
      if (docIdToUpdate) {
        await updateDoc(doc(db, 'patients', docIdToUpdate), {
          themePreference: newTheme
        });
      }
      setThemeState(newTheme);
      setPatientData({ ...patientData, docId: docIdToUpdate, themePreference: newTheme });
    } catch (e: any) {
      toast.error('Failed to update theme: ' + e.message);
    }
  };

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

  useEffect(() => {
    if (!patientData) {
      navigate('/patient/login');
      return;
    }

    const medQ = query(collection(db, 'medications'), where('patientId', '==', patientData.id));
    const unsubMed = onSnapshot(medQ, (snapshot) => {
      setMedications(snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() })));
    });

    const planQ = query(collection(db, 'fitnessPlans'), where('patientId', '==', patientData.id));
    const unsubPlan = onSnapshot(planQ, (snapshot) => {
      if (!snapshot.empty) {
        const plans = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() })) as any[];
        plans.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
        setFitnessPlan(plans[0]);
      }
    });

    const msgQ = query(collection(db, 'messages'), where('patientId', '==', patientData.id), orderBy('timestamp', 'asc'));
    const sharedKey = `${patientData.id}-${patientData.loginCode}`;
    const unsubMsg = onSnapshot(msgQ, async (snap) => {
      const msgs = await Promise.all(snap.docs.map(async (doc) => {
        const data = doc.data();
        let decryptedText = data.text;
        if (data.isEncrypted) {
          try {
            decryptedText = await decryptText(data.text, sharedKey);
          } catch(e) {
            decryptedText = 'Unable to decrypt';
          }
        }
        return { id: doc.id, ...data, text: decryptedText };
      }));
      setMessages(msgs);
    });
    
    const tasksQ = query(collection(db, 'patientTasks'), where('patientId', '==', patientData.id));
    const unsubTasks = onSnapshot(tasksQ, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubMed();
      unsubPlan();
      unsubMsg();
      unsubTasks();
    };
  }, [patientData, navigate]);

  if (!patientData) return null;
  
  const unreadMessagesCount = messages.filter(m => m.sender === 'doctor' && !m.read).length;
  
  // Calculate intake medications left today
  const getMedicationsLeft = () => {
    let count = 0;
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    medications.forEach(med => {
       med.dosageTimes.forEach((time: string) => {
         if (time > currentTime) count++;
       });
    });
    return count;
  };

  return (
    <div className={`flex flex-col md:flex-row h-full w-full overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-500 ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Sidebar Navigation */}
      <div className="hidden md:flex w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col transition-colors duration-500 shrink-0">
        <div className="p-6">
          <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-400 dark:from-purple-500 dark:to-purple-300">
            Cardio AI Patient
          </h2>
        </div>
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          {[
            { id: 'home', icon: Home, label: 'Home' },
            { id: 'fitness', icon: Dumbbell, label: 'Fitness' },
            ...(patientData?.needsMeditation ? [{ id: 'meditation', icon: Wind, label: 'Meditation' }] : []),
            { id: 'messages', icon: MessageSquare, label: 'Messages', badge: unreadMessagesCount },
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
      <div className="flex-1 overflow-y-auto relative pb-20 md:pb-0 w-full transition-colors duration-500">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            {activeTab === 'home' && <HomeTab patientData={patientData} tasks={tasks} medicationsLeft={getMedicationsLeft()} medications={medications} unreadMessagesCount={unreadMessagesCount} />}
            {activeTab === 'fitness' && <FitnessTab patientData={patientData} fitnessPlan={fitnessPlan} />}
            {activeTab === 'meditation' && <MeditationTab patientData={patientData} />}
            {activeTab === 'messages' && <MessagesTab patientData={patientData} messages={messages} />}
            {activeTab === 'ai' && <HelperAITab patientData={patientData} />}
            {activeTab === 'settings' && <SettingsTab theme={theme} setTheme={setTheme} i18n={i18n} />}
            {activeTab === 'profile' && <ProfileTab patientData={patientData} setPatientData={setPatientData} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around p-2 z-50 transition-colors duration-500">
        {[
          { id: 'home', icon: Home, label: 'Home' },
          { id: 'fitness', icon: Dumbbell, label: 'Fitness' },
          ...(patientData?.needsMeditation ? [{ id: 'meditation', icon: Wind, label: 'Meditation' }] : []),
          { id: 'messages', icon: MessageSquare, label: 'Messages', badge: unreadMessagesCount },
          { id: 'ai', icon: Bot, label: 'Helper AI' },
          { id: 'profile', icon: UserCircle, label: 'Profile' },
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

// --------------------- TABS ---------------------

function HomeTab({ patientData, tasks, medicationsLeft, medications, unreadMessagesCount }: any) {
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("");
  const [showMedicationVideoModal, setShowMedicationVideoModal] = useState(false);
  
  const addTask = async (e: any) => {
    e.preventDefault();
    if (!newTaskName.trim() || !newTaskTime) return;
    try {
      await addDoc(collection(db, 'patientTasks'), {
        patientId: patientData.id,
        name: newTaskName,
        time: newTaskTime,
        completed: false,
        createdAt: new Date().toISOString()
      });
      setNewTaskName("");
      setNewTaskTime("");
      toast.success("Task added");
    } catch(e: any) {
        toast.error("Error adding task");
    }
  };
  
  const toggleTask = async (task: any) => {
    try {
      await updateDoc(doc(db, 'patientTasks', task.id), {
        completed: !task.completed
      });
    } catch(e: any) {
    }
  };

  const removeTask = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'patientTasks', id));
    } catch(e: any) {
    }
  };

  const mockHistoricalData = [
    { date: 'Mon', bpm: (patientData.bpm || 80) - 5, bloodSugar: (patientData.bloodSugar || 90) + 2, spO2: (patientData.spO2 || 98) - 1 },
    { date: 'Tue', bpm: (patientData.bpm || 80) - 2, bloodSugar: (patientData.bloodSugar || 90) + 5, spO2: (patientData.spO2 || 98) },
    { date: 'Wed', bpm: (patientData.bpm || 80) + 3, bloodSugar: (patientData.bloodSugar || 90) - 2, spO2: (patientData.spO2 || 98) },
    { date: 'Thu', bpm: (patientData.bpm || 80) - 1, bloodSugar: (patientData.bloodSugar || 90) - 5, spO2: (patientData.spO2 || 98) - 1 },
    { date: 'Fri', bpm: (patientData.bpm || 80) + 4, bloodSugar: (patientData.bloodSugar || 90) + 1, spO2: (patientData.spO2 || 98) },
    { date: 'Sat', bpm: (patientData.bpm || 80) - 3, bloodSugar: (patientData.bloodSugar || 90) + 3, spO2: (patientData.spO2 || 98) - 1 },
    { date: 'Sun', bpm: (patientData.bpm || 80), bloodSugar: (patientData.bloodSugar || 90), spO2: (patientData.spO2 || 98) },
  ];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 md:space-y-8">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100 dark:border-slate-800 transition-colors duration-500">
        <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-purple-400 dark:to-pink-500">
          Welcome, {patientData.name}!
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Here is your daily health overview.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="dark:bg-slate-900 border-none shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Pill className="w-4 h-4 text-blue-500 dark:text-purple-400"/> Intake Meds Left Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100">{medicationsLeft}</div>
          </CardContent>
        </Card>
        
        <Card className="dark:bg-slate-900 border-none shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-500 dark:text-emerald-400"/> Unread Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100">{unreadMessagesCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="dark:bg-slate-900 border-none shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
        <CardHeader>
          <CardTitle>Health Trends (This Week)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end h-48 mt-4 overflow-x-auto w-full pt-8 pb-4 border-b border-slate-100 dark:border-slate-800 relative">
            {mockHistoricalData.map((data, idx) => (
              <div key={idx} className="flex flex-col items-center flex-1 min-w-[50px] relative group h-full justify-end">
                {/* Tooltip */}
                <div className="absolute -top-10 scale-0 group-hover:scale-100 opacity-0 group-hover:opacity-100 transition-all bg-slate-800 text-white text-xs whitespace-nowrap p-2 rounded z-10 pointer-events-none">
                  BPM: {data.bpm} | Sugar: {data.bloodSugar}
                </div>
                
                {/* Lines / Bars */}
                <div className="flex gap-1 items-end w-full justify-center h-full">
                   <div className="w-1/3 bg-red-400 dark:bg-red-500 rounded-t" style={{height: `${Math.min(100, Math.max(10, data.bpm - 40))}%`}}></div>
                   <div className="w-1/3 bg-amber-400 dark:bg-amber-500 rounded-t" style={{height: `${Math.min(100, Math.max(10, data.bloodSugar - 50))}%`}}></div>
                   <div className="w-1/3 bg-blue-400 dark:bg-blue-500 rounded-t" style={{height: `${Math.min(100, Math.max(10, (data.spO2 - 80) * 4))}%`}}></div>
                </div>
                
                {/* X Axis Label */}
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">{data.date}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-4 text-xs justify-center">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-400 dark:bg-red-500"></span> BPM</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-400 dark:bg-amber-500"></span> Blood Sugar</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-400 dark:bg-blue-500"></span> SpO2%</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="dark:bg-slate-900 border-none shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 overflow-hidden">
          <CardHeader>
            <CardTitle>Daily To-Do List</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addTask} className="flex gap-2 mb-4">
               <Input required value={newTaskName} onChange={e=>setNewTaskName(e.target.value)} placeholder="Task Name" className="flex-1 dark:bg-slate-800 border-slate-200 dark:border-slate-700 w-0" />
               <Input required type="time" value={newTaskTime} onChange={e=>setNewTaskTime(e.target.value)} className="w-[120px] dark:bg-slate-800 border-slate-200 dark:border-slate-700 shrink-0" />
               <Button type="submit" className="bg-blue-600 hover:bg-blue-700 dark:bg-purple-600 dark:hover:bg-purple-700 text-white shrink-0">Add</Button>
            </form>
            <div className="space-y-2">
              {tasks.length === 0 ? (
                 <p className="text-slate-500 text-sm py-4 text-center">No tasks for today. Add one above.</p>
              ) : (
                 tasks.map((t: any) => (
                   <div key={t.id} className="flex items-center gap-2 justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700/50">
                      <div className="flex items-center gap-3 overflow-hidden">
                         <input 
                           type="checkbox" 
                           checked={t.completed} 
                           onChange={() => toggleTask(t)} 
                           className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:checked:bg-purple-500 shrink-0" 
                         />
                         <span className={`font-medium truncate ${t.completed ? 'line-through text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>{t.name}</span>
                         <Badge variant="outline" className="text-xs dark:border-slate-600 whitespace-nowrap shrink-0 hidden sm:inline-flex">{t.time}</Badge>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeTask(t.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                   </div>
                 ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="dark:bg-slate-900 border-none shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 overflow-hidden">
          <CardHeader>
            <CardTitle>Medication Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {medications?.length === 0 ? (
                 <p className="text-slate-500 text-sm py-4 text-center">No medications prescribed yet.</p>
              ) : (
                 medications?.map((m: any) => (
                   <div key={m.docId} className="flex flex-col p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700/50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <Pill className="w-4 h-4 text-blue-500 dark:text-purple-400" />
                          {m.name}
                        </div>
                        <Badge variant="secondary" className="dark:bg-slate-700 dark:text-slate-200">{m.dosage}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {m.dosageTimes?.map((time: string, idx: number) => {
                          const now = new Date();
                          const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                          const isPast = time <= currentTime;
                          return (
                            <Badge key={idx} variant={isPast ? "outline" : "default"} className={isPast ? "opacity-50 dark:border-slate-600" : "bg-blue-100 text-blue-700 dark:bg-purple-900 dark:text-purple-300 hover:bg-blue-200"}>
                              {time}
                            </Badge>
                          );
                        })}
                      </div>
                   </div>
                 ))
              )}
            </div>
            {medications?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowMedicationVideoModal(true)}>
                  <VideoIcon className="w-4 h-4 mr-2" /> Upload Medication Proof
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showMedicationVideoModal} onOpenChange={setShowMedicationVideoModal}>
        <DialogContent className="sm:max-w-md dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 p-0 overflow-hidden">
          <div className="p-6 pb-2">
             <DialogHeader>
               <DialogTitle className="text-xl">Medication Proof</DialogTitle>
             </DialogHeader>
          </div>
          <div className="p-6 pt-2">
            <VideoRecorder 
              patientData={patientData} 
              type="medication" 
              title="" 
              description="Record yourself taking your scheduled medication as daily proof." 
              onSuccess={() => setShowMedicationVideoModal(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
      
    </div>
  );
}

function FitnessTab({ patientData, fitnessPlan }: any) {
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  const generateFitnessPlan = async () => {
    if (!patientData) return;
    setIsGeneratingPlan(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
      const prompt = `Generate a fitness workout plan for a patient with ${patientData.fitnessLevel} fitness level. 
      The plan MUST consist of exactly 5 exercises. 
      For each exercise, provide the name, a short description, and specify a 5-second rest period after it.
      Return the result as JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                duration: { type: Type.STRING },
                rest: { type: Type.STRING }
              },
              required: ["name", "description", "duration", "rest"]
            }
          }
        }
      });

      const exercises = JSON.parse(response.text || '[]');
      await addDoc(collection(db, 'fitnessPlans'), {
        id: `PLAN-${Date.now()}`,
        patientId: patientData.id,
        exercises,
        generatedAt: new Date().toISOString()
      });
      toast.success("Fitness plan generated!");
    } catch (error: any) {
      toast.error("Failed to generate plan");
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className={`grid ${fitnessPlan ? 'lg:grid-cols-[1fr_400px]' : 'grid-cols-1'} gap-6 items-start`}>
        <Card className="dark:bg-slate-900 border-none shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
          <CardHeader>
             <CardTitle className="flex justify-between items-center">
                <span>Your Fitness Plan</span>
             </CardTitle>
          </CardHeader>
          <CardContent>
             {!fitnessPlan ? (
                <div className="text-center py-12 space-y-4">
                  <Dumbbell className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="text-slate-500 dark:text-slate-400 text-lg">No fitness plan generated yet.</p>
                  <Button onClick={generateFitnessPlan} disabled={isGeneratingPlan} className="bg-blue-600 hover:bg-blue-700 dark:bg-purple-600 dark:hover:bg-purple-700 text-white mx-auto block">
                    {isGeneratingPlan ? "Generating AI Plan..." : "Generate Plan"}
                  </Button>
                </div>
             ) : (
               <div className="space-y-6">
                  <div className="space-y-4">
                    {fitnessPlan.exercises.map((ex: any, i: number) => (
                      <div key={i} className="relative pl-8 pb-4 border-l-2 border-slate-200 dark:border-slate-800 last:border-0 last:pb-0">
                        <div className="absolute left-[-9px] top-0 bg-white dark:bg-slate-900 border-2 border-blue-500 dark:border-purple-500 w-4 h-4 rounded-full"></div>
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-700/50">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-slate-900 dark:text-slate-100">{ex.name}</h4>
                            <Badge variant="outline" className="dark:border-slate-600">{ex.duration}</Badge>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{ex.description}</p>
                          <div className="flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 p-2 rounded inline-flex">
                            <span>Rest: {ex.rest}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
                    <Button variant="outline" onClick={generateFitnessPlan} disabled={isGeneratingPlan} className="dark:border-slate-700 dark:text-slate-300">
                      {isGeneratingPlan ? "Regenerating..." : "Generate New Plan"}
                    </Button>
                  </div>
               </div>
             )}
          </CardContent>
        </Card>

        {fitnessPlan && (
          <Card className="dark:bg-slate-900 border-none shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 sticky top-4">
            <CardHeader>
              <CardTitle className="text-lg">Record Session</CardTitle>
            </CardHeader>
            <CardContent>
              <VideoRecorder 
                patientData={patientData} 
                type="fitness" 
                title="" 
                description="Record your fitness session as proof for your doctor." 
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function MeditationTab({ patientData }: any) {
  const [isBreathing, setIsBreathing] = useState(false);
  const [breathStage, setBreathStage] = useState<'Inhale' | 'Hold' | 'Exhale'>('Inhale');

  useEffect(() => {
    let interval: any;
    if (isBreathing) {
      setBreathStage('Inhale');
      interval = setInterval(() => {
        setBreathStage(current => {
          if (current === 'Inhale') return 'Hold';
          if (current === 'Hold') return 'Exhale';
          return 'Inhale';
        });
      }, 4000); // 4 seconds per stage
    } else {
      setBreathStage('Inhale');
    }
    return () => clearInterval(interval);
  }, [isBreathing]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
       <div className={`grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start`}>
          <Card className="dark:bg-slate-900 border-none shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
             <CardHeader>
                <CardTitle>Meditation Session</CardTitle>
             </CardHeader>
             <CardContent className="flex flex-col items-center justify-center py-12">
               <motion.div
                 className="w-56 h-56 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-8 shadow-inner border-4 border-emerald-50 dark:border-emerald-800/50"
                 animate={isBreathing ? {
                   scale: [1, 1.5, 1.5, 1],
                 } : { scale: 1 }}
                 transition={isBreathing ? {
                   duration: 12,
                   repeat: Infinity,
                   times: [0, 0.33, 0.66, 1],
                   ease: "easeInOut"
                 } : {}}
               >
                 <div className="flex flex-col items-center text-emerald-600 dark:text-emerald-400">
                    <motion.div
                      className="w-28 h-28 bg-emerald-500 dark:bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg mb-2"
                      animate={isBreathing ? {
                        opacity: [0.8, 1, 1, 0.8],
                      } : { opacity: 1 }}
                    >
                      {isBreathing ? breathStage : 'Ready'}
                    </motion.div>
                    {!isBreathing && <span className="text-sm font-medium animate-pulse">Start recording to begin</span>}
                 </div>
               </motion.div>
               
               <p className="mt-4 text-slate-500 dark:text-slate-400 text-center max-w-md">
                 Follow the expanding and contracting circle. Inhale as it grows, hold at the top, and exhale as it shrinks.
               </p>
             </CardContent>
          </Card>
          
          <Card className="dark:bg-slate-900 border-none shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 sticky top-4">
            <CardHeader>
              <CardTitle className="text-lg">Record Session</CardTitle>
            </CardHeader>
            <CardContent>
              <VideoRecorder 
                patientData={patientData} 
                type="meditation" 
                title="" 
                description="Record your meditation session for your doctor." 
                onRecordingChange={setIsBreathing}
              />
            </CardContent>
          </Card>
       </div>
    </div>
  );
}

function MessagesTab({ patientData, messages }: any) {
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    // Mark as read
    const markRead = async () => {
      for (const m of messages) {
        if (m.sender === 'doctor' && !m.read) {
          await updateDoc(doc(db, 'messages', m.id), { read: true });
        }
      }
    };
    markRead();
  }, [messages]);

  const sendMessage = async (e: any) => {
    e.preventDefault();
    if (!newMessage.trim() || !patientData) return;
    try {
      const sharedKey = `${patientData.id}-${patientData.loginCode}`;
      const encryptedMessage = await encryptText(newMessage, sharedKey);
      await addDoc(collection(db, 'messages'), {
        doctorUid: patientData.doctorUid,
        patientId: patientData.id,
        sender: 'patient',
        text: encryptedMessage,
        isEncrypted: true,
        read: false,
        timestamp: new Date().toISOString()
      });
      setNewMessage("");
    } catch(error:any) { 
      toast.error("Error: " + error.message); 
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto h-full flex flex-col pt-8 md:pt-8 w-full md:w-auto h-[calc(100vh-80px)] md:h-full">
      <Card className="flex flex-col h-full bg-white dark:bg-slate-900 border-none shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between z-10 sticky top-0 bg-white dark:bg-slate-900 rounded-t-xl">
           <h3 className="font-bold flex items-center gap-2">
             Chat with your Doctor
           </h3>
           <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 font-mono text-xs hidden sm:inline-flex">End-to-End Encrypted</Badge>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
           {messages.length === 0 ? (
             <div className="h-full flex items-center justify-center text-slate-400">No messages yet. Say hi to your doctor!</div>
           ) : (
             messages.map((m: any) => (
               <div key={m.id} className={`flex ${m.sender === 'patient' ? 'justify-end' : 'justify-start'}`}>
                 <div className={`max-w-[80%] rounded-2xl p-3 px-4 ${
                   m.sender === 'patient' 
                     ? 'bg-blue-600 dark:bg-purple-600 text-white rounded-br-sm shadow-sm' 
                     : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-sm shadow-sm'
                 }`}>
                   {m.text}
                 </div>
               </div>
             ))
           )}
           <div ref={scrollRef} />
        </div>
        <form onSubmit={sendMessage} className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex gap-2">
           <Input required value={newMessage} onChange={e=>setNewMessage(e.target.value)} placeholder="Type a message..." className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-full px-4" />
           <Button type="submit" size="icon" className="rounded-full bg-blue-600 hover:bg-blue-700 dark:bg-purple-600 dark:hover:bg-purple-700 text-white shadow-sm shrink-0">
             <Send className="w-4 h-4" />
           </Button>
        </form>
      </Card>
    </div>
  );
}

function HelperAITab({ patientData }: any) {
  const [query, setQuery] = useState("");
  const [responses, setResponses] = useState<{q:string, a:string}[]>([]);
  const [loading, setLoading] = useState(false);

  const askAI = async (e: any) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    const userQ = query;
    setQuery("");
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
      const prompt = `You are a helpful health assistant AI for a patient named ${patientData.name}. 
      They are asking: "${userQ}".
      Provide a concise, helpful answer, but remind them to always consult their doctor for medical advice. Make it accessible and friendly.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      setResponses(prev => [...prev, { q: userQ, a: response.text || "I couldn't process that. Try again!" }]);
    } catch(error:any) {
      toast.error('Failed to get answer: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-6 h-[calc(100vh-80px)] md:h-full flex flex-col">
       <div className="text-center mb-8 shrink-0">
         <div className="w-16 h-16 bg-blue-100 dark:bg-purple-900/30 text-blue-600 dark:text-purple-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
           <Bot className="w-8 h-8" />
         </div>
         <h2 className="text-2xl font-bold dark:text-slate-100">Health Helper AI</h2>
         <p className="text-slate-500 dark:text-slate-400">Ask questions about your health, exercise, or medications.</p>
       </div>

       <div className="flex-1 overflow-y-auto space-y-6 mb-6">
          {responses.length === 0 && !loading && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
               <Bot className="w-16 h-16 opacity-20" />
               <p className="text-center px-4">Hello {patientData.name}, how can I help you today?</p>
            </div>
          )}
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

       <form onSubmit={askAI} className="relative shrink-0">
         <Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="E.g. What are good foods for lowering cholesterol?" className="pr-12 py-6 rounded-2xl shadow-sm border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 text-base" />
         <Button type="submit" disabled={loading} size="icon" className="absolute right-2 top-2 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-purple-600 dark:hover:bg-purple-700 text-white"><Send className="w-4 h-4"/></Button>
       </form>
    </div>
  );
}

function SettingsTab({ theme, setTheme, i18n }: any) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(Notification.permission === 'granted');

  const requestNotifications = async (checked: boolean) => {
    if (checked) {
       if ('Notification' in window) {
         try {
           const permission = await Notification.requestPermission();
           setNotificationsEnabled(permission === 'granted');
           if (permission === 'granted') {
             toast.success("Notifications enabled!");
           } else {
             toast.error("Please allow notifications in your browser settings.");
           }
         } catch (e) {
           toast.error("Unable to request notification permission.");
         }
       }
    } else {
       toast.error("Notifications can only be disabled from your browser settings.");
       setNotificationsEnabled(true);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <h2 className="text-3xl font-bold mb-8 dark:text-slate-100">Settings</h2>
      
      <div className="space-y-6">
        <Card className="dark:bg-slate-900 dark:border-slate-800 shadow-sm">
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

        <Card className="dark:bg-slate-900 dark:border-slate-800 shadow-sm">
          <CardHeader><CardTitle className="text-lg">Preferences</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Push Notifications</Label>
                <div className="text-sm text-slate-500">Receive alerts and reminders</div>
              </div>
              <Switch checked={notificationsEnabled} onCheckedChange={requestNotifications} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProfileTab({ patientData, setPatientData }: any) {
  const [name, setName] = useState(patientData.name);
  const [birthday, setBirthday] = useState(patientData.birthday || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
       await updateDoc(doc(db, 'patients', patientData.docId), {
         name,
         birthday
       });
       setPatientData({ ...patientData, name, birthday });
       toast.success("Profile updated!");
    } catch(e: any) {
       toast.error("Failed to update profile.");
    } finally {
       setIsUpdating(false);
    }
  };

  const handleImageUpload = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      toast.loading("Uploading image...");
      const storageRef = ref(storage, `profiles/${patientData.id}_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      await updateDoc(doc(db, 'patients', patientData.docId), {
        photoUrl: url
      });
      setPatientData({ ...patientData, photoUrl: url });
      toast.dismiss();
      toast.success("Profile picture updated!");
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to upload image.");
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
       <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-purple-400 dark:to-pink-500">My Profile</h2>
       
       <Card className="dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
         <CardContent className="p-8 flex flex-col items-center">
            <div className="relative group mb-8">
               <Avatar className="w-32 h-32 border-4 border-white dark:border-slate-800 shadow-lg ring-2 ring-slate-100 dark:ring-slate-700/50">
                 <AvatarImage src={patientData.photoUrl || ''} />
                 <AvatarFallback className="text-4xl">{patientData.name[0]}</AvatarFallback>
               </Avatar>
               <button 
                 onClick={() => fileInputRef.current?.click()}
                 className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 dark:bg-purple-600 dark:hover:bg-purple-700 text-white p-2 rounded-full shadow-lg transition-transform hover:scale-110"
               >
                 <Plus className="w-5 h-5" />
               </button>
               <input type="file" className="hidden" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" />
            </div>

            <div className="w-full space-y-4 max-w-md">
               <div className="space-y-2">
                 <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label>
                 <Input value={name} onChange={e=>setName(e.target.value)} className="dark:bg-slate-800 dark:border-slate-700" />
               </div>
               <div className="space-y-2">
                 <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Birthday</label>
                 <Input type="date" value={birthday} onChange={e=>setBirthday(e.target.value)} className="dark:bg-slate-800 dark:border-slate-700" />
               </div>
               
               <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-6 !mt-8">
                 <Button className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-purple-600 dark:hover:bg-purple-700 text-white" disabled={isUpdating} onClick={handleUpdate}>
                   {isUpdating ? "Saving..." : "Save Changes"}
                 </Button>
               </div>
            </div>
         </CardContent>
       </Card>
    </div>
  );
}
