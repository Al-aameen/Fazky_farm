import React, { useState, useRef } from 'react';
import { useData } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import DatePicker from '../components/DatePicker';
import { exportToExcel, parseImportFile } from '../lib/csvExportImport';
import { 
  Users, 
  ShoppingCart, 
  Printer, 
  Plus, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  Download,
  Upload,
  FileText, 
  Search,
  Building
} from 'lucide-react';

export default function CustomerOrders() {
  const { data, insertRecord, bulkInsertRecords } = useData();
  const { role, worker } = useAuth();
  const importRef = useRef(null);

  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'customers'
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Modal states
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // New Order Form State
  const [customerName, setCustomerName] = useState('');
  const [crates, setCrates] = useState('');
  const [unitPrice, setUnitPrice] = useState('4400');
  const [paymentStatus, setPaymentStatus] = useState('Paid'); // 'Paid' | 'Pending' | 'Partial'
  const [amountPaid, setAmountPaid] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const salesLog = data.sales_log || [];

  // Group sales into customer directory
  const getCustomerDirectory = () => {
    const map = {};
    salesLog.forEach(s => {
      const name = s.customer_name || 'Anonymous Customer';
      if (!map[name]) {
        map[name] = { name, totalCrates: 0, totalAmount: 0, orderCount: 0, lastOrderDate: s.date };
      }
      map[name].totalCrates += parseInt(s.crates) || 0;
      map[name].totalAmount += (parseFloat(s.cash_paid) || 0) + (parseFloat(s.transfer_amount) || 0) + (parseFloat(s.deposit_amount) || 0);
      map[name].orderCount += 1;
      if (s.date > map[name].lastOrderDate) map[name].lastOrderDate = s.date;
    });
    return Object.values(map);
  };

  const customers = getCustomerDirectory();

  // Create Direct Order
  const handleCreateOrderSubmit = async (e) => {
    e.preventDefault();
    if (!customerName || !crates) return;

    setSubmitting(true);
    try {
      const cratesNum = parseInt(crates) || 0;
      const priceNum = parseFloat(unitPrice) || 4400;
      const totalAmount = cratesNum * priceNum;
      const paidVal = paymentStatus === 'Paid' ? totalAmount : (parseFloat(amountPaid) || 0);

      const payload = {
        date: selectedDate,
        day_of_week: new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' }),
        customer_name: customerName,
        crates: cratesNum,
        cash_paid: paidVal,
        transfer_amount: 0,
        deposit_amount: 0,
        is_payment: paymentStatus === 'Paid',
        remarks: `Direct Customer Order (@ ₦${priceNum.toLocaleString()}/crate) - Status: ${paymentStatus}`,
        created_by: worker?.id || 'admin'
      };

      await insertRecord('sales_log', payload);
      setShowOrderModal(false);
      setCustomerName('');
      setCrates('');
      setAmountPaid('');
    } catch (err) {
      console.error('Error logging order:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Trigger Print Receipt Modal
  const handlePrintReceipt = (sale) => {
    setSelectedInvoice(sale);
    setShowInvoiceModal(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-farm pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 text-dark-green rounded-xl shadow-sm">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-dark-green">Farm CRM & Sales Orders</h1>
            <p className="text-xs text-text-muted font-sans mt-0.5">
              All orders here are written directly to the <strong>Sales Log</strong> — one unified record. Use this for customer lookups, quick sales entry, and printable receipts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => exportToExcel('fazky_customer_orders', 'Orders', salesLog)}
            className="flex items-center gap-1.5 bg-white hover:bg-emerald-50 text-dark-green font-bold px-3.5 py-2 rounded-xl text-xs border border-border-farm shadow-sm transition-all"
          >
            <Download className="w-4 h-4 text-primary" />
            <span>Export Orders</span>
          </button>

          <button
            onClick={() => setShowOrderModal(true)}
            className="flex items-center gap-1.5 bg-dark-green hover:bg-emerald-900 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Direct Order</span>
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-border-farm gap-4 text-sm font-serif font-bold">
        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-2 transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'orders'
              ? 'border-primary text-dark-green'
              : 'border-transparent text-text-muted hover:text-dark-green'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Sales Orders Ledger</span>
        </button>

        <button
          onClick={() => setActiveTab('customers')}
          className={`pb-2 transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'customers'
              ? 'border-primary text-dark-green'
              : 'border-transparent text-text-muted hover:text-dark-green'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Customer Directory ({customers.length})</span>
        </button>
      </div>

      {/* Tab 1: Orders Ledger */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-2xl border border-border-farm p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border-farm pb-3">
            <h3 className="font-serif font-bold text-dark-green text-base">Recent Sales Orders</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <DatePicker value={selectedDate} onChange={setSelectedDate} label="Filter Date" />
              {/* Hidden import input */}
              <input
                type="file"
                ref={importRef}
                className="hidden"
                accept=".csv,.xlsx,.xls"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const rows = await parseImportFile(file);
                    const result = await bulkInsertRecords('sales_log', rows);
                    alert(`✅ Imported ${result?.count ?? rows.length} orders successfully.`);
                  } catch (err) {
                    alert('❌ Import failed: ' + err.message);
                  } finally {
                    e.target.value = '';
                  }
                }}
              />
              <button
                type="button"
                onClick={() => importRef.current?.click()}
                className="flex items-center gap-1 bg-white hover:bg-blue-50 text-dark-green font-bold px-2.5 py-1.5 rounded-lg text-xs border border-border-farm shadow-sm transition-all"
              >
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>Import</span>
              </button>
              <button
                type="button"
                onClick={() => exportToExcel('fazky_orders', 'Orders', salesLog)}
                className="flex items-center gap-1 bg-white hover:bg-emerald-50 text-dark-green font-bold px-2.5 py-1.5 rounded-lg text-xs border border-border-farm shadow-sm transition-all"
              >
                <Download className="w-3.5 h-3.5 text-primary" />
                <span>Export</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-xs">
              <thead className="bg-bg-farm text-text-muted uppercase text-[10px] font-bold border-y border-border-farm">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Customer Name</th>
                  <th className="p-3 text-center">Crates</th>
                  <th className="p-3 text-right">Total Amount (₦)</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-farm">
                {salesLog.slice(0, 20).map((sale) => {
                  const total = (parseFloat(sale.cash_paid) || 0) + (parseFloat(sale.transfer_amount) || 0) + (parseFloat(sale.deposit_amount) || 0);

                  return (
                    <tr key={sale.id} className="hover:bg-emerald-50/40 transition-colors">
                      <td className="p-3 font-semibold text-text-muted">{sale.date}</td>
                      <td className="p-3 font-serif font-bold text-dark-green">{sale.customer_name}</td>
                      <td className="p-3 text-center font-bold">{sale.crates}</td>
                      <td className="p-3 text-right font-serif font-bold text-dark-green">
                        ₦{total.toLocaleString()}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          sale.is_payment ? 'bg-emerald-100 text-dark-green' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {sale.is_payment ? 'Paid' : 'Pending'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handlePrintReceipt(sale)}
                          className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-dark-green border border-border-farm rounded-lg text-xs font-bold shadow-sm transition-all inline-flex items-center gap-1"
                        >
                          <Printer className="w-3.5 h-3.5 text-primary" />
                          <span>Receipt</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Customer Directory */}
      {activeTab === 'customers' && (
        <div className="bg-white rounded-2xl border border-border-farm p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border-farm pb-3">
            <h3 className="font-serif font-bold text-dark-green text-base">Customer Account Profiles</h3>
            <span className="text-xs text-text-muted font-bold">{customers.length} registered buyers</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customers.map((c, idx) => (
              <div key={idx} className="p-4 bg-bg-farm rounded-xl border border-border-farm space-y-3">
                <div className="flex items-center justify-between border-b border-border-farm pb-2">
                  <span className="font-serif font-bold text-dark-green text-base">{c.name}</span>
                  <span className="bg-emerald-100 text-dark-green text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {c.orderCount} Orders
                  </span>
                </div>

                <div className="space-y-1 text-xs font-semibold text-text-primary">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Total Crates Bought:</span>
                    <span className="font-bold text-primary">{c.totalCrates} crates</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Total Spent:</span>
                    <span className="font-serif font-bold text-dark-green">₦{c.totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-text-muted">Last Purchase:</span>
                    <span>{c.lastOrderDate}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal 1: Create Direct Order */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-border-farm shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-farm pb-3">
              <h3 className="font-serif font-bold text-dark-green text-lg">Create Direct Sales Order</h3>
              <button 
                onClick={() => setShowOrderModal(false)}
                className="text-text-muted hover:text-dark-green font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrderSubmit} className="space-y-4 font-sans text-xs">
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Iya Moria / Golden Groceries"
                  className="w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-accent"
                  required
                />
              </div>

              <div>
                <DatePicker label="Order Date" value={selectedDate} onChange={setSelectedDate} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1">
                    Crates Count
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={crates}
                    onChange={(e) => setCrates(e.target.value)}
                    placeholder="e.g. 10"
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-2 text-sm font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1">
                    Price / Crate (₦)
                  </label>
                  <input
                    type="number"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-2 text-sm font-semibold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1">
                  Payment Status
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-2 text-xs font-bold"
                >
                  <option value="Paid">Fully Paid</option>
                  <option value="Pending">Pending Payment</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="flex-1 py-2 bg-bg-farm text-text-primary font-bold text-xs rounded-xl border border-border-farm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 bg-dark-green text-white font-bold text-xs rounded-xl hover:bg-emerald-900 shadow-sm"
                >
                  {submitting ? 'Creating...' : 'Confirm Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Printable Invoice / Official Receipt */}
      {showInvoiceModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-8 border border-border-farm shadow-2xl space-y-6">
            {/* Printable Receipt Area */}
            <div id="printable-receipt" className="space-y-4 font-sans text-xs">
              <div className="text-center border-b border-border-farm pb-4">
                <span className="text-3xl">🌾</span>
                <h2 className="font-serif text-2xl font-black text-dark-green tracking-wider mt-1">FAZKY FARM</h2>
                <p className="text-[11px] text-text-muted uppercase tracking-widest font-bold">Official Sales Receipt</p>
              </div>

              <div className="flex justify-between text-xs font-semibold border-b border-border-farm pb-3">
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Receipt No:</span>
                  <span className="font-mono text-dark-green font-bold">#INV-{selectedInvoice.id?.substring(0, 8) || '2026-001'}</span>
                </div>
                <div className="text-right">
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Date:</span>
                  <span>{selectedInvoice.date}</span>
                </div>
              </div>

              <div>
                <span className="text-text-muted block text-[10px] uppercase font-bold mb-1">Customer / Buyer:</span>
                <span className="font-serif text-base font-bold text-dark-green">{selectedInvoice.customer_name}</span>
              </div>

              <table className="w-full text-left font-sans border-y border-border-farm my-4">
                <thead className="bg-bg-farm text-text-muted uppercase text-[9px] font-bold">
                  <tr>
                    <th className="p-2">Description</th>
                    <th className="p-2 text-center">Qty</th>
                    <th className="p-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-farm">
                  <tr>
                    <td className="p-2 font-serif font-bold text-dark-green">Egg Crates</td>
                    <td className="p-2 text-center font-bold">{selectedInvoice.crates} crates</td>
                    <td className="p-2 text-right font-serif font-bold">
                      ₦{((parseFloat(selectedInvoice.cash_paid) || 0) + (parseFloat(selectedInvoice.transfer_amount) || 0) + (parseFloat(selectedInvoice.deposit_amount) || 0)).toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="flex justify-between items-center bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
                <span className="font-bold text-dark-green">Total Paid Status:</span>
                <span className="font-serif text-lg font-black text-dark-green">
                  {selectedInvoice.is_payment ? 'PAID IN FULL' : 'PARTIAL / PENDING'}
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="flex-1 py-2.5 bg-bg-farm text-text-primary font-bold text-xs rounded-xl border border-border-farm"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-dark-green hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
