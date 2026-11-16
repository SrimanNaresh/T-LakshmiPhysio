import { useEffect, useState } from 'react';
import { Save, Printer, Search, ArrowLeft } from 'lucide-react';
import api, { errMsg } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { fDate, fDateTime, today, money } from '../../lib/fmt';
import { Button, Card, Field, Input, Modal, PageHeader, Select, Table, useToast } from '../../components/ui';

function BillPrint({ bill, clinic }) {
  return (
    <div className="mx-auto max-w-md bg-white p-6 text-sm text-ink-800">
      <div className="flex items-center gap-3 border-b-2 border-ink-800 pb-3">
        {clinic.Logo && <img src={clinic.Logo} alt="" className="h-14 w-14 object-contain" />}
        <div className="flex-1">
          <div className="text-lg font-bold">{clinic.ClinicName}</div>
          {clinic.DoctorName && <div>{clinic.DoctorName}</div>}
          <div className="text-xs text-ink-600">{clinic.Address}</div>
          <div className="text-xs text-ink-600">{[clinic.ContactNo, clinic.EmailId].filter(Boolean).join(' · ')}</div>
        </div>
      </div>
      <div className="my-3 text-center font-semibold tracking-wide">RECEIPT</div>
      <div className="grid grid-cols-2 gap-y-1 text-xs">
        <div>Bill No: <b>{bill.BillNo}</b></div><div className="text-right">Date: {fDateTime(bill.BillDate)}</div>
        <div>Patient ID: <b>{bill.PatientCode}</b></div><div className="text-right">Mobile: {bill.MobileNo}</div>
        <div className="col-span-2">Name: <b>{bill.PatientName}</b> {bill.Age ? `(${bill.Age} yrs)` : ''}</div>
        {bill.DoctorName && <div className="col-span-2">Doctor: {bill.DoctorName}</div>}
      </div>
      <table className="mt-3 w-full border-y border-ink-300 text-xs">
        <tbody>
          <tr><td className="py-1.5">Doctor Fee</td><td className="py-1.5 text-right">{money(bill.DoctorFee)}</td></tr>
          {bill.treatments?.length ? bill.treatments.map((t, i) => (
            <tr key={i}><td className="py-1 pl-2 text-ink-600">{t.TreatmentName}</td><td className="py-1 text-right text-ink-600">{money(t.Fee)}</td></tr>
          )) : null}
          <tr><td className="py-1.5">Treatment Fee</td><td className="py-1.5 text-right">{money(bill.TreatmentFee)}</td></tr>
          {Number(bill.Discount) > 0 && <tr><td className="py-1.5">Discount</td><td className="py-1.5 text-right">- {money(bill.Discount)}</td></tr>}
          <tr className="border-t border-ink-300 text-sm font-bold"><td className="py-2">Net Amount</td><td className="py-2 text-right">{money(bill.NetAmount)}</td></tr>
        </tbody>
      </table>
      <div className="mt-2 text-xs">Paid by: {bill.PaymentMode}</div>
      <div className="mt-10 text-right text-xs">Authorised Signature</div>
      <div className="mt-4 text-center text-xs text-ink-500">Thank you. Get well soon!</div>
    </div>
  );
}

function BillForm({ visit, onBack, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({ DoctorFee: visit.DoctorFee ?? 0, TreatmentFee: visit.TreatmentFee ?? 0, Discount: 0, PaymentMode: 'Cash' });
  const [busy, setBusy] = useState(false);
  const net = Number(f.DoctorFee || 0) + Number(f.TreatmentFee || 0) - Number(f.Discount || 0);

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.post('/bills', { ...f, VisitId: visit.VisitId, PatientId: visit.PatientId });
      toast('Bill saved');
      onSaved(r.data.BillId);
    } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="w-full">
      <PageHeader title="New Bill" actions={<Button variant="secondary" icon={ArrowLeft} onClick={onBack}>Back</Button>} />
      <Card>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Patient ID"><Input disabled value={visit.PatientCode} /></Field>
          <Field label="Name"><Input disabled value={visit.PatientName} /></Field>
          <Field label="Mobile No"><Input disabled value={visit.MobileNo || ''} /></Field>
          <Field label="Doctor Fee (₹)"><Input type="number" min="0" value={f.DoctorFee} onChange={(e) => setF({ ...f, DoctorFee: e.target.value })} /></Field>
          <Field label="Treatment Fee (₹)"><Input type="number" min="0" value={f.TreatmentFee} onChange={(e) => setF({ ...f, TreatmentFee: e.target.value })} /></Field>
          <Field label="Discount (₹)"><Input type="number" min="0" value={f.Discount} onChange={(e) => setF({ ...f, Discount: e.target.value })} /></Field>
          <Field label="Payment Mode">
            <Select value={f.PaymentMode} onChange={(e) => setF({ ...f, PaymentMode: e.target.value })}><option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option></Select>
          </Field>
          <div className="flex flex-col justify-end sm:col-span-2">
            <div className="rounded-lg bg-brand-50 px-4 py-3 text-right">
              <div className="text-xs uppercase tracking-wide text-ink-500">Net Amount</div>
              <div className={`text-2xl font-semibold tabular-nums ${net < 0 ? 'text-rose-600' : 'text-brand-800'}`}>{money(net)}</div>
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end"><Button icon={Save} loading={busy} onClick={save} disabled={net < 0}>Save & Print</Button></div>
      </Card>
    </div>
  );
}

export default function Billing() {
  const { clinic } = useAuth();
  const [tab, setTab] = useState('pending');
  const [pending, setPending] = useState([]);
  const [bills, setBills] = useState([]);
  const [q, setQ] = useState({ from: today(), to: today(), search: '' });
  const [visit, setVisit] = useState(null);
  const [print, setPrint] = useState(null);
  const [fullClinic, setFullClinic] = useState(clinic);

  const loadPending = () => api.get('/billing/pending').then((r) => setPending(r.data));
  const loadBills = () => api.get('/bills', { params: q }).then((r) => setBills(r.data));
  useEffect(() => { loadPending(); loadBills(); api.get('/clinic').then((r) => setFullClinic(r.data)).catch(() => {}); }, []);

  const openPrint = async (id) => setPrint((await api.get(`/bills/${id}`)).data);

  if (visit) {
    return <BillForm visit={visit} onBack={() => setVisit(null)}
      onSaved={(id) => { setVisit(null); loadPending(); loadBills(); openPrint(id); }} />;
  }

  const billTotal = bills.reduce((s, b) => s + Number(b.NetAmount || 0), 0);

  return (
    <div>
      <div className="no-print">
        <PageHeader title="Billing" />
        <div className="mb-4 inline-flex rounded-lg border border-ink-200 bg-white p-1 text-sm">
          {[['pending', `Pending (${pending.length})`], ['bills', 'Bill List']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-md px-4 py-1.5 ${tab === k ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-ink-100'}`}>{l}</button>
          ))}
        </div>
        {tab === 'pending' ? (
          <Table keyField="VisitId" rows={pending} onRowClick={setVisit} empty="No examined patients waiting for a bill" columns={[
            { label: 'Patient ID', render: (r) => <span className="font-mono text-brand-700">{r.PatientCode}</span> },
            { label: 'Name', key: 'PatientName' },
            { label: 'Mobile No', key: 'MobileNo' },
            { label: 'Visit', render: (r) => fDateTime(r.VisitDate) },
            { label: 'Doctor', key: 'DoctorName' },
            { label: 'Doctor Fee', className: 'text-right', render: (r) => money(r.DoctorFee) },
            { label: 'Treatment Fee', className: 'text-right', render: (r) => money(r.TreatmentFee) },
            { label: '', className: 'text-right', render: () => <span className="text-xs font-medium text-brand-700">Bill →</span> },
          ]} />
        ) : (
          <>
            <Card className="mb-4">
              <form onSubmit={(e) => { e.preventDefault(); loadBills(); }} className="grid items-end gap-3 sm:grid-cols-[160px_160px_1fr_auto]">
                <Field label="From"><Input type="date" value={q.from} onChange={(e) => setQ({ ...q, from: e.target.value })} /></Field>
                <Field label="To"><Input type="date" value={q.to} onChange={(e) => setQ({ ...q, to: e.target.value })} /></Field>
                <Field label="Search"><Input placeholder="Bill no / name / mobile" value={q.search} onChange={(e) => setQ({ ...q, search: e.target.value })} /></Field>
                <Button type="submit" icon={Search}>Search</Button>
              </form>
            </Card>
            <Table keyField="BillId" rows={bills} columns={[
              { label: 'Bill No', render: (r) => <span className="font-mono">{r.BillNo}</span> },
              { label: 'Date', render: (r) => fDate(r.BillDate) },
              { label: 'Patient ID', render: (r) => <span className="font-mono text-brand-700">{r.PatientCode}</span> },
              { label: 'Name', key: 'PatientName' },
              { label: 'Mobile No', key: 'MobileNo' },
              { label: 'Doctor Fee', className: 'text-right', render: (r) => money(r.DoctorFee) },
              { label: 'Treatment Fee', className: 'text-right', render: (r) => money(r.TreatmentFee) },
              { label: 'Discount', className: 'text-right', render: (r) => money(r.Discount) },
              { label: 'Net', className: 'text-right font-semibold', render: (r) => money(r.NetAmount) },
              { label: 'Mode', key: 'PaymentMode' },
              { label: '', className: 'text-right', render: (r) => <Button size="sm" variant="ghost" icon={Printer} onClick={() => openPrint(r.BillId)} /> },
            ]} />
            <div className="mt-3 text-right text-sm text-ink-600">{bills.length} bills · Total <b>{money(billTotal)}</b></div>
          </>
        )}
      </div>

      <Modal open={!!print} title={`Bill ${print?.BillNo || ''}`} onClose={() => setPrint(null)} width="max-w-lg">
        {print && (
          <>
            <BillPrint bill={print} clinic={fullClinic} />
            <div className="mt-4 flex justify-end"><Button icon={Printer} onClick={() => window.print()}>Print</Button></div>
          </>
        )}
      </Modal>
      {print && <div className="print-only"><BillPrint bill={print} clinic={fullClinic} /></div>}
    </div>
  );
}
