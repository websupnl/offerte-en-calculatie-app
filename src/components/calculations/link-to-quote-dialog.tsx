'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

type Selected = { id: string; title: string; number: string; customer: { id: string } | null; role?: string; quote?: { id: string } | null };
type Quote = { id: string; title: string | null; number: string | null; customerId: string; customer: { name: string } };
const selectClass = 'h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-ring';

export function LinkToQuoteDialog({ calculations, quotes, customers, onClose }: {
  calculations: Selected[]; quotes: Quote[]; customers: { id: string; name?: string }[]; onClose: () => void;
}) {
  const router = useRouter();
  const linkedIds = [...new Set(calculations.map(c => c.quote?.id).filter(Boolean))];
  const [quoteId, setQuoteId] = useState(linkedIds.length === 1 && quotes.some(q => q.id === linkedIds[0]) ? linkedIds[0]! : 'new');
  const customerIds = [...new Set(calculations.map(c => c.customer?.id).filter(Boolean))];
  const [customerId, setCustomerId] = useState(customerIds.length === 1 ? customerIds[0] ?? '' : '');
  const [title, setTitle] = useState(calculations.map(c => c.title).join(' + '));
  const [roles, setRoles] = useState<Record<string, 'BASE' | 'VARIANT' | 'OPTION'>>(Object.fromEntries(calculations.map(c => [c.id, c.role === 'VARIANT' || c.role === 'OPTION' ? c.role : 'BASE'])));
  const [busy, setBusy] = useState(false);
  const compatible = quotes.filter(q => customerIds.every(id => id === q.customerId));

  async function submit() {
    setBusy(true);
    try {
      const response = await fetch('/api/calculations/link-to-quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        calculations: calculations.map(c => ({ id: c.id, role: roles[c.id] })),
        ...(quoteId === 'new' ? { customerId, title } : { quoteId }),
      }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Toevoegen mislukt');
      toast.success(`${result.affected} calculaties toegevoegd aan de offerte`);
      router.push(`/quotes/${result.quoteId}`);
      onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Toevoegen mislukt'); }
    finally { setBusy(false); }
  }

  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>Toevoegen aan offerte</DialogTitle><DialogDescription className="text-base">Basis telt op. Vanaf twee varianten kiest de klant één uitvoering.</DialogDescription></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2"><Label htmlFor="link-quote">Offerte</Label><select id="link-quote" className={selectClass} value={quoteId} onChange={e => setQuoteId(e.target.value)} disabled={busy}>
          <option value="new">Nieuwe conceptofferte</option>
          {compatible.map(q => <option key={q.id} value={q.id}>{q.number || 'Concept'}: {q.title || 'Offerte'} ({q.customer.name})</option>)}
        </select></div>
        {quoteId === 'new' && <>
          <div className="space-y-2"><Label htmlFor="link-customer">Klant</Label><select id="link-customer" className={selectClass} value={customerId} onChange={e => setCustomerId(e.target.value)} disabled={busy}><option value="">Kies een klant</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="space-y-2"><Label htmlFor="link-title">Titel offerte</Label><Input id="link-title" className="text-base" value={title} onChange={e => setTitle(e.target.value)} disabled={busy} /></div>
        </>}
        <ul className="space-y-3">{calculations.map(c => <li key={c.id} className="space-y-2 rounded-lg border p-3">
          <label htmlFor={`role-${c.id}`} className="block text-base font-semibold">{c.title}<span className="ml-2 text-sm font-normal text-muted-foreground">{c.number}</span></label>
          <select id={`role-${c.id}`} className={selectClass} value={roles[c.id]} onChange={e => setRoles(prev => ({ ...prev, [c.id]: e.target.value as 'BASE' | 'VARIANT' | 'OPTION' }))} disabled={busy}><option value="BASE">Basis: telt altijd mee</option><option value="VARIANT">Variant: alternatief voor de klant</option><option value="OPTION">Meerprijs: klant kan het aanvinken</option></select>
        </li>)}</ul>
      </div>
      <DialogFooter><Button className="text-base" variant="outline" onClick={onClose} disabled={busy}>Annuleren</Button><Button className="text-base" onClick={submit} disabled={busy || (quoteId === 'new' && (!customerId || !title.trim()))}>{busy ? 'Toevoegen...' : 'Toevoegen aan offerte'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
