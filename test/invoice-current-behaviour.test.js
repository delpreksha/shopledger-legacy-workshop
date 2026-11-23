'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

// These tests use inline order data and calculation modules only. They never
// load the store or read/write data/db.json.

test('invoice figures match the GST and total recorded when an order is billed', function () {
  const order = {
    items: [
      { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 500, qty: 1 }
    ],
    coupon: ''
  };
  const billedFigures = pricing.computeTotals(order.items, order.coupon);
  order.subtotal = billedFigures.subtotal;
  order.discount = billedFigures.discount;
  order.tax = billedFigures.tax;
  order.total = billedFigures.total;

  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { invoiceTax: invoiceFigures.tax, invoiceTotal: invoiceFigures.total, lineGst: invoiceFigures.rows[0].gstPercent },
    { invoiceTax: order.tax, invoiceTotal: order.total, lineGst: 5 }
  );
});

test('invoice uses HSN slabs and matches billed GST', function () {
  const items = [
    { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 500, qty: 1 },
    { id: 2, name: 'Tea', sku: 'TEA', hsn: '0902', price: 500, qty: 1 }
  ];

  const ledgerFigures = pricing.computeTotals(items, '');
  const invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(ledgerFigures.tax, 115);
  assert.deepEqual(ledgerFigures.lines.map(function (line) { return line.gstPercent; }), [5, 18]);
  assert.equal(invoiceFigures.tax, 115);
  assert.deepEqual(invoiceFigures.rows.map(function (line) { return line.gstPercent; }), [5, 18]);
  assert.equal(ledgerFigures.total, 1115);
  assert.equal(invoiceFigures.total, 1115);
  assert.equal(invoiceFigures.cgst, 57.5);
  assert.equal(invoiceFigures.sgst, 57.5);
});

test('invoice honors SAVE10 maximum discount and matches billed totals', function () {
  const order = {
    items: [
      { id: 3, name: 'Tea', sku: 'TEA', hsn: '0902', price: 2000, qty: 1 }
    ],
    coupon: 'SAVE10'
  };

  const ledgerFigures = pricing.computeTotals(order.items, order.coupon);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { discount: ledgerFigures.discount, tax: ledgerFigures.tax, total: ledgerFigures.total },
    { discount: 150, tax: 333, total: 2183 }
  );
  assert.deepEqual(
    { discount: invoiceFigures.discount, tax: invoiceFigures.tax, total: invoiceFigures.total },
    { discount: 150, tax: 333, total: 2183 }
  );
  assert.equal(invoiceFigures.rows[0].gstPercent, 18);
});

test('invoice honors SAVE10 minimum subtotal and matches billed totals', function () {
  const order = {
    items: [
      { id: 4, name: 'Tea', sku: 'TEA', hsn: '0902', gstRate: 18, price: 100, qty: 1 }
    ],
    coupon: 'SAVE10'
  };

  const ledgerFigures = pricing.computeTotals(order.items, order.coupon);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { discount: ledgerFigures.discount, tax: ledgerFigures.tax, total: ledgerFigures.total },
    { discount: 0, tax: 18, total: 118 }
  );
  assert.deepEqual(
    { discount: invoiceFigures.discount, tax: invoiceFigures.tax, total: invoiceFigures.total },
    { discount: 0, tax: 18, total: 118 }
  );
});

test('invoice interprets fractional gstRate consistently with billing', function () {
  const items = [
    { id: 5, name: 'Rice', sku: 'RICE', hsn: '1006', gstRate: 0.05, price: 100, qty: 1 }
  ];

  const ledgerFigures = pricing.computeTotals(items, '');
  const invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(ledgerFigures.lines[0].gstPercent, 5);
  assert.equal(ledgerFigures.tax, 5);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.tax, 5);
  assert.equal(ledgerFigures.total, 105);
  assert.equal(invoiceFigures.total, 105);
});
