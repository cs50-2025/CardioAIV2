import { create } from 'zustand';
import { User } from 'firebase/auth';

interface AuthState {
  doctorUser: User | null;
  patientData: any | null;
  setDoctorUser: (user: User | null) => void;
  setPatientData: (data: any | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  doctorUser: null,
  patientData: null,
  setDoctorUser: (user) => set({ doctorUser: user, patientData: null }),
  setPatientData: (data) => set({ patientData: data, doctorUser: null }),
  logout: () => set({ doctorUser: null, patientData: null }),
}));
