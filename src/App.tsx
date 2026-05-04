import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import DoctorLogin from './pages/DoctorLogin';
import PatientLogin from './pages/PatientLogin';
import DoctorDashboard from './pages/DoctorDashboard';
import PatientDashboard from './pages/PatientDashboard';
import './i18n';

export default function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<LandingPage />} />
            <Route path="doctor/login" element={<DoctorLogin />} />
            <Route path="doctor/dashboard/*" element={<DoctorDashboard />} />
            <Route path="patient/login" element={<PatientLogin />} />
            <Route path="patient/dashboard" element={<PatientDashboard />} />
          </Route>
        </Routes>
        <Toaster position="top-center" theme="light" />
      </BrowserRouter>
    </>
  );
}
