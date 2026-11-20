import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, CalendarDays, Repeat, Stethoscope, Receipt, FileText, Dumbbell } from 'lucide-react';
import { SkeletonIcon, splitBodyChart } from '../../components/BodyChart';
import PatientImageNotes from '../../components/PatientImageNotes';
import api from '../../lib/api';
import { fDate, fTime, money } from '../../lib/fmt';
import { Badge, Button, Card, Field, Input, PageHeader, Table } from '../../components/ui';

function Section({ icon: Icon, title, count, children, empty }) {
  return (
    <div className="min-w-0 rounded-lg border border-ink-100 bg-ink-50/40 p-2.5">
      <h5 className="mb-1.5 flex items-center gap-1.5 text-11 font-bold uppercase tracking-wide text-ink-500">
        {Icon && <Icon size={13} />} {title}
        {count > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[10px] leading-4 text-white">{count}</span>}
      </h5>
      {empty ? <p className="text-13 italic text-ink-400">{empty}</p> : children}
    </div>
  );
}

// Everything entered in the Examine tabs for one visit, under the same headings.
function VisitDetails({ v }) {
  const { findings, rest } = splitBodyChart(v.AssessmentNotes);
  const fus = v.FollowUpDates || [];
  return (
    <div className="grid gap-2.5 md:grid-cols-2">
      <Section icon={SkeletonIcon} title="Body Chart" count={findings.length} empty={!findings.length && 'No findings marked'}>
        <ul className="space-y-0.5 text-13 text-ink-700">
          {findings.map((f, i) => {
            const [bone, ...note] = f.split(': ');
            return <li key={i}><span className="font-semibold text-ink-800">{bone}</span>{note.length > 0 && <>: {note.join(': ')}</>}</li>;
          })}
        </ul>
      </Section>
      <Section icon={FileText} title="Assessment Notes" empty={!rest && 'No assessment notes'}>
        <p className="whitespace-pre-wrap text-13 text-ink-700">{rest}</p>
      </Section>
      <Section icon={Dumbbell} title="Fees" count={v.treatments.length}>
        {v.treatments.length > 0 ? (
          <table className="mb-1.5 w-full text-13">
            <tbody className="divide-y divide-ink-100">
              {v.treatments.map((t) => (
                <tr key={t.VisitTreatmentId}>
                  <td className="py-1 pr-2 font-medium text-ink-800">{t.TreatmentName}</td>
                  <td className="py-1 pr-2 text-ink-500">{t.Exercise}</td>
                  <td className="whitespace-nowrap py-1 text-right">{money(t.Fee)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="mb-1.5 text-13 italic text-ink-400">No treatments</p>}
        <div className="flex flex-wrap justify-end gap-x-3 border-t border-ink-100 pt-1.5 text-12 text-ink-500">
          <span>Doctor fee {money(v.DoctorFee)}</span>
          <span>Treatment {money(v.TreatmentFee)}</span>
          <span className="font-semibold text-ink-800">Total {money(Number(v.DoctorFee || 0) + Number(v.TreatmentFee || 0))}</span>
        </div>
      </Section>
      <Section icon={Repeat} title="Follow-up" count={fus.length} empty={!fus.length && 'No follow-up planned'}>
        <div className="flex flex-wrap gap-1.5">
          {fus.map((d) => <span key={d} className="rounded-md bg-white px-2 py-0.5 text-12 font-medium text-ink-700 ring-1 ring-ink-200">{fDate(d)}</span>)}
        </div>
      </Section>
    </div>
  );
}

// Visit-wise timeline, newest first. Used on this page and in the Examine screen's history popup.
export function VisitTimeline({ visits }) {
  return (
    visits.length === 0 ? <p className="py-10 text-center text-ink-400">No visits recorded yet</p> : (
      <ol className="relative space-y-4 border-l-2 border-brand-200 pl-6">
        {visits.map((v, i) => (
          <li key={v.VisitId} className="relative">
            <span className="absolute -left-[33px] top-3 grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-[11px] font-semibold text-white">{visits.length - i}</span>
            <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="flex items-center gap-1.5 font-semibold text-ink-800"><CalendarDays size={15} /> {fDate(v.VisitDate)} <span className="font-normal text-ink-400">{fTime(v.VisitDate)}</span></span>
                {v.DoctorName && <span className="flex items-center gap-1 text-ink-500"><Stethoscope size={14} />{v.DoctorName}</span>}
                <span className="ml-auto">{v.BillNo ? <Badge color="green"><Receipt size={11} className="mr-1 inline" />{v.BillNo} · {money(v.NetAmount)}</Badge> : <Badge color="amber">Not billed</Badge>}</span>
              </div>
              <VisitDetails v={v} />
            </div>
          </li>
        ))}
      </ol>
    )
  );
}

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
          <PatientImageNotes patientId={patient.PatientId} />
          <VisitTimeline visits={visits} />
        </>
      )}
    </div>
  );
}
