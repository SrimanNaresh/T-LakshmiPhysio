import { useEffect, useMemo, useState } from 'react';
import { Search, Printer } from 'lucide-react';
import api, { errMsg } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { fDate, today, money } from '../../lib/fmt';
import { Button, Card, Field, Input, PageHeader, Select, Spinner, useToast } from '../../components/ui';

// Pick a report from the dropdown, set its date(s), Show, then Print.
const REPORTS = [
  { key: 'day', label: 'Day-wise Report', range: true },
  { key: 'patients', label: 'Patients on a Date', range: false },
];

const n = (v) => Number(v || 0);
const sum = (rows, k) => rows.reduce((s, r) => s + n(r[k]), 0);
const uniquePatients = (rows) => new Set(rows.map((b) => b.PatientId ?? b.PatientCode)).size;

// Plain table with a totals row, so the totals print with it.
function ReportTable({ head, rows, foot, empty }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-ink-200 bg-white print:overflow-visible print:border-ink-400">
      <table className="w-full text-sm">
        <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
          <tr>{head.map(([label, cls = '']) => <th key={label} className={`px-3 py-2 font-semibold ${cls}`}>{label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={head.length} className="px-3 py-8 text-center text-ink-400">{empty}</td></tr>
            : rows}
        </tbody>
        {rows.length > 0 && (
          <tfoot className="border-t-2 border-ink-300 bg-ink-50 font-semibold text-ink-900">
            <tr>{foot}</tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

const td = 'px-3 py-1.5 border-t border-ink-100';
const num = `${td} text-right tabular-nums`;

export default function CollectionReport() {
  const toast = useToast();
  const { clinic } = useAuth();
  const [report, setReport] = useState('day');
  const [q, setQ] = useState({ from: today(), to: today(), date: today() });
  const [shown, setShown] = useState(null); // { report, from, to, date } that the data below belongs to
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const R = REPORTS.find((r) => r.key === report);

  const load = async () => {
    const params = R.range ? { from: q.from, to: q.to } : { from: q.date, to: q.date };
    if (R.range && params.from > params.to) { toast('From date must be on or before To date', 'error'); return; }
    setLoading(true);
    try {
      const r = await api.get('/bills', { params });
      setBills(r.data);
      setShown({ report, ...q });
    } catch (e) { toast(errMsg(e), 'error'); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [report]); // eslint-disable-line react-hooks/exhaustive-deps

  // Day-wise: one row per bill date.
  const days = useMemo(() => {
    const m = {};
    bills.forEach((b) => {
      const k = String(b.BillDate).slice(0, 10);
      (m[k] = m[k] || []).push(b);
    });
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b)).map(([day, list]) => ({
      day, patients: uniquePatients(list), bills: list.length,
      doctor: sum(list, 'DoctorFee'), treatment: sum(list, 'TreatmentFee'), discount: sum(list, 'Discount'), net: sum(list, 'NetAmount'),
    }));
  }, [bills]);

  const period = shown && (shown.report === 'day'
    ? (shown.from === shown.to ? fDate(shown.from) : `${fDate(shown.from)} to ${fDate(shown.to)}`)
    : fDate(shown.date));
  const ready = shown?.report === report && !loading;

  return (
    <div>
      <div className="no-print">
        <PageHeader title="Report" subtitle="Choose a report, set the date and print"
          actions={<Button variant="secondary" icon={Printer} disabled={!ready} onClick={() => window.print()}>Print</Button>} />

        <Card className="mb-4">
          <form onSubmit={(e) => { e.preventDefault(); load(); }}
            className={`grid items-end gap-3 ${R.range ? 'sm:grid-cols-[minmax(200px,260px)_160px_160px_auto]' : 'sm:grid-cols-[minmax(200px,260px)_160px_auto]'}`}>
            <Field label="Report">
              <Select value={report} onChange={(e) => setReport(e.target.value)}>
                {REPORTS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </Select>
            </Field>
            {R.range ? (
              <>
                <Field label="From"><Input type="date" value={q.from} onChange={(e) => setQ({ ...q, from: e.target.value })} /></Field>
                <Field label="To"><Input type="date" value={q.to} onChange={(e) => setQ({ ...q, to: e.target.value })} /></Field>
              </>
            ) : (
              <Field label="Date"><Input type="date" value={q.date} onChange={(e) => setQ({ ...q, date: e.target.value })} /></Field>
            )}
            <Button type="submit" icon={Search} loading={loading} className="justify-self-start">Show</Button>
          </form>
        </Card>
      </div>

      {!ready ? <Card><Spinner /></Card> : (
        <div className="report-print">
          {/* Heading that also goes on paper. */}
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b border-ink-200 pb-2">
            <div>
              <div className="hidden text-lg font-bold text-ink-900 print:block">{clinic?.ClinicName || 'Lakshmi Physiotherapy'}</div>
              <h2 className="text-base font-bold text-ink-900">{R.label}</h2>
              <p className="text-13 text-ink-500">{period}</p>
            </div>
            <div className="text-right text-13 text-ink-600">
              {report === 'day'
                ? <>Patients <b>{days.reduce((s, d) => s + d.patients, 0)}</b> · Net <b>{money(sum(bills, 'NetAmount'))}</b></>
                : <>No. of patients <b>{uniquePatients(bills)}</b> · Net <b>{money(sum(bills, 'NetAmount'))}</b></>}
            </div>
          </div>

          {report === 'day' ? (
            <ReportTable empty="No bills in this period"
              head={[['Date'], ['No. of Patients', 'text-right'], ['Bills', 'text-right'], ['Doctor Fee', 'text-right'], ['Treatment Fee', 'text-right'], ['Discount', 'text-right'], ['Net Amount', 'text-right']]}
              rows={days.map((d) => (
                <tr key={d.day}>
                  <td className={td}>{fDate(d.day)}</td>
                  <td className={num}>{d.patients}</td>
                  <td className={num}>{d.bills}</td>
                  <td className={num}>{money(d.doctor)}</td>
                  <td className={num}>{money(d.treatment)}</td>
                  <td className={num}>{money(d.discount)}</td>
                  <td className={`${num} font-semibold`}>{money(d.net)}</td>
                </tr>
              ))}
              foot={<>
                <td className="px-3 py-2">Total ({days.length} day{days.length === 1 ? '' : 's'})</td>
                <td className="px-3 py-2 text-right tabular-nums">{days.reduce((s, d) => s + d.patients, 0)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{bills.length}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(sum(bills, 'DoctorFee'))}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(sum(bills, 'TreatmentFee'))}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(sum(bills, 'Discount'))}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(sum(bills, 'NetAmount'))}</td>
              </>} />
          ) : (
            <ReportTable empty="No patients billed on this date"
              head={[['S.No'], ['Bill No'], ['Patient ID'], ['Name'], ['Mobile No'], ['Doctor Fee', 'text-right'], ['Treatment Fee', 'text-right'], ['Discount', 'text-right'], ['Net Amount', 'text-right'], ['Mode']]}
              rows={bills.slice().sort((a, b) => a.BillId - b.BillId).map((b, i) => (
                <tr key={b.BillId}>
                  <td className={td}>{i + 1}</td>
                  <td className={`${td} font-mono`}>{b.BillNo}</td>
                  <td className={`${td} font-mono text-brand-700`}>{b.PatientCode}</td>
                  <td className={td}>{b.PatientName}</td>
                  <td className={td}>{b.MobileNo}</td>
                  <td className={num}>{money(b.DoctorFee)}</td>
                  <td className={num}>{money(b.TreatmentFee)}</td>
                  <td className={num}>{money(b.Discount)}</td>
                  <td className={`${num} font-semibold`}>{money(b.NetAmount)}</td>
                  <td className={td}>{b.PaymentMode}</td>
                </tr>
              ))}
              foot={<>
                <td colSpan={5} className="px-3 py-2">Total · No. of patients: {uniquePatients(bills)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(sum(bills, 'DoctorFee'))}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(sum(bills, 'TreatmentFee'))}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(sum(bills, 'Discount'))}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(sum(bills, 'NetAmount'))}</td>
                <td className="px-3 py-2" />
              </>} />
          )}
          <p className="mt-2 hidden text-right text-11 text-ink-500 print:block">Printed on {fDate(today())}</p>
        </div>
      )}
    </div>
  );
}
