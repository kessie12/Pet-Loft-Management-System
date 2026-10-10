import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { canManageCredit } from '../lib/systemRules';
import { StoreCreditRecord } from '../types';
import { CreditCard, Plus, ShieldAlert, Search, Edit } from 'lucide-react';

export const StoreCreditWalletView: React.FC = () => {
  const { storeCredits, customers, role, systemConfig, isBossLoggedIn, isStaffLoggedIn, addStoreCreditRecord, updateStoreCreditRecord } = useApp();
  const creditAllowed = canManageCredit(role, isBossLoggedIn, isStaffLoggedIn, systemConfig.staffCanManageCredit);
  const [creditError, setCreditError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<StoreCreditRecord | null>(null);

  // New Credit Record State
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newCashIn, setNewCashIn] = useState<number>(0);
  const [newBonusGift, setNewBonusGift] = useState<number>(0);
  const [newPaymentMethod, setNewPaymentMethod] = useState('Cash');
  const [newRemark, setNewRemark] = useState('');
  const [newReceiptNo, setNewReceiptNo] = useState('');

  const filteredRecords = storeCredits.filter(
    (r) =>
      r.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.contact.includes(searchTerm) ||
      r.remark.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalStoreCreditInCirculation = customers.reduce((sum, c) => sum + c.storeCredit, 0);

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const today = new Date().toISOString().split('T')[0];
    const totalCredit = Number(newCashIn) + Number(newBonusGift);

    try {
    await addStoreCreditRecord({
      topUpDate: today,
      contact: newContact,
      ownerName: newOwnerName,
      cashIn: Number(newCashIn),
      paymentMethod: newPaymentMethod,
      bonusGift: Number(newBonusGift),
      totalCredit,
      remark: newRemark,
      receiptNo: newReceiptNo || `CR-${Date.now()}`,
    });

    } catch (error) { setCreditError(error instanceof Error ? error.message : 'Unable to record credit.'); return; }
    setCreditError('');
    setIsAddModalOpen(false);
    setNewOwnerName('');
    setNewContact('');
    setNewCashIn(0);
    setNewBonusGift(0);
    setNewRemark('');
    setNewReceiptNo('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-amber-600" />
            Store Credit & Top-Up Wallet Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track customer prepayment balances, unused credits, bonus gifts, and manual top-ups.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!creditAllowed ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              Staff View-Only Mode
            </div>
          ) : (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Record Credit / Top-Up
            </button>
          )}
        </div>
      </div>

      {creditError && <p role="alert" className="text-sm text-rose-700">{creditError}</p>}
      {/* Circulation Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Total Credit in Customer Wallets</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">RM {totalStoreCreditInCirculation}</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Prepaid store currency available</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Customers With Recorded Credit</span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {customers.filter(customer => customer.storeCredit > 0).length}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Based on current customer records</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Management Policy</span>
          <div className="text-xs text-slate-600 mt-2 leading-relaxed">
            Credit changes are handled by the shop. {systemConfig.staffCanManageCredit ? 'The boss has enabled staff credit access.' : 'Staff has read-only access; only the boss can modify credit.'}
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-base">Historical Transaction Ledger</h2>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search customer, phone, remark..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:border-amber-600 focus:outline-hidden"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Owner Name</th>
                <th className="py-3 px-3">Contact</th>
                <th className="py-3 px-3">Cash In (RM)</th>
                <th className="py-3 px-3">Method</th>
                <th className="py-3 px-3">Bonus Gift</th>
                <th className="py-3 px-3">Total Credit</th>
                <th className="py-3 px-3">Receipt No.</th>
                <th className="py-3 px-3">Remark</th>
                {creditAllowed && <th className="py-3 px-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map((r) => (
                <tr key={r.id} className="hover:bg-amber-50/30 transition-colors">
                  <td className="py-3 px-3 whitespace-nowrap text-slate-600">{r.topUpDate}</td>
                  <td className="py-3 px-3 whitespace-nowrap font-bold text-slate-900">{r.ownerName}</td>
                  <td className="py-3 px-3 whitespace-nowrap text-slate-500 font-mono">{r.contact}</td>
                  <td className={`py-3 px-3 whitespace-nowrap font-bold ${r.cashIn >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    RM {r.cashIn}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap text-slate-700">{r.paymentMethod}</td>
                  <td className="py-3 px-3 whitespace-nowrap text-slate-600">RM {r.bonusGift}</td>
                  <td className="py-3 px-3 whitespace-nowrap font-black text-slate-900">
                    RM {r.totalCredit}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-amber-800">
                    {r.receiptNo || '-'}
                  </td>
                  <td className="py-3 px-3 text-slate-600 max-w-xs truncate">{r.remark}</td>
                  {creditAllowed && (
                    <td className="py-3 px-3 whitespace-nowrap text-right">
                      <button
                        onClick={() => setEditingRecord(r)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
                        title="Edit credit record details"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Boss Add Top-Up Record Modal */}
      {isAddModalOpen && creditAllowed && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form onSubmit={handleCreateRecord} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-600" />
              Record Customer Store Credit
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter customer name"
                  value={newOwnerName}
                  onChange={(e) => setNewOwnerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Contact Phone *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter customer phone number"
                  value={newContact}
                  onChange={(e) => setNewContact(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cash In (RM) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={newCashIn}
                    onChange={(e) => setNewCashIn(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bonus Gift (RM)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newBonusGift}
                    onChange={(e) => setNewBonusGift(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={newPaymentMethod}
                  onChange={(e) => setNewPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="Cash">Cash (In-Store)</option>
                  <option value="Bank Transfer">Bank Transfer (Maybank)</option>
                  <option value="DuitNow QR">DuitNow QR</option>
                  <option value="Unused Balance">Unused Balance</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Receipt No. (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. R0220260901"
                  value={newReceiptNo}
                  onChange={(e) => setNewReceiptNo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Remark / Reason</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Unused balance converted from cancelled booking"
                  value={newRemark}
                  onChange={(e) => setNewRemark(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
              >
                Save Record & Top Up Wallet
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Record Modal (Boss only) */}
      {editingRecord && creditAllowed && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Edit Ledger Record</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Remark</label>
                <input
                  type="text"
                  value={editingRecord.remark}
                  onChange={(e) => setEditingRecord({ ...editingRecord, remark: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Receipt No</label>
                <input
                  type="text"
                  value={editingRecord.receiptNo || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, receiptNo: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingRecord(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    await updateStoreCreditRecord(editingRecord.id, { remark: editingRecord.remark, receiptNo: editingRecord.receiptNo });
                    setCreditError(''); setEditingRecord(null);
                  } catch (error) { setCreditError(error instanceof Error ? error.message : 'Unable to update credit.'); }
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
