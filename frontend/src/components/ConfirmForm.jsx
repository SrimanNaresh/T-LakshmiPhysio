import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import api, { errMsg } from '../lib/api';
import { fClock, nowLocal } from '../lib/fmt';
import { Button, Field, Input, Select, Textarea, useToast } from './ui';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Shared by Confirm Patient and Follow-up: pick doctor / type / time and create the confirmation.
export default function ConfirmForm({ patient, defaultType = 'Walk-in', defaultTime, onDone }) {
  const toast = useToast();
  const [doctors, setDoctors] = useState([]);
  const [f, setF] = useState({ DoctorId: '', BookingType: defaultType, ConfirmTime: defaultTime || nowLocal(), Notes: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/employees', { params: { type: 'Doctor' } }).then((r) => {
      setDoctors(r.data);
      if (r.data.length === 1) setF((s) => ({ ...s, DoctorId: r.data[0].EmployeeId }));
    });
  }, []);

  const day = DAY[new Date(f.ConfirmTime).getDay()];
  const save = async () => {
    setBusy(true);
    try {
      await api.post('/bookings', { ...f, PatientId: patient.PatientId });
      toast(`${patient.Name} confirmed`);
      onDone?.();
    } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
  };

  return (
    // Type, Confirm Time and Doctor on one line; Notes and the button below (stacks on phones).
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Type">
        <Select value={f.BookingType} onChange={(e) => setF({ ...f, BookingType: e.target.value })}>
          <option>Walk-in</option><option>Booking</option><option>Follow-up</option>
        </Select>
      </Field>
      <Field label="Confirm Time"><Input type="datetime-local" value={f.ConfirmTime} onChange={(e) => setF({ ...f, ConfirmTime: e.target.value })} /></Field>
      <Field label="Doctor">
        <Select value={f.DoctorId} onChange={(e) => setF({ ...f, DoctorId: e.target.value })}>
          <option value="">— Any doctor —</option>
          {doctors.map((d) => {
            const works = !d.WorkDays || d.WorkDays.split(',').includes(day);
            return (
              <option key={d.EmployeeId} value={d.EmployeeId}>
                {d.Name} {d.FromTime ? `(${fClock(d.FromTime)}–${fClock(d.ToTime)})` : ''}{works ? '' : ` — not available on ${day}`}
              </option>
            );
          })}
        </Select>
      </Field>
      <Field label="Notes" className="sm:col-span-3"><Textarea rows={2} value={f.Notes} onChange={(e) => setF({ ...f, Notes: e.target.value })} placeholder="Complaint / reason for visit (optional)" /></Field>
      <div className="flex justify-end sm:col-span-3"><Button icon={CheckCircle2} loading={busy} onClick={save}>Confirm</Button></div>
    </div>
  );
}
