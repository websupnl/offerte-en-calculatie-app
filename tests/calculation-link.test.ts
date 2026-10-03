import assert from 'node:assert/strict';
import test from 'node:test';
import { validateCalculationLinks } from '../src/lib/calculation-link';
import { buildQuotePricing, resolvePricing } from '../src/lib/quote-pricing';

const quote = { id: 'q', customerId: 'customer', status: 'DRAFT', items: [] };
const calculations = ['a', 'b'].map(id => ({ id, quoteId: null, customerId: 'customer' }));
const selected = (role: 'BASE' | 'VARIANT') => calculations.map(c => ({ id: c.id, role }));
const priced = (id: string, role: 'BASE' | 'VARIANT', price: number) => ({
  id, number: id, title: id, role, vatRate: 21,
  items: [{ id: `item-${id}`, description: id, qty: 1, unitPrice: price, vatRate: 21 }],
});

test('twee basiscalculaties tellen op naast bestaande calculaties', () => {
  validateCalculationLinks(selected('BASE'), calculations, quote, [{ id: 'existing', role: 'BASE' }]);
  const pricing = buildQuotePricing([priced('existing', 'BASE', 50), priced('a', 'BASE', 100), priced('b', 'BASE', 200)]);
  assert.equal(resolvePricing(pricing).totalExVat, 350);
  assert.equal(pricing.blocks.length, 3);
});

test('twee varianten vormen één keuze, plus de gemeenschappelijke basis', () => {
  validateCalculationLinks(selected('VARIANT'), calculations, quote, [{ id: 'existing', role: 'BASE' }]);
  const pricing = buildQuotePricing([priced('existing', 'BASE', 50), priced('a', 'VARIANT', 100), priced('b', 'VARIANT', 200)]);
  assert.equal(resolvePricing(pricing, { variantId: 'a' }).totalExVat, 150);
  assert.equal(resolvePricing(pricing, { variantId: 'b' }).totalExVat, 250);
});

test('een bestaande variant mag worden aangevuld, dezelfde selectie blijft idempotent', () => {
  validateCalculationLinks([{ id: 'a', role: 'VARIANT' }], [calculations[0]], quote, [{ id: 'b', role: 'VARIANT' }]);
  validateCalculationLinks(selected('VARIANT'), calculations.map(c => ({ ...c, quoteId: 'q' })), quote, selected('VARIANT'));
});

test('onvolledige keuzes en ongeldige koppelingen worden tegengehouden', () => {
  assert.throws(() => validateCalculationLinks([{ id: 'a', role: 'VARIANT' }], [calculations[0]], quote, []), /minimaal twee/);
  assert.throws(() => validateCalculationLinks(selected('BASE'), calculations, { ...quote, status: 'SENT' }, []), /conceptofferte/);
  assert.throws(() => validateCalculationLinks(selected('BASE'), calculations, { ...quote, items: [{}] }, []), /losse offerteregels/);
  assert.throws(() => validateCalculationLinks(selected('BASE'), calculations.map(c => ({ ...c, customerId: 'other' })), quote, []), /dezelfde klant/);
  assert.throws(() => validateCalculationLinks(selected('BASE'), calculations.map(c => ({ ...c, quoteId: 'other' })), quote, []), /andere offerte/);
  assert.throws(() => validateCalculationLinks(selected('BASE'), [calculations[0]], quote, []), /bestaat niet/);
  assert.throws(() => validateCalculationLinks([{ id: 'a', role: 'BASE' }, { id: 'a', role: 'BASE' }], calculations, quote, []), /één keer/);
});
