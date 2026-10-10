import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { canManageCredit as creditPermission } from '../lib/systemRules';
import { ManualCustomerModal } from './ManualCustomerModal';
import { Customer, Booking } from '../types';
import { 
  Users, 
  Search, 
  Phone, 
  ExternalLink, 
  CreditCard, 
  Edit, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  PlusCircle, 
  Lock, 
  Receipt,
  CheckCircle2,
  Clock
} from 'lucide-react';

interface CustomerDirectoryViewProps {
  onOpenInvoiceModal: (booking: Booking, type: 'invoice' | 'depositReceipt' | 'finalReceipt') => void;
}

export const CustomerDirectoryView: React.FC<CustomerDirectoryViewProps> = ({ onOpenInvoiceModal }) => {
  const { 
    customers, 
    bookings, 
    storeCredits, 
    updateCustomer, 
    addStoreCreditRecord, 
    role, 
    systemConfig,
    isBossLoggedIn,
    isStaffLoggedIn
  } = useApp();

  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [createdMessage, setCreatedMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'credit-desc' | 'bookings-desc' | 'newest'>('name-asc');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [expandedCustomerIds, setExpandedCustomerIds] = useState<Set<string>>(new Set());

  // Store Credit Modal state
  const [creditingCustomer, setCreditingCustomer] = useState<Customer | null>(null);
  const [topUpCash, setTopUpCash] = useState<number>(100);
  const [topUpBonus, setTopUpBonus] = useState<number>(0);
  const [topUpMethod, setTopUpMethod] = useState('Online Transfer');
  const [topUpRemark, setTopUpRemark] = useState('');
  const [creditError, setCreditError] = useState('');
  const [creditSuccessMsg, setCreditSuccessMsg] = useState<string | null>(null);

  const canManageCredit = creditPermission(role, isBossLoggedIn, isStaffLoggedIn, systemConfig.staffCanManageCredit);

  const toggleExpand = (id: string) => {
    setExpandedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.contact.includes(searchTerm) ||
      (c.petName && c.petName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.petBreed && c.petBreed.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.notes && c.notes.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    if (sortBy === 'name-asc') {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === 'name-desc') {
      return b.name.localeCompare(a.name);
    }
    if (sortBy === 'credit-desc') {
      return (b.storeCredit || 0) - (a.storeCredit || 0);
    }
    if (sortBy === 'bookings-desc') {
      const bCountA = bookings.filter((x) => x.customerContact.replace(/[^0-9]/g, '') === a.contact.replace(/[^0-9]/g, '')).length;
      const bCountB = bookings.filter((x) => x.customerContact.replace(/[^0-9]/g, '') === b.contact.replace(/[^0-9]/g, '')).length;
      return bCountB - bCountA;
    }
    if (sortBy === 'newest') {
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    }
    return 0;
  });

  const handleTopUpCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditingCustomer) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const newTotal = creditingCustomer.storeCredit + topUpCash + topUpBonus;

    try {
    await addStoreCreditRecord({
      topUpDate: todayStr,
      contact: creditingCustomer.contact,
      ownerName: creditingCustomer.name,
      cashIn: topUpCash,
      paymentMethod: topUpMethod,
      bonusGift: topUpBonus,
      totalCredit: newTotal,
      remark: topUpRemark || 'Store Credit Top-up',
      receiptNo: `CR-${Date.now().toString().slice(-6)}`,
    });

    } catch (error) { setCreditError(error instanceof Error ? error.message : 'Unable to record credit.'); return; }
    setCreditError('');
    setCreditSuccessMsg(`Added RM ${topUpCash + topUpBonus} to ${creditingCustomer.name}'s wallet!`);
    setTimeout(() => {
      setCreditSuccessMsg(null);
      setCreditingCustomer(null);
    }, 1500);
  };

  return (
    <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {creditError && <p role="alert" className="text-sm text-rose-700">{creditError}</p>}
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-600" />
            Customer &amp; Pet Directory
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Collapsible client registry with line-by-line pet histories, store credit balances, and 1-click WhatsApp.
          </p>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button type="button" onClick={() => setIsAddingCustomer(true)} className="px-4 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-bold cursor-pointer flex items-center gap-2"><PlusCircle className="w-4 h-4" />Add Customer</button>
          <div className="relative flex-1 md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search client, pet, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border border-slate-300 focus:border-amber-600 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 shrink-0">Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-bold text-slate-800 cursor-pointer focus:border-amber-600"
            >
              <option value="name-asc">Name (A ➔ Z) • Default</option>
              <option value="name-desc">Name (Z ➔ A)</option>
              <option value="credit-desc">Store Credit (Highest First)</option>
              <option value="bookings-desc">Most Bookings</option>
              <option value="newest">Newest Client</option>
            </select>
          </div>
        </div>
      </div>

      {isAddingCustomer && <ManualCustomerModal onClose={() => setIsAddingCustomer(false)} onCreated={customer => {
        setIsAddingCustomer(false); setSearchTerm(''); setCreatedMessage(`Customer ${customer.name} added. No booking was created.`);
      }} />}
      {createdMessage && <p role="status" className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-sm">{createdMessage}</p>}
      {creditSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {creditSuccessMsg}
        </div>
      )}

      {/* Expandable List View */}
      <div className="space-y-3">
        {sortedCustomers.map((cust) => {
          const isExpanded = expandedCustomerIds.has(cust.id);
          const customerBookings = bookings.filter((b) => b.customerContact.replace(/[^0-9]/g, '') === cust.contact.replace(/[^0-9]/g, ''));
          const customerCredits = storeCredits.filter((sc) => sc.contact.replace(/[^0-9]/g, '') === cust.contact.replace(/[^0-9]/g, ''));

          return (
            <div
              key={cust.id}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:border-amber-300 transition-colors"
            >
              {/* Collapsed Header (Important information only) */}
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div 
                  onClick={() => toggleExpand(cust.id)}
                  className="flex-1 flex flex-wrap items-center gap-3 cursor-pointer select-none"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 font-black text-sm flex items-center justify-center shrink-0">
                    {cust.name.slice(0, 2).toUpperCase()}
                  </div>

                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-base font-bold text-slate-900">{cust.name}</h3>
                      <a
                        href={`https://wa.me/${cust.contact.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs font-mono text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-0.5 rounded-lg border border-emerald-200 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Chat on WhatsApp"
                      >
                        <span>{cust.contact}</span>
                        <Phone className="w-3 h-3 text-emerald-600 inline shrink-0" />
                      </a>
                    </div>

                    {/* Neat Pet Name & Breed tag (Unused balance removed here as it is shown in Credit badge) */}
                    <div className="text-xs font-mono text-amber-900 bg-amber-50/80 px-2.5 py-0.5 rounded-md border border-amber-200/80 mt-1.5 inline-flex items-center gap-2">
                      <span className="font-bold text-slate-600">Pet:</span> <span className="font-bold text-amber-900">{cust.petName || '-'}</span>
                      <span className="text-slate-300">•</span>
                      <span className="font-bold text-slate-600">Breed:</span> <span className="font-semibold text-slate-800">{cust.petBreed || 'Domestic'}</span>
                    </div>

                    <div className="text-[10px] text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                      <span>Client Since: {cust.createdAt || '2026-09'} • Bookings: <strong>{customerBookings.length}</strong></span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <Clock className="w-3 h-3 text-slate-400" />
                        Modified by: <strong>{cust.lastModifiedBy || 'Allyson (Boss)'}</strong> {cust.lastModifiedAt && `(${cust.lastModifiedAt.replace('T', ' ').slice(0, 16)})`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Important Stats & Actions */}
                <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                  {/* Store Credit Badge */}
                  <div className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                    cust.storeCredit > 0
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    <CreditCard className="w-3.5 h-3.5" />
                    Credit: RM {cust.storeCredit}
                  </div>

                  {/* Top-up Credit Button (Based on Permissions) */}
                  {canManageCredit ? (
                    <button
                      type="button"
                      onClick={() => setCreditingCustomer(cust)}
                      title="Top-Up / Adjust Store Credit"
                      className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Credit</span>
                    </button>
                  ) : (
                    <span 
                      title="Store credit actions locked by Boss. View-only mode for staff."
                      className="px-2 py-1 text-[10px] bg-slate-100 text-slate-400 rounded-lg flex items-center gap-1"
                    >
                      <Lock className="w-3 h-3" />
                      View Only
                    </span>
                  )}

                  {/* WhatsApp Direct Link Button */}
                  <a
                    href={`https://wa.me/${cust.contact.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 cursor-pointer transition-colors"
                    title="WhatsApp Client"
                  >
                    <Phone className="w-4 h-4" />
                  </a>

                  {/* Edit */}
                  <button
                    onClick={() => setEditingCustomer(cust)}
                    className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 cursor-pointer"
                    title="Edit Profile"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  {/* Expand / Collapse Chevron */}
                  <button
                    onClick={() => toggleExpand(cust.id)}
                    className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer"
                    title={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded Details Container */}
              {isExpanded && (
                <div className="bg-slate-50/70 p-5 border-t border-slate-200 text-xs space-y-5 animate-fade-in">
                  {/* Clean Vertical Pet Breakdown & Compact Social Handles */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Line-by-Line Pet Details requested by user */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                      <div className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center justify-between border-b border-slate-100 pb-2">
                        <span>🐾 Pet Details &amp; Behavior Notes</span>
                        <span className="text-[10px] font-semibold text-slate-400">Detailed Record</span>
                      </div>
                      
                      <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2 text-xs">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                          <span className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider">Pet Name</span>
                          <span className="font-extrabold text-amber-900 text-xs">{cust.petName || '-'}</span>
                        </div>
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                          <span className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider">Breed</span>
                          <span className="font-bold text-slate-800 text-xs">{cust.petBreed || 'Domestic'}</span>
                        </div>
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                          <span className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider">Vaccine Expiry Date</span>
                          <span className="font-mono font-bold text-slate-800 text-xs">{cust.vaxExpiryDate || 'Not specified'}</span>
                        </div>
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                          <span className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider">Unused Balance</span>
                          <span className={cust.unusedBalance && cust.unusedBalance > 0 ? "font-black text-emerald-700 text-xs" : "font-bold text-slate-600 text-xs"}>
                            RM {cust.unusedBalance ?? cust.storeCredit ?? 0}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                          <span className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider">Unused Balance Reason</span>
                          <span className="italic text-slate-700 text-xs">{cust.unusedBalanceReason || (cust.storeCredit > 0 ? 'Store Credit' : 'None')}</span>
                        </div>
                        {cust.notes && (
                          <div className="pt-1">
                            <span className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider block mb-1">Additional Notes</span>
                            <p className="p-2 bg-white rounded-lg border border-slate-200/80 text-slate-700 text-xs leading-relaxed">{cust.notes}</p>
                          </div>
                        )}
                      </div>

                      <div className="text-[10px] text-slate-400 flex items-center gap-1 pt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        Last modified by: <strong>{cust.lastModifiedBy || 'Allyson (Boss)'}</strong> {cust.lastModifiedAt && `(${cust.lastModifiedAt.replace('T', ' ').slice(0, 16)})`}
                      </div>
                    </div>

                    {/* Compact Contracted Social Media Chips requested by user */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
                          Social Media Channels
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {cust.igHandle ? (
                            <a
                              href={`https://instagram.com/${cust.igHandle.replace('@', '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-pink-50 hover:bg-pink-100 text-pink-700 font-bold text-xs border border-pink-200 transition-colors"
                              title="Instagram Profile"
                            >
                              <span>IG: @{cust.igHandle.replace('@', '')}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-[11px] text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-200">No Instagram</span>
                          )}

                          {cust.xhsHandle ? (
                            <span
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-50 text-rose-700 font-bold text-xs border border-rose-200"
                              title="Xiaohongshu Account"
                            >
                              <span>XHS: {cust.xhsHandle}</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-200">No XHS</span>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Client since: <strong>{cust.createdAt || '2026-09'}</strong></span>
                        <span>Lifetime bookings: <strong>{customerBookings.length}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Clickable Invoices & Receipts History Table */}
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="p-3 bg-slate-100 font-bold text-slate-800 text-xs flex items-center gap-2 border-b border-slate-200">
                      <Receipt className="w-4 h-4 text-amber-700" />
                      <span>Official Invoices &amp; Receipts History (Click to Preview / Print)</span>
                    </div>

                    {customerBookings.length === 0 ? (
                      <div className="p-4 text-center text-slate-400 text-xs">
                        No previous booking documents found for this customer.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3">Booking Ref</th>
                              <th className="py-2.5 px-3">Service</th>
                              <th className="py-2.5 px-3">Date</th>
                              <th className="py-2.5 px-3">Total (RM)</th>
                              <th className="py-2.5 px-3">Invoice (INV)</th>
                              <th className="py-2.5 px-3">Deposit Receipt (R01)</th>
                              <th className="py-2.5 px-3">Final Receipt (R02)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {customerBookings.map((b) => (
                              <tr key={b.id} className="hover:bg-slate-50">
                                <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                  {b.bookingReference}
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-slate-800">
                                  {b.primaryService}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">
                                  {b.checkInDate}
                                </td>
                                <td className="py-2.5 px-3 font-bold text-slate-900">
                                  RM {b.totalAmount}
                                </td>

                                {/* Clickable Tax Invoice Link */}
                                <td className="py-2.5 px-3">
                                  <button
                                    onClick={() => onOpenInvoiceModal(b, 'invoice')}
                                    className="font-mono text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer flex items-center gap-1"
                                    title="Click to preview Tax Invoice"
                                  >
                                    <FileText className="w-3 h-3" />
                                    {b.invoiceNo || 'INV-PREVIEW'}
                                  </button>
                                </td>

                                {/* Clickable Deposit Receipt Link */}
                                <td className="py-2.5 px-3">
                                  {b.depositPaid > 0 || b.depositReceiptNo ? (
                                    <button
                                      onClick={() => onOpenInvoiceModal(b, 'depositReceipt')}
                                      className="font-mono text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer flex items-center gap-1"
                                      title="Click to preview Deposit Receipt"
                                    >
                                      <Receipt className="w-3 h-3" />
                                      {b.depositReceiptNo || 'R01-VIEW'}
                                    </button>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </td>

                                {/* Clickable Final Receipt Link */}
                                <td className="py-2.5 px-3">
                                  {b.finalPaid > 0 || b.finalReceiptNo ? (
                                    <button
                                      onClick={() => onOpenInvoiceModal(b, 'finalReceipt')}
                                      className="font-mono text-purple-700 hover:text-purple-900 font-bold underline cursor-pointer flex items-center gap-1"
                                      title="Click to preview Final Receipt"
                                    >
                                      <Receipt className="w-3 h-3" />
                                      {b.finalReceiptNo || 'R02-VIEW'}
                                    </button>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Store Credit Top-up Ledger for this customer */}
                  {customerCredits.length > 0 && (
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      <div className="font-bold text-slate-800 text-xs mb-2 flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-emerald-600" />
                        <span>Wallet Credit Transaction Log:</span>
                      </div>
                      <div className="space-y-1.5">
                        {customerCredits.map((sc) => (
                          <div key={sc.id} className="text-[11px] text-slate-600 flex items-center justify-between pb-1 border-b border-slate-100">
                            <span>{sc.topUpDate} • {sc.remark} ({sc.paymentMethod})</span>
                            <span className={sc.cashIn >= 0 ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}>
                              {sc.cashIn >= 0 ? `+RM ${sc.cashIn + sc.bonusGift}` : `-RM ${Math.abs(sc.cashIn)}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MODAL: TOP-UP STORE CREDIT */}
      {creditingCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-amber-600" />
              Manage Store Credit: {creditingCustomer.name}
            </h3>
            <p className="text-xs text-slate-500">
              Current Available Balance: <strong className="text-emerald-700">RM {creditingCustomer.storeCredit}</strong>
            </p>

            <form onSubmit={handleTopUpCredit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Top-Up Cash Amount (RM)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={topUpCash}
                  onChange={(e) => setTopUpCash(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Bonus Gift Credit (Optional RM)</label>
                <input
                  type="number"
                  min="0"
                  value={topUpBonus}
                  onChange={(e) => setTopUpBonus(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={topUpMethod}
                  onChange={(e) => setTopUpMethod(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="Online Transfer">Online Transfer</option>
                  <option value="Cash">Cash (In-Store)</option>
                  <option value="DuitNow QR">DuitNow QR</option>
                  <option value="Unused Balance">Unused Balance / Refund Credit</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Remark / Reason</label>
                <input
                  type="text"
                  placeholder="e.g. VIP package top-up, Cancelled booking balance"
                  value={topUpRemark}
                  onChange={(e) => setTopUpRemark(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreditingCustomer(null)}
                  className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-xs"
                >
                  Confirm Credit Top-Up
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Profile Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Edit Customer: {editingCustomer.name}</h3>

            <div className="space-y-3 text-xs max-h-[75vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Owner Name</label>
                  <input
                    type="text"
                    value={editingCustomer.name}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">WhatsApp Contact</label>
                  <input
                    type="text"
                    value={editingCustomer.contact}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, contact: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
              </div>

              {/* Pet Name & Breed */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Pet Name</label>
                  <input
                    type="text"
                    placeholder="Enter pet name"
                    value={editingCustomer.petName || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, petName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-amber-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Pet Breed</label>
                  <input
                    type="text"
                    placeholder="e.g. British (SH), Corgi"
                    value={editingCustomer.petBreed || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, petBreed: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              {/* Unused Balance & Reason */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unused Balance (RM)</label>
                  <input
                    type="number"
                    disabled={!canManageCredit}
                    min="0"
                    step="0.01"
                    value={editingCustomer.unusedBalance ?? editingCustomer.storeCredit ?? 0}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setEditingCustomer({ ...editingCustomer, unusedBalance: val, storeCredit: val });
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-emerald-700"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Reason / Conversion Note</label>
                  <input
                    type="text"
                    placeholder="e.g. Cancelled boarding booking"
                    disabled={!canManageCredit}
                    value={editingCustomer.unusedBalanceReason || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, unusedBalanceReason: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Instagram Handle</label>
                  <input
                    type="text"
                    placeholder="e.g. Rachel.tan10"
                    value={editingCustomer.igHandle || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, igHandle: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Xiaohongshu (XHS)</label>
                  <input
                    type="text"
                    placeholder="e.g. Blxcklxdy_08"
                    value={editingCustomer.xhsHandle || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, xhsHandle: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Additional Behavior Notes</label>
                <textarea
                  rows={2}
                  value={editingCustomer.notes || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, notes: e.target.value })}
                  placeholder="Characteristics, allergies, behavior"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingCustomer(null)}
                className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const modifier = role === 'boss' ? 'Boss (Allyson)' : 'Staff (Staff Team A)';
                  try {
                  await updateCustomer(editingCustomer.id, {
                    ...editingCustomer,
                    lastModifiedBy: modifier,
                    lastModifiedAt: new Date().toISOString(),
                  });
                  setCreditError(''); setEditingCustomer(null);
                  } catch (error) { setCreditError(error instanceof Error ? error.message : 'Unable to save customer.'); }
                }}
                className="px-5 py-2 rounded-xl font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-xs"
              >
                Save Changes (No Redirect)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
