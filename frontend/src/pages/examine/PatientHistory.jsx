import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, CalendarDays, Repeat, Stethoscope, Receipt } from 'lucide-react';
import api from '../../lib/api';
import { fDate, fTime, money } from '../../lib/fmt';
import { Badge, Button, Card, Field, Input, PageHeader, Table } from '../../components/ui';

export default function PatientHistory() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [found, setFound] = useState(null);
  const [patient, setPatient] = useState(null);
  const [visits, setVisits] = useState([]);

  useEffect(() => {
    const id = params.get('patientId');
    if (!id) { setPatient(null); return; }
    api.get(`/patients/${id}`).then((r) => setPatient(r.data));
    api.get('/visits', { params: { patientId: id } }).then((r) => setVisits(r.data));
  }, [params]);

  const find = async (e) => {
    e.preventDefault();
    setFound((await api.get('/patients', { params: { search } })).data);
  };
  const pickPatient = (p) => { setFound(null); setParams({ patientId: p.PatientId }); };

  const total = visits.reduce((s, v) => s + Number(v.DoctorFee || 0) + Number(v.TreatmentFee || 0), 0);

  return (
    <div className="w-full">
      <PageHeader title="Patient History" subtitle="Visit-wise record of assessments, treatments and bills" />
      <Card className="mb-4">
        <form onSubmit={find} className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="Find Patient"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Patient ID, name or mobile" /></Field>
          <Button type="submit" icon={Search}>Search</Button>
        </form>
        {found && (
          <div className="mt-4">
            <Table keyField="PatientId" rows={found} onRowClick={pickPatient} columns={[
              { label: 'Patient ID', render: (r) => <span className="font-mono text-brand-700">{r.PatientCode}</span> },
              { label: 'Name', key: 'Name' }, { label: 'Mobile No', key: 'MobileNo' }, { label: 'Age', key: 'Age' },
            ]} />
          </div>
        )}
      </Card>

      {patient && (
        <>
          <div className="mb-4 grid gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm sm:grid-cols-5">
            <div><div className="text-xs text-ink-500">Patient ID</div><div className="font-mono font-semibold text-brand-800">{patient.PatientCode}</div></div>
            <div><div className="text-xs text-ink-500">Name</div><div className="font-medium">{patient.Name}</div></div>
            <div><div className="text-xs text-ink-500">Mobile / Age</div><div>{patient.MobileNo || '—'} · {patient.Age ?? '—'} yrs</div></div>
            <div><div className="text-xs text-ink-500">Visits</div><div className="font-semibold">{visits.length}</div></div>
            <div><div className="text-xs text-ink-500">Total Charges</div><div className="font-semibold">{money(total)}</div></div>
          </div>
          {visits.length === 0 ? <p className="py-10 text-center text-ink-400">No visits recorded yet</p> : (
            <ol className="relative space-y-4 border-l-2 border-brand-200 pl-6">
              {visits.map((v, i) => (
                <li key={v.VisitId} className="relative">
                  <span className="absolute -left-[33px] top-3 grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-[11px] font-semibold text-white">{visits.length - i}</span>
                  <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
                    <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className="flex items-center gap-1.5 font-semibold text-ink-800"><CalendarDays size={15} /> {fDate(v.VisitDate)} <span className="font-normal text-ink-400">{fTime(v.VisitDate)}</span></span>
                      {v.DoctorName && <span className="flex items-center gap-1 text-ink-500"><Stethoscope size={14} />{v.DoctorName}</span>}
                      {v.FollowUpDate && <span className="flex items-center gap-1 text-ink-500"><Repeat size={14} />Follow-up {fDate(v.FollowUpDate)}</span>}
                      <span className="ml-auto">{v.BillNo ? <Badge color="green"><Receipt size={11} className="mr-1 inline" />{v.BillNo} · {money(v.NetAmount)}</Badge> : <Badge color="amber">Not billed</Badge>}</span>
                    </div>
                    <div className="whitespace-pre-wrap text-sm text-ink-700">{v.AssessmentNotes || <i className="text-ink-400">No assessment notes</i>}</div>
                    {v.treatments.length > 0 && (
                      <div className="mt-3 overflow-hidden rounded-lg border border-ink-100">
                        <table className="w-full text-sm">
                          <tbody className="divide-y divide-ink-100">
                            {v.treatments.map((t) => (
                              <tr key={t.VisitTreatmentId}><td className="px-3 py-1.5 font-medium">{t.TreatmentName}</td><td className="px-3 py-1.5 text-ink-500">{t.Exercise}</td><td className="px-3 py-1.5 text-right">{money(t.Fee)}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="mt-2 text-right text-xs text-ink-500">Doctor fee {money(v.DoctorFee)} · Treatment {money(v.TreatmentFee)}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
