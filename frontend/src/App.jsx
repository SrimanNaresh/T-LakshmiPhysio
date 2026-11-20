import { Navigate, Route, Routes } from 'react-router-dom';
import { Loader2, Lock } from 'lucide-react';
import { useAuth } from './lib/auth';
import { canSee } from './lib/menu';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ClinicMaster from './pages/config/ClinicMaster';
import Validity from './pages/config/Validity';
import UserMaster from './pages/config/UserMaster';
import MenuAccess from './pages/config/MenuAccess';
import PatientRegistration from './pages/registration/PatientRegistration';
import PatientList from './pages/registration/PatientList';
import EmployeeRegistration from './pages/registration/EmployeeRegistration';
import ConfirmPatient from './pages/booking/ConfirmPatient';
import ConfirmList from './pages/booking/ConfirmList';
import FollowUp from './pages/booking/FollowUp';
import ExamineQueue from './pages/examine/ExamineQueue';
import TreatmentMaster from './pages/examine/TreatmentMaster';
import MasterDetails from './pages/examine/MasterDetails';
import PatientHistory from './pages/examine/PatientHistory';
import Billing from './pages/billing/Billing';
import CollectionReport from './pages/report/CollectionReport';

function Guard({ k, children }) {
  const { screens } = useAuth();
  if (!canSee(screens, k)) {
    return (
      <div className="mx-auto mt-20 max-w-sm text-center text-ink-500">
        <Lock className="mx-auto mb-2" /> You don't have access to this screen. Ask the administrator to enable it in Menu Access.
      </div>
    );
  }
  return children;
}

const ROUTES = [
  ['config/clinic', 'clinic', ClinicMaster],
  ['config/validity', 'validity', Validity],
  ['config/users', 'users', UserMaster],
  ['config/menu-access', 'menuAccess', MenuAccess],
  ['registration/patient', 'patientRegistration', PatientRegistration],
  ['registration/patients', 'patientList', PatientList],
  ['registration/employee', 'employee', EmployeeRegistration],
  ['booking/confirm', 'confirmPatient', ConfirmPatient],
  ['booking/list', 'confirmList', ConfirmList],
  ['booking/follow-up', 'followUp', FollowUp],
  ['examine/queue', 'examine', ExamineQueue],
  ['examine/treatments', 'treatmentMaster', TreatmentMaster],
  ['examine/master-details', 'masterDetails', MasterDetails],
  ['examine/history', 'patientHistory', PatientHistory],
  ['billing', 'billing', Billing],
  ['report/collection', 'collectionReport', CollectionReport],
];

export default function App() {
  const { loading, user } = useAuth();
  if (loading) return <div className="grid h-screen place-items-center"><Loader2 className="animate-spin text-brand-600" /></div>;
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        {ROUTES.map(([path, k, C]) => <Route key={path} path={path} element={<Guard k={k}><C /></Guard>} />)}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
