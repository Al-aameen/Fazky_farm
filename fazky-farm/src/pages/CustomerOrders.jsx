import React, { useState, useRef } from 'react';
import { useData } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import DatePicker from '../components/DatePicker';
import { exportToExcel } from '../lib/csvExportImport';
import { 
  Users, 
  ShoppingCart, 
  Printer, 
  Plus, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  Download,
  Calendar, 
  Search,
  Building,
  UserCheck,
  ChevronRight,
  ArrowUpRight
} from 'lucide-react';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function CustomerOrders() {
  const { data, insertRecord } = useData();
  const { role, worker } = useAuth();

  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'customers'
  const [selectedDayFilter, setSelectedDayFilter] = useState('All');
  const [customerSearch, setCustomerSearch] = useState('');
  
  const todayIso = new Date().toISOString().split('T')[0];
  const todayDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const [selectedDate, setSelectedDate] = useState(todayIso);
  
  // Modal states
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // New Order Form State
  const [customerName, setCustomerName] = useState('');
  const [crates, setCrates] = useState('');
  const [unitPrice, setUnitPrice] = useState('4400');
  const [paymentStatus, setPaymentStatus] = useState('Paid');
  const [amountPaid, setAmountPaid] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const salesLog = data.sales_log || [];

  // Group sales into customer directory and infer / store preferred scheduled day
  const getCustomerDirectory = () => {
    const map = {};
    salesLog.forEach(s => {
      const name = s.customer_name?.trim() || 'Anonymous Customer';
      if (!map[name]) {
        // Derive preferred day from most frequent day in history, or fallback to record's day
        map[name] = { 
          name, 
          totalCrates: 0, 
          totalAmount: 0, 
          orderCount: 0, 
          lastOrderDate: s.date,
          dayCounts: {},
          assignedDay: s.day_of_week || 'Monday'
        };
      }
      map[name].totalCrates += parseInt(s.crates) || 0;
      map[name].totalAmount += (parseFloat(s.cash_paid) || 0) + (parseFloat(s.transfer_amount) || 0) + (parseFloat(s.deposit_amount) || 0);
      map[name].orderCount += 1;
      if (s.date > map[name].lastOrderDate) {
        map[name].lastOrderDate = s.date;
      }
      if (s.day_of_week) {
        map[name].dayCounts[s.day_of_week] = (map[name].dayCounts[s.day_of_week] || 0) + 1;
      }
    });

    // Compute dominant day of week for each customer
    Object.values(map).forEach(c => {
      let maxDay = c.assignedDay;
      let maxCount = 0;
      Object.entries(c.dayCounts).forEach(([day, count]) => {
        if (count > maxCount) {
          maxCount = count;
          maxDay = day;
        }
      });
      c.assignedDay = maxDay;
    });

    return Object.values(map);
  };

  const customers = getCustomerDirectory();

  // Filter customers by selected day tab & search
  const filteredCustomers = customers.filter(c => {
    const matchesDay = selectedDayFilter === 'All' || c.assignedDay === selectedDayFilter;
    const matchesSearch = !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase());
    return matchesDay && matchesSearch;
  });

  // Today's scheduled customers
  const todaysScheduledCustomers = customers.filter(c => c.assignedDay === todayDayName);

  // Quick Select Customer
  const handleSelectCustomerForOrder = (name) => {
    setCustomerName(name);
    setShowOrderModal(true);
  };

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
      const dayName = new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' });

      const payload = {
        date: selectedDate,
        day_of_week: dayName,
        customer_name: customerName.trim(),
        crates: cratesNum,
        cash_paid: paidVal,
        transfer_amount: 0,
        deposit_amount: 0,
        is_payment: false,
        remarks: `Direct Order (@ ₦${priceNum.toLocaleString()}/crate) - ${paymentStatus}`,
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
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── Top Header ── */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-border-farm shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-serif font-bold text-xl sm:text-2xl text-dark-green">
            <ShoppingCart className="w-6 h-6 text-primary" />
            <span>Farm CRM & Scheduled Customer Orders</span>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Customer directory segregated by scheduled pickup days (Monday–Sunday) with one-click ordering and receipt generation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => exportToExcel('fazky_customer_orders', 'Orders', salesLog)}
            className="bg-bg-farm hover:bg-border-farm/40 text-dark-green font-bold text-xs px-3.5 py-2.5 rounded-xl border border-border-farm flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Download className="w-4 h-4 text-primary" />
            <span>Export Orders</span>
          </button>

          <button
            onClick={() => {
              setCustomerName('');
              setShowOrderModal(true);
            }}
            className="bg-primary hover:bg-dark-green text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center gap-1.5 transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Sales Order</span>
          </button>
        </div>
      </div>

      {/* ── Today's Expected Customers Quick Strip (Item VIII) ── */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 rounded-3xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 font-serif font-bold text-sm text-dark-green">
            <Calendar className="w-4 h-4 text-primary" />
            <span>Today's Scheduled Customers ({todayDayName})</span>
          </div>
          <span className="text-[11px] text-text-muted">
            {todaysScheduledCustomers.length} buyers scheduled for today
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {todaysScheduledCustomers.length > 0 ? (
            todaysScheduledCustomers.map(c => (
              <button
                key={c.name}
                onClick={() => handleSelectCustomerForOrder(c.name)}
                className="bg-white hover:bg-dark-green hover:text-white text-dark-green border border-emerald-300 font-bold text-xs px-3 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                title="Click to quickly create order for this customer"
              >
                <span>{c.name}</span>
                <span className="text-[10px] opacity-70">({c.totalCrates} crt avg)</span>
                <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
              </button>
            ))
          ) : (
            <span className="text-xs text-text-muted italic">
              No specific recurring customers mapped to {todayDayName} yet. Click below to add an order for any customer.
            </span>
          )}
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex gap-2 border-b border-border-farm pb-2">
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'orders'
              ? 'bg-dark-green text-white shadow-md'
              : 'text-text-muted hover:text-dark-green hover:bg-bg-farm'
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>Orders Log</span>
        </button>

        <button
          onClick={() => setActiveTab('customers')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'customers'
              ? 'bg-dark-green text-white shadow-md'
              : 'text-text-muted hover:text-dark-green hover:bg-bg-farm'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Customer Directory by Day ({customers.length})</span>
        </button>
      </div>

      {/* ── Tab 1: Orders Log ── */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-3xl border border-border-farm p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-dark-green text-base">Recent Sales Orders</h3>
            <span className="text-xs text-text-muted font-bold">{salesLog.length} orders logged</span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border-farm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-bg-farm border-b border-border-farm text-text-muted uppercase text-[10px] font-bold">
                  <th className="p-3.5">Date & Day</th>
                  <th className="p-3.5">Customer Name</th>
                  <th className="p-3.5 text-center">Crates</th>
                  <th className="p-3.5 text-right">Cash Paid</th>
                  <th className="p-3.5 text-right">Transfer</th>
                  <th className="p-3.5">Status / Remarks</th>
                  <th className="p-3.5 text-center">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-farm/50">
                {salesLog.length > 0 ? (
                  [...salesLog].reverse().slice(0, 50).map((sale) => {
                    const totalPaid = (parseFloat(sale.cash_paid) || 0) + (parseFloat(sale.transfer_amount) || 0) + (parseFloat(sale.deposit_amount) || 0);
                    return (
                      <tr key={sale.id} className="hover:bg-bg-farm/40 transition-colors">
                        <td className="p-3.5">
                          <div className="font-mono font-bold text-dark-green">{sale.date}</div>
                          <div className="text-[10px] text-text-muted">{sale.day_of_week || '—'}</div>
                        </td>
                        <td className="p-3.5 font-bold text-dark-green">{sale.customer_name}</td>
                        <td className="p-3.5 text-center font-bold font-mono text-dark-green">{sale.crates || 0}</td>
                        <td className="p-3.5 text-right font-mono text-text-muted">₦{Number(sale.cash_paid || 0).toLocaleString()}</td>
                        <td className="p-3.5 text-right font-mono text-text-muted">₦{Number(sale.transfer_amount || 0).toLocaleString()}</td>
                        <td className="p-3.5 text-[11px] text-text-muted">{sale.remarks || 'Standard Order'}</td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => handlePrintReceipt(sale)}
                            className="p-1.5 text-primary hover:bg-emerald-50 rounded-lg transition-colors font-bold inline-flex items-center gap-1 text-xs"
                            title="Generate Invoice Receipt"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Print</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-text-muted">No sales orders found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 2: Day-Segregated Customer Directory (Item VIII) ── */}
      {activeTab === 'customers' && (
        <div className="bg-white rounded-3xl border border-border-farm p-5 sm:p-6 shadow-sm space-y-5">
          {/* Day Filters */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border-farm pb-3">
            <button
              onClick={() => setSelectedDayFilter('All')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedDayFilter === 'All'
                  ? 'bg-dark-green text-white shadow-xs'
                  : 'bg-bg-farm text-text-muted hover:text-dark-green'
              }`}
            >
              All Days ({customers.length})
            </button>
            {WEEKDAYS.map(day => {
              const count = customers.filter(c => c.assignedDay === day).length;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDayFilter(day)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                    selectedDayFilter === day
                      ? 'bg-dark-green text-white shadow-xs'
                      : day === todayDayName
                      ? 'bg-emerald-100 text-dark-green font-black border border-emerald-300'
                      : 'bg-bg-farm text-text-muted hover:text-dark-green'
                  }`}
                >
                  <span>{day}</span>
                  <span className="text-[10px] opacity-70">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Search bar */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-3" />
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Search customer name..."
              className="w-full bg-bg-farm border border-border-farm rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Customer Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((c, idx) => (
                <div key={idx} className="p-4 bg-bg-farm rounded-2xl border border-border-farm space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-border-farm pb-2">
                      <span className="font-serif font-bold text-dark-green text-base truncate">{c.name}</span>
                      <span className="bg-emerald-100 text-dark-green text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {c.assignedDay}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-text-primary mt-2.5">
                      <div className="flex justify-between">
                        <span className="text-text-muted">Total Crates:</span>
                        <span className="font-bold text-primary font-mono">{c.totalCrates} crates</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">Total Spent:</span>
                        <span className="font-mono font-bold text-dark-green">₦{c.totalAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-text-muted">Orders Count:</span>
                        <span>{c.orderCount} purchases</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSelectCustomerForOrder(c.name)}
                    className="w-full bg-white hover:bg-dark-green hover:text-white text-dark-green border border-border-farm font-bold text-xs py-2 rounded-xl transition-colors shadow-xs flex items-center justify-center gap-1 mt-2"
                  >
                    <span>+ Quick Create Order</span>
                  </button>
                </div>
              ))
            ) : (
              <div className="col-span-3 p-8 text-center text-text-muted text-xs">
                No customers found matching this day or search filter.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Create Direct Sales Order ── */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-border-farm shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
            <div className="bg-dark-green p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-serif font-bold text-base">
                <ShoppingCart className="w-5 h-5 text-accent" />
                <span>Create Direct Sales Order</span>
              </div>
              <button 
                onClick={() => setShowOrderModal(false)}
                className="text-white/70 hover:text-white font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrderSubmit} className="p-6 space-y-4 text-xs">
              {/* Customer Selector / Off-schedule option (Item VIII) */}
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Customer Name *
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Type or select customer name..."
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2.5 text-xs font-bold focus:ring-2 focus:ring-accent focus:outline-none"
                  />

                  {/* Off-schedule directory selector */}
                  <select
                    onChange={(e) => {
                      if (e.target.value) setCustomerName(e.target.value);
                    }}
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-1.5 text-xs text-text-muted focus:outline-none"
                  >
                    <option value="">— Or choose existing customer from directory —</option>
                    {customers.map(c => (
                      <option key={c.name} value={c.name}>
                        {c.name} (Scheduled: {c.assignedDay})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Order Date *
                </label>
                <input
                  type="date"
                  required
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2.5 text-xs font-bold focus:ring-2 focus:ring-accent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Crates Count *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={crates}
                    onChange={(e) => setCrates(e.target.value)}
                    placeholder="e.g. 15"
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2.5 text-xs font-bold font-mono focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Price / Crate (₦) *
                  </label>
                  <input
                    type="number"
                    required
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2.5 text-xs font-bold font-mono focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>
              </div>

              {crates && unitPrice && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <span className="text-[11px] font-bold text-dark-green">Total Order Value:</span>
                  <span className="font-serif font-bold text-sm text-dark-green">
                    ₦{(Number(crates) * Number(unitPrice)).toLocaleString()}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Payment Status
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2.5 text-xs font-bold focus:ring-2 focus:ring-accent focus:outline-none"
                >
                  <option value="Paid">Fully Paid (Cash/Transfer)</option>
                  <option value="Pending">Pending Payment (Credit)</option>
                  <option value="Partial">Partial Deposit</option>
                </select>
              </div>

              {paymentStatus === 'Partial' && (
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Deposit Amount Paid (₦)
                  </label>
                  <input
                    type="number"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder="e.g. 20000"
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2.5 text-xs font-bold font-mono focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>
              )}

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="flex-1 bg-bg-farm hover:bg-border-farm/40 text-text-muted font-bold py-2.5 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-primary hover:bg-dark-green text-white font-bold py-2.5 rounded-xl shadow-sm transition-all"
                >
                  {submitting ? 'Saving...' : 'Save Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Receipt Print View ── */}
      {showInvoiceModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-border-farm shadow-2xl max-w-sm w-full p-6 space-y-4 animate-scale-in text-xs font-sans">
            <div className="text-center border-b border-border-farm pb-3 space-y-1">
              <span className="text-2xl">🌾</span>
              <h2 className="font-serif font-bold text-base text-dark-green">FAZKY FARMS NIGERIA</h2>
              <p className="text-[10px] text-text-muted">Poultry & General Agricultural Produce</p>
              <p className="text-[9px] font-mono text-text-muted">Sales Receipt #{selectedInvoice.id?.slice(0, 8)}</p>
            </div>

            <div className="space-y-1.5 text-text-muted">
              <div className="flex justify-between"><span>Date:</span> <strong className="text-text-primary">{selectedInvoice.date}</strong></div>
              <div className="flex justify-between"><span>Customer:</span> <strong className="text-dark-green">{selectedInvoice.customer_name}</strong></div>
              <div className="flex justify-between"><span>Crates:</span> <strong className="font-mono text-dark-green">{selectedInvoice.crates} crates</strong></div>
              <div className="flex justify-between"><span>Total Amount:</span> <strong className="font-mono text-dark-green">₦{Number((selectedInvoice.cash_paid || 0) + (selectedInvoice.transfer_amount || 0)).toLocaleString()}</strong></div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowInvoiceModal(false)}
                className="flex-1 bg-bg-farm text-text-muted font-bold py-2 rounded-xl"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 bg-dark-green text-white font-bold py-2 rounded-xl flex items-center justify-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
