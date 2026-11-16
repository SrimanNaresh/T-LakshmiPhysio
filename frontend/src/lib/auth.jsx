import { createContext, useContext, useEffect, useState } from 'react';
import api from './api';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, screens: [], validity: null });
  const [clinic, setClinic] = useState({ ClinicName: 'Lakshmi Physio', AppName: 'Lakshmi Physio' });

  const refreshClinic = () => api.get('/app-info').then((r) => {
    setClinic(r.data);
    document.title = r.data.AppName || r.data.ClinicName || 'Lakshmi Physio';
  }).catch(() => {});

  useEffect(() => {
    refreshClinic();
    if (!localStorage.getItem('lp_token')) return setState((s) => ({ ...s, loading: false }));
    api.get('/auth/me')
      .then((r) => setState({ loading: false, ...r.data }))
      .catch(() => { localStorage.removeItem('lp_token'); setState({ loading: false, user: null, screens: [], validity: null }); });
  }, []);

  const login = async (userName, password) => {
    const r = await api.post('/auth/login', { userName, password });
    localStorage.setItem('lp_token', r.data.token);
    setState({ loading: false, user: r.data.user, screens: r.data.screens, validity: r.data.validity });
  };
  const logout = () => {
    localStorage.removeItem('lp_token');
    setState({ loading: false, user: null, screens: [], validity: null });
  };

  return <AuthCtx.Provider value={{ ...state, clinic, refreshClinic, login, logout }}>{children}</AuthCtx.Provider>;
}
