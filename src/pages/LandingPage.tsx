import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Stethoscope, UserRound, ArrowRight, ShieldCheck, Activity, Download } from 'lucide-react';

const CardioLogo = ({ className = "w-12 h-12" }: { className?: string }) => (
  <svg className={`${className} shadow-sm rounded-xl overflow-hidden`} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    {/* Exact colors from the image: Salmon #F17662 and Dark Maroon #4F161F */}
    <rect width="100" height="100" fill="#F17662" />

    {/* Concentric non-blurred hearts exactly matching the image */}
    <g transform="translate(0, 4)">
      {/* Outer dark maroon heart */}
      <path d="M50 88 C50 88, 10 54, 10 32 C10 12, 35 8, 50 25 C65 8, 90 12, 90 32 C90 54, 50 88, 50 88 Z" fill="#4F161F" />
      
      {/* Middle salmon heart (creates the ring effect) */}
      <path d="M50 72 C50 72, 23 48, 23 33 C23 18, 38 15, 50 26 C62 15, 77 18, 77 33 C77 48, 50 72, 50 72 Z" fill="#F17662" />
      
      {/* Inner dark maroon heart */}
      <path d="M50 56 C50 56, 35 41, 35 32 C35 23, 43 20, 50 27 C57 20, 65 23, 65 32 C65 41, 50 56, 50 56 Z" fill="#4F161F" />
    </g>
  </svg>
);

export default function LandingPage() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navbar */}
      <motion.nav 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="w-full flex justify-between items-center px-8 py-6 max-w-7xl mx-auto"
      >
        <div className="flex items-center gap-2">
          <CardioLogo />
          <span className="text-2xl font-bold tracking-tight text-slate-900">Cardio AI</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/doctor/login')} className="text-sm font-medium hover:text-rose-600 text-slate-600 transition-colors">
            For Doctors
          </button>
          <button onClick={() => navigate('/patient/login')} className="text-sm font-medium bg-rose-600 text-white px-5 py-2.5 rounded-full hover:bg-rose-700 transition-colors shadow-sm">
            Patient Login
          </button>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 relative">
        {/* Background Gradients */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-rose-200/50 rounded-full blur-[100px] -z-10" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-red-200/50 rounded-full blur-[100px] -z-10" />

        <div className="max-w-4xl w-full mx-auto text-center mt-8 mb-16 space-y-10 flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center gap-6"
          >
            <div className="inline-flex flex-col sm:flex-row items-center gap-4">
              <div className="inline-flex items-center gap-2 bg-white border border-rose-100 shadow-sm px-4 py-1.5 rounded-full text-sm font-medium text-rose-700">
                <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                Reimagining Cardiac Care
              </div>
              {deferredPrompt && (
                <button 
                  onClick={handleInstallClick}
                  className="inline-flex items-center gap-2 bg-rose-50 border border-rose-100 shadow-sm hover:bg-rose-100 text-rose-700 px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Install App
                </button>
              )}
            </div>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900"
          >
            Smarter Health, <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-red-600">Connected With AI.</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed"
          >
            Cardio AI bridges the gap between cardiologists and patients. Track vitals, analyze trends with AI, manage medications, and follow personalized AI fitness and meditation plans.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6"
          >
            <button onClick={() => navigate('/patient/login')} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-8 py-4 rounded-full font-semibold shadow-md shadow-rose-200 transition-all hover:-translate-y-0.5">
              Login as Patient
              <ArrowRight className="w-5 h-5" />
            </button>
            <button onClick={() => navigate('/doctor/login')} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-8 py-4 rounded-full font-semibold shadow-sm transition-all hover:-translate-y-0.5">
              Doctor Portal
              <Stethoscope className="w-5 h-5" />
            </button>
          </motion.div>
        </div>

        {/* Feature Grid */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="w-full max-w-5xl grid md:grid-cols-3 gap-6 px-4 mb-20"
        >
          <div className="bg-white border border-slate-100 shadow-sm p-8 rounded-3xl hover:shadow-md transition-shadow">
             <Activity className="w-10 h-10 text-rose-500 mb-4" />
             <h3 className="text-xl font-bold mb-2 text-slate-900">AI Trend Analysis</h3>
             <p className="text-slate-600 text-sm leading-relaxed">Advanced AI analyzes your patient's heart rate, blood sugar, and SpO2 to proactively flag health anomalies.</p>
          </div>
          <div className="bg-white border border-slate-100 shadow-sm p-8 rounded-3xl hover:shadow-md transition-shadow">
             <ShieldCheck className="w-10 h-10 text-red-500 mb-4" />
             <h3 className="text-xl font-bold mb-2 text-slate-900">Secure Submissions</h3>
             <p className="text-slate-600 text-sm leading-relaxed">Patients record medication and fitness activity directly in the portal using secure video capture for doctor verification.</p>
          </div>
          <div className="bg-white border border-slate-100 shadow-sm p-8 rounded-3xl hover:shadow-md transition-shadow">
             <UserRound className="w-10 h-10 text-rose-400 mb-4" />
             <h3 className="text-xl font-bold mb-2 text-slate-900">Holistic Plans</h3>
             <p className="text-slate-600 text-sm leading-relaxed">A complete approach to recovery with AI-gen fitness plans, breathing meditation modes, and simple UI for the elderly.</p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
