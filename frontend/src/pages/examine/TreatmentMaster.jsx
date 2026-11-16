import { useEffect, useState } from 'react';
import { Save, Pencil, Trash2, RotateCcw } from 'lucide-react';
import api, { errMsg } from '../../lib/api';
import { money } from '../../lib/fmt';
import { Button, Card, Field, Input, PageHeader, Table, Textarea, useToast } from '../../components/ui';

const blank = { TreatmentName: '', Exercise: '', Fee: '' };

export default function TreatmentMaster() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const load = () => api.get('/treatments').then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    setBusy(true);
    try { await api.post('/treatments', f); toast('Treatment saved'); setF(blank); load(); } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
  };
  const del = async (r) => {
    if (!confirm(`Remove ${r.TreatmentName}?`)) return;
    await api.delete(`/treatments/${r.TreatmentId}`); load();
  };

  return (
    <div className="w-full">
      <PageHeader title="Treatment Master" subtitle="Treatments, their default exercises and fee — picked during examination" />
      <Card title={f.TreatmentId ? 'Edit Treatment' : 'New Treatment'}>
        <div className="grid gap-4 sm:grid-cols-[1fr_2fr_140px]">
          <Field label="Treatment" required><Input value={f.TreatmentName} onChange={(e) => setF({ ...f, TreatmentName: e.target.value })} placeholder="e.g. IFT, Ultrasound, TENS" /></Field>
          <Field label="Exercise"><Textarea rows={1} value={f.Exercise || ''} onChange={(e) => setF({ ...f, Exercise: e.target.value })} placeholder="e.g. Quadriceps sets 10 × 3" /></Field>
          <Field label="Fee (₹)"><Input type="number" min="0" value={f.Fee} onChange={(e) => setF({ ...f, Fee: e.target.value })} /></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          {f.TreatmentId && <Button variant="secondary" icon={RotateCcw} onClick={() => setF(blank)}>Cancel</Button>}
          <Button icon={Save} loading={busy} onClick={save}>Save</Button>
        </div>
      </Card>
      <div className="mt-5">
        <Table keyField="TreatmentId" rows={rows} columns={[
          { label: 'Treatment', key: 'TreatmentName', className: 'font-medium' },
          { label: 'Exercise', render: (r) => <span className="whitespace-pre-wrap">{r.Exercise}</span> },
          { label: 'Fee', className: 'text-right', render: (r) => money(r.Fee) },
          { label: '', className: 'text-right', render: (r) => (
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setF(r)} />
              <Button size="sm" variant="ghost" icon={Trash2} onClick={() => del(r)} />
            </div>) },
        ]} />
      </div>
    </div>
  );
}
