import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../state/AuthContext';

type GstChoice = { serial_no: number; supplier_state: string; place_of_supply: string; tax_direction: string; hsn_sac: string };
type GstSetup = { enabled: boolean; registration_state: string; amount_decimals?: number; states: { state_code: string; state_name: string }[] };
const round = (n: number, decimals = 2) => Math.round((n + Number.EPSILON) * 10 ** decimals) / 10 ** decimals;

export function useFinanceGst(form: { doc_no?: string; detail: Record<string, any>[] }, docType: string, editMode: boolean) {
  const { user } = useAuth();
  const [setup, setSetup] = useState<GstSetup>({ enabled: false, registration_state: '', states: [] });
  const [choices, setChoices] = useState<Record<number, Partial<GstChoice>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setChoices({});
    Promise.all([
      api.get('/api/finance/transactions/gst/setup'),
      editMode && form.doc_no && form.doc_no !== '0'
        ? api.get('/api/finance/transactions/gst/document', { params: { doc_no: form.doc_no, doc_type: docType } })
        : Promise.resolve({ data: { data: [] } }),
    ]).then(([config, saved]) => {
      if (!active) return;
      if (!config.data.success) throw new Error(config.data.message || 'Unable to load GST setup');
      setSetup(config.data.data);
      setChoices(Object.fromEntries((saved.data.data || []).map((row: GstChoice) => [row.serial_no, row])));
    }).catch(e => { if (active) setError(e.message || 'Unable to load GST details'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.company_code, docType, editMode, form.doc_no]);
  const lines = useMemo(() => docType === 'PO' ? [] : form.detail.filter(d => Number(d.serial_no) < 9000 && ['S', 'Z', 'E'].includes(d.tx_compnt_1_expmt) && Number(d.amount || 0) > 0), [form.detail, docType]);
  const defaultDirection = ['SI', 'SV'].includes(docType) ? 'OUTPUT' : docType === 'PI' ? 'INPUT' : '';
  const choice = (line: Record<string, any>): GstChoice => {
    const saved = choices[Number(line.serial_no)] || {};
    const direction = saved.tax_direction ?? defaultDirection;
    return { serial_no: Number(line.serial_no), tax_direction: direction,
      supplier_state: direction === 'OUTPUT' ? setup.registration_state : (saved.supplier_state || ''),
      place_of_supply: saved.place_of_supply || (direction === 'INPUT' ? setup.registration_state : ''), hsn_sac: saved.hsn_sac || '' };
  };
  const setChoice = (serial: number, patch: Partial<GstChoice>) => setChoices(current => ({ ...current, [serial]: { ...current[serial], ...patch } }));
  const attachToHeader = (header: Record<string, unknown>) => {
    if (lines.length && (loading || error)) throw new Error(error || 'Wait for GST setup to finish loading');
    if (!setup.enabled) return;
    const entries = lines.map(choice);
    if (entries.some(e => !e.tax_direction || !e.supplier_state || !e.place_of_supply || (e.tax_direction === 'OUTPUT' && !/^(?:[0-9]{4}|[0-9]{6}|[0-9]{8})$/.test(e.hsn_sac)))) throw new Error('Complete GST direction, supplier state, place of supply and output HSN/SAC in GST details');
    header.gst_lines = entries;
  };
  return { ...setup, lines, loading, error, choice, setChoice, attachToHeader };
}

export function FinanceGstPanel({ editor, disabled = false }: { editor: ReturnType<typeof useFinanceGst>; disabled?: boolean }) {
  const [expanded, setExpanded] = useState(true);
  if (!editor.lines.length || (!editor.enabled && !editor.error)) return null;
  if (editor.error) return <p role="alert" className="mt-2 text-sm text-red-700">GST setup could not load: {editor.error}. Reload before saving taxable lines.</p>;
  const incomplete = editor.lines.some(line => { const e = editor.choice(line); return !e.tax_direction || !e.supplier_state || !e.place_of_supply || (e.tax_direction === 'OUTPUT' && !/^(?:[0-9]{4}|[0-9]{6}|[0-9]{8})$/.test(e.hsn_sac)); });
  return <details className="mt-2 rounded-md border border-slate-300 bg-white text-slate-900" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">GST details · {editor.lines.length} {editor.lines.length === 1 ? 'line' : 'lines'}{incomplete ? ' · Complete required details' : ''}</summary>
    <p className="px-3 pb-2 text-xs text-slate-600">Supplier state and place of supply determine CGST + SGST/UTGST or IGST. Rates and tax amounts stay with the selected tax master and voucher line. HSN/SAC is required for output GST.</p>
    <div className="max-h-52 overflow-auto px-3 pb-3">
      <table className="w-full min-w-[780px] border-collapse text-left text-xs">
        <thead><tr className="border-b border-slate-300 bg-slate-50"><th className="p-2">Line / Account</th><th className="p-2">GST direction</th><th className="p-2">Supplier state *</th><th className="p-2">Place of supply *</th><th className="p-2">HSN / SAC (output) *</th><th className="p-2 text-right">GST split</th></tr></thead>
        <tbody>{editor.lines.map(line => {
          const entry = editor.choice(line), amount = Math.abs(Number(line.tx_compnt_amt_1 || 0));
          const intra = entry.supplier_state && entry.supplier_state === entry.place_of_supply;
          const ready = entry.supplier_state && entry.place_of_supply;
          const options = editor.states.map(s => <option key={s.state_code} value={s.state_code}>{s.state_code} · {s.state_name}</option>);
          const inputClass = 'w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 disabled:bg-slate-100';
          return <tr key={entry.serial_no} className="border-b border-slate-200">
            <td className="p-2 font-medium">{entry.serial_no} · {line.ac_code}</td>
            <td className="p-2"><select className={inputClass} aria-label={`GST direction line ${entry.serial_no}`} disabled={disabled} value={entry.tax_direction} onChange={e => editor.setChoice(entry.serial_no, { tax_direction: e.target.value, supplier_state: '', place_of_supply: '' })}><option value="">Select direction</option><option value="INPUT">Input GST</option><option value="OUTPUT">Output GST</option></select></td>
            <td className="p-2"><select className={inputClass} aria-label={`Supplier state line ${entry.serial_no}`} disabled={disabled || entry.tax_direction === 'OUTPUT'} value={entry.supplier_state} onChange={e => editor.setChoice(entry.serial_no, { supplier_state: e.target.value })}><option value="">Select state</option>{options}</select></td>
            <td className="p-2"><select className={inputClass} aria-label={`Place of supply line ${entry.serial_no}`} disabled={disabled} value={entry.place_of_supply} onChange={e => editor.setChoice(entry.serial_no, { place_of_supply: e.target.value })}><option value="">Select state</option>{options}</select></td>
            <td className="p-2"><input className={inputClass} aria-label={`HSN SAC line ${entry.serial_no}`} inputMode="numeric" aria-required={entry.tax_direction === 'OUTPUT'} maxLength={8} value={entry.hsn_sac} disabled={disabled} onChange={e => editor.setChoice(entry.serial_no, { hsn_sac: e.target.value.replace(/\D/g, '') })} placeholder="From invoice" /></td>
            <td className="whitespace-nowrap p-2 text-right tabular-nums">{!ready ? 'Select states' : intra ? `CGST ${round(amount / 2, Math.min(4, editor.amount_decimals ?? 2)).toFixed(4)} + SGST/UTGST ${(amount - round(amount / 2, Math.min(4, editor.amount_decimals ?? 2))).toFixed(4)}` : `IGST ${amount.toFixed(4)}`}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  </details>;
}
