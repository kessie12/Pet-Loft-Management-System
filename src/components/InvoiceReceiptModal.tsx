import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { defaultReceiptConfig } from '../lib/pricing';
import { Booking, BookingPet } from '../types';
import { Printer, X, FileText } from 'lucide-react';

interface InvoiceReceiptModalProps {
  booking: Booking | null;
  initialType?: 'invoice' | 'depositReceipt' | 'finalReceipt';
  onClose: () => void;
}

export const InvoiceReceiptModal: React.FC<InvoiceReceiptModalProps> = ({
  booking,
  initialType = 'invoice',
  onClose,
}) => {
  const { systemConfig } = useApp();
  const format=systemConfig.receiptConfig||defaultReceiptConfig;
  const [docType, setDocType] = useState<'invoice' | 'depositReceipt' | 'finalReceipt'>(initialType);

  if (!booking) return null;

  const handlePrint = () => {
    window.print();
  };

  const invoiceNumber = booking.invoiceNo || `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}001`;
  const depositReceiptNumber = booking.depositReceiptNo || `R01${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}001`;
  const finalReceiptNumber = booking.finalReceiptNo || `R02${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}001`;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full my-8 shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Top Bar - Hidden when printing */}
        <div className="no-print bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-sm tracking-wide">Official Documents Generator</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Document Type Switcher */}
            <div className="flex bg-slate-800 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setDocType('invoice')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  docType === 'invoice' ? 'bg-amber-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Invoice (INV)
              </button>
              <button
                onClick={() => setDocType('depositReceipt')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  docType === 'depositReceipt' ? 'bg-amber-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Deposit Receipt (R01)
              </button>
              <button
                onClick={() => setDocType('finalReceipt')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  docType === 'finalReceipt' ? 'bg-amber-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Final Receipt (R02)
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer ml-2"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white ml-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area - Exact layout of the Excel version with legal name MELLOW PET LOFT CONCEPT STORE */}
        <div id="printable-receipt" className={`${format.layout==='compact'?'p-4 sm:p-6':'p-8 sm:p-12'} text-slate-900 bg-white font-sans text-xs`}>
          {/* Letterhead Header: MELLOW PET LOFT CONCEPT STORE */}
          <div className="text-center pb-6 border-b-2 border-slate-900 mb-6 space-y-1">
            {format.showLogo&&systemConfig.logoUrl&&<img src={systemConfig.logoUrl} alt="Shop logo" className="w-16 h-16 object-contain mx-auto mb-3"/>}
            <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">
              {systemConfig.legalShopName || 'MELLOW PET LOFT CONCEPT STORE'}
            </h1>
            <p className="text-xs text-slate-700 font-medium">
              SSM Registration No.: {systemConfig.ssmNumber}
            </p>
            <p className="text-xs text-slate-600">
              Address: {systemConfig.address}
            </p>
            <p className="text-xs text-slate-600">
              Contact / WhatsApp: {systemConfig.phone} • Email: {systemConfig.email}
            </p>
          </div>

          {/* Document Title Banner */}
          <div className="text-center mb-6">
            <span className="inline-block text-sm font-black uppercase tracking-widest px-6 py-1.5 border-2 border-slate-900 bg-slate-50">
              {docType === 'invoice' && format.invoiceTitle}
              {docType === 'depositReceipt' && format.depositTitle}
              {docType === 'finalReceipt' && format.finalTitle}
            </span>
          </div>

          {/* Customer & Document Meta (Excel style 2-column layout) */}
          <div className="grid grid-cols-2 gap-8 mb-6 pb-6 border-b border-slate-200">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                CUSTOMER DETAILS:
              </div>
              <table className="w-full text-xs">
                <tbody>
                  <tr>
                    <td className="py-0.5 text-slate-500 w-28">Customer Name:</td>
                    <td className="py-0.5 font-bold">{booking.customerName}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 text-slate-500">Contact Number:</td>
                    <td className="py-0.5 font-mono">{booking.customerContact}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 text-slate-500">Pet Name:</td>
                    <td className="py-0.5 font-semibold">
                      {booking.pets.map((p: BookingPet) => p.petName || p.species).join(', ') || '-'}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-0.5 text-slate-500">Breed / Weight:</td>
                    <td className="py-0.5 text-slate-700">
                      {booking.pets.map((p: BookingPet) => `${p.breed || p.species} (${p.weightBracket})`).join(', ')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                DOCUMENT DETAILS:
              </div>
              <table className="w-full text-xs">
                <tbody>
                  <tr>
                    <td className="py-0.5 text-slate-500 w-28">Document No:</td>
                    <td className="py-0.5 font-mono font-bold text-slate-900">
                      {docType === 'invoice' && invoiceNumber}
                      {docType === 'depositReceipt' && depositReceiptNumber}
                      {docType === 'finalReceipt' && finalReceiptNumber}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-0.5 text-slate-500">Date Issued:</td>
                    <td className="py-0.5">
                      {docType === 'invoice' && booking.bookingDate}
                      {docType === 'depositReceipt' && (booking.depositDate || booking.bookingDate)}
                      {docType === 'finalReceipt' && (booking.finalDate || booking.bookingDate)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-0.5 text-slate-500">Service Date:</td>
                    <td className="py-0.5">
                      {booking.checkInDate} {booking.checkInTime ? `(${booking.checkInTime})` : ''}
                    </td>
                  </tr>
                  {booking.checkOutDate && (
                    <tr>
                      <td className="py-0.5 text-slate-500">Check-Out Date:</td>
                      <td className="py-0.5">{booking.checkOutDate}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-0.5 text-slate-500">Booking Ref:</td>
                    <td className="py-0.5 font-mono">{booking.bookingReference}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Service Summary Table */}
          <div className="mb-6">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              SERVICE BREAKDOWN:
            </div>
            <table className="w-full border-collapse border border-slate-300 text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                  <th className="border border-slate-300 py-2 px-3 text-left w-16">Item</th>
                  <th className="border border-slate-300 py-2 px-3 text-left">Service Selected</th>
                  <th className="border border-slate-300 py-2 px-3 text-center w-16">Qty</th>
                  <th className="border border-slate-300 py-2 px-3 text-right w-24">Unit Price</th>
                  <th className="border border-slate-300 py-2 px-3 text-right w-24">Total (MYR)</th>
                </tr>
              </thead>
              <tbody>
                {booking.primaryService === 'Pet Sitting' && booking.petSittingBreakdown ? (
                  <>
                    {/* First Pet Base Rate */}
                    <tr>
                      <td className="border border-slate-300 py-2 px-3 font-mono">01</td>
                      <td className="border border-slate-300 py-2 px-3">
                        <div className="font-bold">
                          Pet Sitting - 1st Pet Base Rate ({booking.petSittingBreakdown.firstPetWeightBracket})
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {booking.petSittingBreakdown.firstPetName || 'Primary / Largest Pet'}
                        </div>
                      </td>
                      <td className="border border-slate-300 py-2 px-3 text-center font-bold">1</td>
                      <td className="border border-slate-300 py-2 px-3 text-right">
                        {booking.petSittingBreakdown.firstPetBaseRate.toFixed(2)}
                      </td>
                      <td className="border border-slate-300 py-2 px-3 text-right font-bold">
                        {booking.petSittingBreakdown.firstPetBaseRate.toFixed(2)}
                      </td>
                    </tr>

                    {/* Extra Pets */}
                    {booking.petSittingBreakdown.extraPetsList.map((ep, idx) => (
                      <tr key={`ep-${idx}`}>
                        <td className="border border-slate-300 py-2 px-3 font-mono">
                          {String(idx + 2).padStart(2, '0')}
                        </td>
                        <td className="border border-slate-300 py-2 px-3">
                          <div className="font-bold">
                            Pet Sitting - Extra Pet Fee ({ep.sizeCategory})
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {ep.petName || `Extra Pet #${idx + 1}`} ({ep.weightBracket})
                          </div>
                        </td>
                        <td className="border border-slate-300 py-2 px-3 text-center font-bold">1</td>
                        <td className="border border-slate-300 py-2 px-3 text-right">
                          {ep.extraPetFee.toFixed(2)}
                        </td>
                        <td className="border border-slate-300 py-2 px-3 text-right font-bold">
                          {ep.extraPetFee.toFixed(2)}
                        </td>
                      </tr>
                    ))}

                    {/* Add-ons */}
                    {booking.petSittingBreakdown.selectedAddons.map((addon, aIdx) => {
                      const rowNum = 1 + (booking.petSittingBreakdown?.extraPetsList.length || 0) + aIdx + 1;
                      return (
                        <tr key={`addon-${addon.code}`}>
                          <td className="border border-slate-300 py-2 px-3 font-mono">
                            {String(rowNum).padStart(2, '0')}
                          </td>
                          <td className="border border-slate-300 py-2 px-3">
                            <div className="font-bold">
                              {addon.code}: {addon.name}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Additional Service ({addon.unit})
                            </div>
                          </td>
                          <td className="border border-slate-300 py-2 px-3 text-center font-bold">
                            {addon.quantity}
                          </td>
                          <td className="border border-slate-300 py-2 px-3 text-right">
                            {addon.price.toFixed(2)}
                          </td>
                          <td className="border border-slate-300 py-2 px-3 text-right font-bold">
                            {addon.subtotal.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Peak Surcharge */}
                    {booking.petSittingBreakdown.peakSurcharge > 0 && (
                      <tr>
                        <td className="border border-slate-300 py-2 px-3 font-mono">
                          {String(
                            1 +
                              (booking.petSittingBreakdown?.extraPetsList.length || 0) +
                              booking.petSittingBreakdown.selectedAddons.length +
                              1
                          ).padStart(2, '0')}
                        </td>
                        <td className="border border-slate-300 py-2 px-3">
                          <div className="font-bold">S-PP: Peak Period Surcharge</div>
                          <div className="text-[11px] text-slate-500">Holiday / Peak Season Visit</div>
                        </td>
                        <td className="border border-slate-300 py-2 px-3 text-center font-bold">1</td>
                        <td className="border border-slate-300 py-2 px-3 text-right">
                          {booking.petSittingBreakdown.peakSurcharge.toFixed(2)}
                        </td>
                        <td className="border border-slate-300 py-2 px-3 text-right font-bold">
                          {booking.petSittingBreakdown.peakSurcharge.toFixed(2)}
                        </td>
                      </tr>
                    )}
                  </>
                ) : (
                  <tr>
                    <td className="border border-slate-300 py-2 px-3 font-mono">01</td>
                    <td className="border border-slate-300 py-2 px-3">
                      <div className="font-bold">{booking.primaryService}</div>
                      <div className="text-[11px] text-slate-500">
                        {booking.pets.map((p: BookingPet) => `${p.species} (${p.weightBracket}${p.assignedRoom ? ` - Room ${p.assignedRoom}` : ''})`).join(', ')}
                      </div>
                    </td>
                    <td className="border border-slate-300 py-2 px-3 text-center font-bold">
                      {booking.numberOfPets}
                    </td>
                    <td className="border border-slate-300 py-2 px-3 text-right">
                      {(booking.totalAmount / (booking.numberOfPets || 1)).toFixed(2)}
                    </td>
                    <td className="border border-slate-300 py-2 px-3 text-right font-bold">
                      {booking.totalAmount.toFixed(2)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Payment Breakdown / Summary */}
          <div className="flex justify-end mb-8">
            <div className="w-72 bg-slate-50 border border-slate-300 p-4 rounded-lg space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal (MYR):</span>
                <span className="font-semibold">{booking.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Discount Amount (MYR):</span>
                <span>0.00</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Service Tax / SST (0%):</span>
                <span>0.00</span>
              </div>
              <div className="flex justify-between font-black text-sm text-slate-900 pt-2 border-t border-slate-300">
                <span>Final Total (MYR):</span>
                <span>{booking.totalAmount.toFixed(2)}</span>
              </div>

              {/* Deposit Receipt Specific Breakdown */}
              {docType === 'depositReceipt' && (
                <>
                  <div className="flex justify-between text-emerald-800 font-bold pt-2 border-t border-slate-300">
                    <span>Deposit Acknowledged:</span>
                    <span>RM {booking.depositPaid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 text-[11px]">
                    <span>Payment Method:</span>
                    <span>{booking.depositMethod || 'Online Bank Transfer'}</span>
                  </div>
                  <div className="flex justify-between text-rose-700 font-bold">
                    <span>Balance Due at Pick-Up:</span>
                    <span>RM {booking.balanceDue.toFixed(2)}</span>
                  </div>
                </>
              )}

              {/* Final Receipt Specific Breakdown */}
              {docType === 'finalReceipt' && (
                <>
                  <div className="flex justify-between text-slate-700 pt-2 border-t border-slate-300">
                    <span>Deposit Paid Earlier:</span>
                    <span>RM {booking.depositPaid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-800 font-bold">
                    <span>Final Payment Settled:</span>
                    <span>RM {booking.finalPaid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-black text-emerald-700 text-sm pt-1 border-t border-slate-300">
                    <span>Outstanding Balance:</span>
                    <span>RM {booking.balanceDue.toFixed(2)} {booking.balanceDue===0?'(PAID IN FULL)':'(OUTSTANDING)'}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {format.showBankDetails&&<div className="text-xs text-slate-600 py-4">Bank: {systemConfig.bankName} · Account: {systemConfig.accountName} · {systemConfig.accountNumber}</div>}
          {/* Signature & Closing Note */}
          <div className="pt-8 border-t border-slate-200 flex items-end justify-between text-xs text-slate-600">
            <div>
              <p className="font-semibold text-slate-800">{format.footer}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">This is a computer-generated document. No physical signature required.</p>
            </div>

            {format.showSignature&&<div className="text-center w-48">
              <div className="border-b border-slate-400 pb-8 mb-1"></div>
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Authorized Signature
              </span>
            </div>}
          </div>
        </div>
      </div>
    </div>
  );
};
