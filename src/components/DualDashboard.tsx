import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { canManageCredit } from '../lib/systemRules';
import { ManualBookingModal } from './ManualBookingModal';
import { Booking, BookingPet } from '../types';
import { 
  Calendar as CalendarIcon, 
  List, 
  Search, 
  Phone, 
  Clock, 
  DollarSign, 
  FileText, 
  Eye, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
  CheckCircle2,
  Lock,
  Save,
  ShieldCheck,
  User
} from 'lucide-react';

interface DualDashboardProps {
  onOpenInvoiceModal: (booking: Booking, type: 'invoice' | 'depositReceipt' | 'finalReceipt') => void;
}

const ALL_STATUSES = [
  'Booked',
  'Deposit Verification Pending',
  'Deposit Paid',
  'Waiting for Onboard',
  'Onboarding',
  'Grooming',
  'Ready for Pick-Up',
  'Completed',
  'Cancelled',
];

const PAYMENT_METHODS = [
  'Bank Transfer',
  'DuitNow QR',
  'Cash',
  'Credit Card',
  'Store Credit',
  'None',
];

interface BookingDraft {
  customerName: string;
  customerContact: string;
  petName: string;
  breed: string;
  characteristics: string;
  allergiesNotes: string;
  assignedRoom: string;
  vaxExpiryDate: string;
  depositRequired: number;
  depositPaid: number;
  depositMethod: string;
  finalPaid: number;
  finalMethod: string;
  finalDate?: string;
  totalAmount: number;
  notes: string;
}

export const DualDashboard: React.FC<DualDashboardProps> = ({ onOpenInvoiceModal }) => {
  const { 
    bookings, 
    role, 
    rooms,
    systemConfig, 
    updateBooking, 
    deleteBooking, 
    verifyDeposit, 
    settlePickupBalance,
    applyStoreCreditToBooking,
    isBossLoggedIn,
    isStaffLoggedIn
  } = useApp();

  // View state: Calendar vs Master List
  const [isAddingBooking, setIsAddingBooking] = useState(false);
  const [createdBookingMessage, setCreatedBookingMessage] = useState('');
  const [dashboardMode, setDashboardMode] = useState<'calendar' | 'list'>('calendar');

  // Selected date on calendar (default today or first booking date)
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(todayStr);
  const [showAllMonthBookings, setShowAllMonthBookings] = useState<boolean>(false);

  // Calendar month navigation
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date());

  // Search & Filter state for Master List
  const [searchTerm, setSearchTerm] = useState('');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Clickable Outstanding Balance filter toggle
  const [filterUnpaidOnly, setFilterUnpaidOnly] = useState<boolean>(false);

  // Expandable state (stores set of expanded booking IDs)
  const [expandedBookingIds, setExpandedBookingIds] = useState<Set<string>>(new Set());

  // Inline edit drafts per booking
  const [drafts, setDrafts] = useState<Record<string, BookingDraft>>({});
  const [saveSuccessMap, setSaveSuccessMap] = useState<Record<string, string>>({});

  // Modals state
  const [verifyingBooking, setVerifyingBooking] = useState<Booking | null>(null);
  const [settlingBooking, setSettlingBooking] = useState<Booking | null>(null);
  const [settleMethod, setSettleMethod] = useState('Cash');
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [verifiedAmount, setVerifiedAmount] = useState(0);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const canVerifyDeposit = (booking: Booking) => booking.status !== 'Completed' && booking.status !== 'Cancelled' &&
    (booking.paymentStatus === 'Deposit Verification Pending' || (booking.depositPaid === 0 && booking.balanceDue > 0));
  const [actionError, setActionError] = useState<string | null>(null);
  const openVerification = (booking: Booking) => {
    setPaymentError(null);
    setVerifiedAmount(booking.depositRequired);
    setVerifyingBooking(booking);
  };
  const submitVerification = async (approved: boolean) => {
    if (!verifyingBooking) return;
    try {
      await verifyDeposit(verifyingBooking.id, approved, verifiedAmount);
      setVerifyingBooking(null);
      setPaymentError(null);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Unable to record verification.');
    }
  };


  const toggleExpand = (id: string) => {
    setExpandedBookingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatAuditDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      if (dateStr.includes('T')) {
        const d = new Date(dateStr);
        return `${d.toISOString().split('T')[0]} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const getDraft = (b: Booking): BookingDraft => {
    if (drafts[b.id]) return drafts[b.id];
    const pet = b.pets[0] || {};
    return {
      customerName: b.customerName || '',
      customerContact: b.customerContact || '',
      petName: pet.petName || '',
      breed: pet.breed || '',
      characteristics: pet.characteristics || '',
      allergiesNotes: pet.allergiesNotes || '',
      assignedRoom: pet.assignedRoom || '',
      vaxExpiryDate: pet.vaxExpiryDate || '',
      depositRequired: b.depositRequired ?? 0,
      depositPaid: b.depositPaid ?? 0,
      depositMethod: b.depositMethod || 'Bank Transfer',
      finalPaid: b.finalPaid ?? 0,
      finalMethod: b.finalMethod || 'Cash',
      finalDate: b.finalDate || '',
      totalAmount: b.totalAmount ?? 0,
      notes: b.notes || '',
    };
  };

  const updateDraftField = (bookingId: string, b: Booking, field: keyof BookingDraft, value: BookingDraft[keyof BookingDraft]) => {
    const current = getDraft(b);
    setDrafts((prev) => ({
      ...prev,
      [bookingId]: {
        ...current,
        [field]: value,
      },
    }));
  };

  const handleSaveBookingDraft = async (b: Booking) => {
    const draft = getDraft(b);
    const updatedTotal = Number(draft.totalAmount) || 0;
    const updatedDepPaid = Number(draft.depositPaid) || 0;
    const updatedFinalPaid = Number(draft.finalPaid) || 0;
    const updatedTotalPaid = updatedDepPaid + updatedFinalPaid;
    const updatedBalanceDue = Math.max(0, updatedTotal - updatedTotalPaid);
    const currentModifier = role === 'boss' ? 'Boss (Allyson)' : 'Staff (Staff Team A)';
    const nowStr = new Date().toISOString();

    const updatedPets: BookingPet[] = (b.pets && b.pets.length > 0)
      ? b.pets.map((p, idx) => {
          if (idx === 0) {
            return {
              ...p,
              petName: draft.petName,
              breed: draft.breed,
              characteristics: draft.characteristics,
              allergiesNotes: draft.allergiesNotes,
              assignedRoom: draft.assignedRoom,
            };
          }
          return p;
        })
      : [
          {
            petName: draft.petName,
            breed: draft.breed,
            species: 'Dog',
            weightBracket: '< 5kg',
            characteristics: draft.characteristics,
            allergiesNotes: draft.allergiesNotes,
            assignedRoom: draft.assignedRoom,
          },
        ];

    try {
      await updateBooking(b.id, {
        customerName: draft.customerName,
        customerContact: draft.customerContact,
        pets: updatedPets,
        totalAmount: updatedTotal,
        depositRequired: Number(draft.depositRequired) || 0,
        depositPaid: updatedDepPaid,
        depositMethod: draft.depositMethod,
        finalPaid: updatedFinalPaid,
        finalMethod: draft.finalMethod,
        totalPaid: updatedTotalPaid,
        balanceDue: updatedBalanceDue,
        paymentStatus: updatedBalanceDue === 0 ? 'Paid' : updatedDepPaid > 0 ? 'Deposit Paid' : 'Outstanding',
        notes: draft.notes,
        lastModifiedBy: currentModifier,
        lastModifiedAt: nowStr,
      });

    } catch (error) {
      setSaveSuccessMap(prev => ({ ...prev, [b.id]: error instanceof Error ? error.message : 'Unable to save booking.' }));
      return;
    }

    const timeFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setSaveSuccessMap((prev) => ({
      ...prev,
      [b.id]: `Saved by ${currentModifier} at ${timeFormatted}`,
    }));

    setTimeout(() => {
      setSaveSuccessMap((prev) => {
        const copy = { ...prev };
        delete copy[b.id];
        return copy;
      });
    }, 4000);
  };

  const handleInlineStatusChange = async (bookingId: string, newStatus: string) => {
    const currentModifier = role === 'boss' ? 'Boss (Allyson)' : 'Staff (Staff Team A)';
    try {
      await updateBooking(bookingId, {
        status: newStatus,
        lastModifiedBy: currentModifier,
        lastModifiedAt: new Date().toISOString(),
      });
    setActionError(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to change booking status.');
    }
  };

  // Quick WhatsApp helpers
  const handleSendWhatsApp = async (booking: Booking, type: 'confirmation' | 'reminder') => {
    try {

    const cleanPhone = booking.customerContact.replace(/[^0-9]/g, '');
    let msg = '';
    if (type === 'confirmation') {
      msg = `Hello ${booking.customerName}! 🐾\nThis is ${systemConfig.shopName}.\n\n` +
        `Your booking *${booking.bookingReference}* for ${booking.primaryService} has been confirmed!\n` +
        `📅 Date: ${booking.checkInDate}${booking.checkOutDate ? ` to ${booking.checkOutDate}` : ''}\n` +
        `🐾 Pets: ${booking.pets.map(p => p.petName || p.species).join(', ')}\n` +
        `💰 Online Deposit: RM ${booking.depositPaid} (Received)\n` +
        `💵 Balance Due at Pick-Up: RM ${booking.balanceDue}\n\n` +
        `We look forward to welcoming your pet! Please reach out if you have any questions.`;
    } else {
      msg = `Friendly reminder from ${systemConfig.shopName}! 🐾\n\n` +
        `Hi ${booking.customerName}, your pet's appointment (*${booking.bookingReference}*) is scheduled for *${booking.checkInDate}*.\n` +
        `Remaining balance to settle at in-store pick-up is RM ${booking.balanceDue}.\nSee you soon!`;
    }

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');

    const currentModifier = role === 'boss' ? 'Boss (Allyson)' : 'Staff (Staff Team A)';
    await updateBooking(booking.id, {
      operationalAlert: 'WhatsApp Sent',
      lastModifiedBy: currentModifier,
      lastModifiedAt: new Date().toISOString(),
    });
  
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
};

  // Grooming Capacity Calculation for selected date
  const groomingBookingsToday = bookings.filter(
    (b) => b.primaryService === 'Grooming' && b.checkInDate === selectedCalendarDate && b.status !== 'Cancelled'
  );
  const totalGroomingDogsToday = groomingBookingsToday.reduce((sum, b) => sum + b.numberOfPets, 0);
  const maxGroomingSlots = systemConfig.groomingCapacity.maxDogsPerDay;

  // Calendar calculations
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentMonthDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonthDate(new Date(year, month + 1, 1));

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentMonthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  // Sort latest on top, earliest at bottom
  const sortBookingsDesc = (a: Booking, b: Booking) => {
    const dateA = a.checkInDate || a.bookingDate || '';
    const dateB = b.checkInDate || b.bookingDate || '';
    if (dateB !== dateA) return dateB.localeCompare(dateA);
    return (b.bookingDate || '').localeCompare(a.bookingDate || '');
  };

  // Bookings on selected calendar date vs all month bookings
  let calendarDisplayedBookings = bookings.filter((b) => {
    if (showAllMonthBookings) {
      return (
        (b.checkInDate && b.checkInDate.startsWith(currentMonthKey)) ||
        (b.checkOutDate && b.checkOutDate.startsWith(currentMonthKey))
      );
    }
    return (
      b.checkInDate === selectedCalendarDate ||
      (b.checkOutDate && selectedCalendarDate >= b.checkInDate && selectedCalendarDate <= b.checkOutDate)
    );
  });

  if (filterUnpaidOnly) {
    calendarDisplayedBookings = calendarDisplayedBookings.filter((b) => b.balanceDue > 0 && b.status !== 'Cancelled');
  }

  calendarDisplayedBookings.sort(sortBookingsDesc);

  // Master filtered bookings
  const filteredBookings = bookings.filter((b) => {
    const matchesSearch =
      b.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.bookingReference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.customerContact.includes(searchTerm) ||
      b.pets.some((p) => p.petName?.toLowerCase().includes(searchTerm.toLowerCase()) || p.breed?.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesService = serviceFilter === 'all' || b.primaryService === serviceFilter;
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    const matchesUnpaid = !filterUnpaidOnly || (b.balanceDue > 0 && b.status !== 'Cancelled');

    return matchesSearch && matchesService && matchesStatus && matchesUnpaid;
  });

  filteredBookings.sort(sortBookingsDesc);

  const totalOutstanding = bookings.reduce((sum, b) => sum + (b.status !== 'Cancelled' ? b.balanceDue : 0), 0);

  // Helper renderer for Expanded Details Card
  const renderExpandedCard = (b: Booking) => {
    const draft = getDraft(b);
    const saveNote = saveSuccessMap[b.id];
    const calcTotalPaid = Number(draft.depositPaid || 0) + Number(draft.finalPaid || 0);
    const calcBalance = Math.max(0, Number(draft.totalAmount || 0) - calcTotalPaid);

    return (
      <div className="bg-slate-50/70 p-5 border-t border-slate-200 text-xs space-y-4 animate-fade-in">
        {/* Top Control Bar: Discreet Date Lock Notice & Minimal Save Action */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 shadow-2xs">
          <div className="flex items-center gap-2 text-slate-600 text-xs">
            <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              Booking Dates locked: <strong className="text-slate-800">{b.checkInDate}</strong> {b.checkOutDate ? `to ${b.checkOutDate}` : ''} • Booked: <strong className="text-slate-800">{b.bookingDate}</strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            {saveNote && (
              <span className="text-emerald-700 text-xs font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                {saveNote}
              </span>
            )}
            <button
              type="button"
              onClick={() => handleSaveBookingDraft(b)}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Save className="w-3.5 h-3.5" />
              Save Changes
            </button>
          </div>
        </div>

        {/* 3 Neat Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Panel 1: Pet Details */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="flex items-center gap-1.5 text-slate-800 font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                Pet &amp; Stay
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Editable</span>
            </div>

            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Pet Name</label>
                  <input
                    type="text"
                    value={draft.petName}
                    onChange={(e) => updateDraftField(b.id, b, 'petName', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-900 font-bold text-xs focus:border-slate-400 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Breed</label>
                  <input
                    type="text"
                    value={draft.breed}
                    onChange={(e) => updateDraftField(b.id, b, 'breed', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-800 font-medium text-xs focus:border-slate-400 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Vaccine Expiry Date</label>
                <div className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-mono text-xs flex items-center justify-between">
                  <span>{draft.vaxExpiryDate || 'Not provided'}</span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 font-sans">
                    <Lock className="w-2.5 h-2.5" /> Fixed
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Assigned Room</label>
                <select
                  value={draft.assignedRoom}
                  onChange={(e) => updateDraftField(b.id, b, 'assignedRoom', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-800 text-xs focus:border-slate-400 cursor-pointer"
                >
                  <option value="">Unassigned</option>
                  {rooms.map((rm) => (
                    <option key={rm.id} value={rm.roomNumber}>
                      {rm.roomNumber} - {rm.species} ({rm.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Characteristics / Notes</label>
                <textarea
                  rows={2}
                  value={draft.characteristics}
                  onChange={(e) => updateDraftField(b.id, b, 'characteristics', e.target.value)}
                  placeholder="e.g. Timid, sensitive skin, no chicken treats"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-800 text-xs focus:border-slate-400 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Panel 2: Deposit Details */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="flex items-center gap-1.5 text-slate-800 font-bold">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                Deposit Details
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Editable</span>
            </div>

            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Deposit Required (RM)</label>
                  <input
                    type="number"
                    value={draft.depositRequired}
                    onChange={(e) => updateDraftField(b.id, b, 'depositRequired', Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-900 font-bold text-xs focus:border-slate-400 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Deposit Paid (RM)</label>
                  <input
                    type="number"
                    disabled={b.paymentStatus === 'Deposit Verification Pending'}
                    value={draft.depositPaid}
                    onChange={(e) => updateDraftField(b.id, b, 'depositPaid', Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-emerald-700 font-bold text-xs focus:border-slate-400 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Deposit Payment Method</label>
                <select
                  value={draft.depositMethod}
                  onChange={(e) => updateDraftField(b.id, b, 'depositMethod', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-800 text-xs focus:border-slate-400 cursor-pointer"
                >
                  {PAYMENT_METHODS.map((meth) => (
                    <option key={meth} value={meth}>
                      {meth}
                    </option>
                  ))}
                </select>
              </div>

              {b.depositReceiptUrl ? (
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img
                      src={b.depositReceiptUrl}
                      alt="Deposit Slip"
                      className="w-8 h-8 object-cover rounded-md border border-slate-200"
                    />
                    <span className="text-[11px] font-medium text-slate-700">Slip Attached</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openVerification(b)}
                    className="px-2.5 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-[11px] cursor-pointer"
                  >
                    View Slip
                  </button>
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-400 italic">
                  No online transfer slip attached.
                  {canVerifyDeposit(b) && <button type="button" onClick={() => openVerification(b)} className="ml-2 text-amber-800 font-bold cursor-pointer">Record shop-verified deposit</button>}
                </div>
              )}
            </div>
          </div>

          {/* Panel 3: Final Pay & Balances */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="flex items-center gap-1.5 text-slate-800 font-bold">
                <DollarSign className="w-3.5 h-3.5 text-purple-600" />
                Final Pay &amp; Settlement
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Editable</span>
            </div>

            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Total Bill (RM)</label>
                  <input
                    type="number"
                    value={draft.totalAmount}
                    onChange={(e) => updateDraftField(b.id, b, 'totalAmount', Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-900 font-bold text-xs focus:border-slate-400 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Final Paid (RM)</label>
                  <input
                    type="number"
                    value={draft.finalPaid}
                    onChange={(e) => updateDraftField(b.id, b, 'finalPaid', Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-purple-700 font-bold text-xs focus:border-slate-400 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Final Payment Method</label>
                <select
                  value={draft.finalMethod}
                  onChange={(e) => updateDraftField(b.id, b, 'finalMethod', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-800 text-xs focus:border-slate-400 cursor-pointer"
                >
                  {PAYMENT_METHODS.map((meth) => (
                    <option key={meth} value={meth}>
                      {meth}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Final Pay Date</label>
                <div className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-mono text-xs flex items-center justify-between">
                  <span>{draft.finalDate || 'Not settled yet'}</span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 font-sans">
                    <Lock className="w-2.5 h-2.5" /> Auto
                  </span>
                </div>
              </div>

              {/* Dynamic Financial Summary Bar */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">
                  Total Paid: <strong className="text-emerald-700 font-bold">RM {calcTotalPaid}</strong>
                </span>
                <span className={calcBalance > 0 ? "text-rose-600 font-bold" : "text-emerald-700 font-bold"}>
                  Balance Due: RM {calcBalance}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Client Contact & Audit Note Footer */}
        <div className="bg-white p-3 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500 font-medium flex items-center gap-1 text-[11px]">
              <User className="w-3 h-3 text-slate-400" /> Client:
            </span>
            <input
              type="text"
              value={draft.customerName}
              onChange={(e) => updateDraftField(b.id, b, 'customerName', e.target.value)}
              className="px-2 py-1 rounded-md border border-slate-200 font-bold text-slate-900 text-xs w-36 focus:border-slate-400 focus:outline-hidden"
              placeholder="Owner Name"
            />
            <input
              type="text"
              value={draft.customerContact}
              onChange={(e) => updateDraftField(b.id, b, 'customerContact', e.target.value)}
              className="px-2 py-1 rounded-md border border-slate-200 font-mono text-slate-700 text-xs w-36 focus:border-slate-400 focus:outline-hidden"
              placeholder="+60 Contact"
            />
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-slate-300" />
            <span>
              Last modified by <strong className="text-slate-600">{b.lastModifiedBy || 'System Seed'}</strong> on {b.lastModifiedAt ? formatAuditDate(b.lastModifiedAt) : b.bookingDate}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Operations &amp; Bookings Hub
            <span className="text-xs uppercase px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold">
              {role === 'boss' ? 'Boss Full Access' : 'Staff Operational Access'}
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage daily schedules, change booking statuses, expand vaccination records, and settle pick-up balances.
          </p>
        </div>

        {/* View Switcher: Calendar vs Master List */}
        <div className="flex flex-wrap items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button type="button" onClick={() => setIsAddingBooking(true)} className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-900 text-white cursor-pointer">+ Add Booking</button>
          <button
            onClick={() => setDashboardMode('calendar')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              dashboardMode === 'calendar'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            Calendar View
          </button>
          <button
            onClick={() => setDashboardMode('list')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              dashboardMode === 'list'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <List className="w-4 h-4" />
            Master All-Bookings List
          </button>
        </div>
      </div>

      {isAddingBooking && <ManualBookingModal onClose={() => setIsAddingBooking(false)} onCreated={booking => {
        setIsAddingBooking(false); setDashboardMode('list'); setSearchTerm(booking.bookingReference);
        setServiceFilter('all'); setStatusFilter('all'); setFilterUnpaidOnly(false);
        setCreatedBookingMessage(`Booking ${booking.bookingReference} added for ${booking.customerName}.`);
      }} />}
      {createdBookingMessage && <p role="status" className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-sm">{createdBookingMessage}</p>}
      {actionError && <p role="alert" className="text-sm text-rose-700">{actionError}</p>}
      {/* Overview Stat Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">Total Bookings</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{bookings.length}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-amber-700">Verification Pending</div>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {bookings.filter((b) => b.paymentStatus === 'Deposit Verification Pending').length}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-emerald-700">Grooming Slots ({selectedCalendarDate})</div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-2xl font-black text-slate-900">
              {totalGroomingDogsToday} / {maxGroomingSlots}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              totalGroomingDogsToday >= maxGroomingSlots
                ? 'bg-rose-100 text-rose-800'
                : 'bg-emerald-100 text-emerald-800'
            }`}>
              {totalGroomingDogsToday >= maxGroomingSlots ? 'Slot Full' : 'Available'}
            </span>
          </div>
        </div>

        {/* CLICKABLE OUTSTANDING BALANCE CARD */}
        <div 
          onClick={() => setFilterUnpaidOnly(!filterUnpaidOnly)}
          title="Click to view only customers who haven't paid yet!"
          className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
            filterUnpaidOnly
              ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-300 shadow-md'
              : 'bg-white border-slate-200 hover:border-rose-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Outstanding Balance</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
              filterUnpaidOnly ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-700'
            }`}>
              {filterUnpaidOnly ? 'Filtering Active' : 'Click to Filter Unpaid'}
            </span>
          </div>
          <div className="text-2xl font-black text-rose-600 mt-1">
            RM {totalOutstanding}
          </div>
        </div>
      </div>

      {filterUnpaidOnly && (
        <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-center justify-between text-xs text-rose-800">
          <span className="font-bold flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-rose-600" />
            Showing only customers with unpaid balances due.
          </span>
          <button
            onClick={() => setFilterUnpaidOnly(false)}
            className="px-2.5 py-1 bg-white border border-rose-300 hover:bg-rose-100 text-rose-700 font-bold rounded-lg cursor-pointer"
          >
            Clear Filter (Show All)
          </button>
        </div>
      )}

      {/* MODE 1: CALENDAR VIEW */}
      {dashboardMode === 'calendar' && (
        <div className="space-y-6">
          {/* Calendar Header & Month Navigation */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-amber-600" />
                  {monthNames[month]} {year}
                </h2>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {bookings.filter(b => b.checkInDate?.startsWith(currentMonthKey) || b.checkOutDate?.startsWith(currentMonthKey)).length} Bookings this Month
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={prevMonth}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
                  title="Previous Month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    const now = new Date();
                    setCurrentMonthDate(now);
                    setSelectedCalendarDate(now.toISOString().split('T')[0]);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Today ({todayStr})
                </button>
                <button
                  onClick={nextMonth}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
                  title="Next Month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="text-center text-xs font-bold text-slate-400 py-1.5 uppercase tracking-wider">
                  {d}
                </div>
              ))}

              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`blank-${i}`} className="min-h-[85px] bg-slate-50/50 rounded-xl border border-transparent" />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const dayBookings = bookings.filter(
                  (b) => b.checkInDate === dateKey || (b.checkOutDate && dateKey >= b.checkInDate && dateKey <= b.checkOutDate)
                );
                const isSelected = selectedCalendarDate === dateKey;
                const isToday = todayStr === dateKey;

                return (
                  <div
                    key={dateKey}
                    onClick={() => {
                      setSelectedCalendarDate(dateKey);
                      setShowAllMonthBookings(false);
                    }}
                    className={`min-h-[92px] p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-amber-600 bg-amber-50/80 ring-2 ring-amber-400/40 shadow-xs'
                        : isToday
                        ? 'border-blue-400 bg-blue-50/40 shadow-2xs'
                        : dayBookings.length > 0
                        ? 'border-slate-200 bg-white hover:border-amber-300'
                        : 'border-slate-100 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${
                        isSelected 
                          ? 'text-amber-900 font-black' 
                          : isToday 
                          ? 'text-blue-700 font-black' 
                          : 'text-slate-700'
                      }`}>
                        {dayNum} {isToday && <span className="text-[9px] font-bold text-blue-600 font-mono">Today</span>}
                      </span>
                      {dayBookings.length > 0 && (
                        <span className="text-[10px] bg-amber-200/90 text-amber-900 font-extrabold px-1.5 py-0.2 rounded-full">
                          {dayBookings.length}
                        </span>
                      )}
                    </div>

                    {/* Booking Badges per Day */}
                    <div className="space-y-1 mt-1">
                      {dayBookings.slice(0, 2).map((b) => {
                        const petText = b.pets[0]?.petName || b.customerName;
                        const serviceColor = 
                          b.primaryService === 'Boarding' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                          b.primaryService === 'Grooming' ? 'bg-purple-50 text-purple-800 border-purple-200' :
                          b.primaryService === 'Day Care' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                          'bg-emerald-50 text-emerald-800 border-emerald-200';

                        return (
                          <div
                            key={b.id}
                            title={`${b.customerName} - ${b.primaryService} (${b.status})`}
                            className={`text-[9px] truncate px-1.5 py-0.5 rounded-md font-bold border ${serviceColor}`}
                          >
                            {petText}: {b.primaryService}
                          </div>
                        );
                      })}
                      {dayBookings.length > 2 && (
                        <div className="text-[9px] text-slate-500 font-bold pl-1">
                          +{dayBookings.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily Scheduled Customer Listing Below Calendar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-600" />
                  {showAllMonthBookings 
                    ? `All Bookings for ${monthNames[month]} ${year}` 
                    : `Scheduled Customer Listing for ${selectedCalendarDate}`}
                </h3>
                <p className="text-xs text-slate-500">
                  {calendarDisplayedBookings.length} bookings listed. Expand to view and edit pet details, deposit and final payment.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAllMonthBookings(!showAllMonthBookings)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${
                    showAllMonthBookings
                      ? 'bg-amber-600 text-white border-amber-700'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {showAllMonthBookings ? 'Viewing All Month' : 'Show All Month Bookings'}
                </button>

                <div className="text-xs bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 text-amber-900 font-medium">
                  Grooming Load: <strong>{totalGroomingDogsToday} / {maxGroomingSlots} dogs</strong>
                </div>
              </div>
            </div>

            {calendarDisplayedBookings.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No bookings scheduled for this date. Select another day with a count badge or click "Show All Month Bookings".
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-2 w-8 text-center"></th>
                      <th className="py-3 px-3">Date &amp; Ref</th>
                      <th className="py-3 px-3">Owner &amp; Contact</th>
                      <th className="py-3 px-3">Pet (Name) &amp; Breed</th>
                      <th className="py-3 px-3">Service</th>
                      <th className="py-3 px-3">In &amp; Out Date</th>
                      <th className="py-3 px-3">Total (RM)</th>
                      <th className="py-3 px-3">Paid &amp; Last Updated</th>
                      <th className="py-3 px-3">Balance (RM)</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {calendarDisplayedBookings.map((b) => {
                      const isExpanded = expandedBookingIds.has(b.id);
                      return (
                        <React.Fragment key={b.id}>
                          <tr className="hover:bg-amber-50/30 transition-colors">
                            <td className="py-3 px-2 text-center">
                              <button
                                onClick={() => toggleExpand(b.id)}
                                className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 cursor-pointer"
                                title={isExpanded ? 'Collapse' : 'Expand'}
                              >
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            </td>

                            {/* 1. Date & Ref */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <div className="font-mono font-bold text-amber-800">{b.bookingReference}</div>
                              <div className="text-[10px] text-slate-500 font-medium">Booked: {b.bookingDate}</div>
                            </td>

                            {/* 2. Owner & Contact (clickable WhatsApp) */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <div className="font-bold text-slate-900">{b.customerName}</div>
                              <a
                                href={`https://wa.me/${b.customerContact.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 font-mono font-medium"
                                title="Chat on WhatsApp"
                              >
                                <Phone className="w-2.5 h-2.5 text-emerald-600" />
                                {b.customerContact}
                              </a>
                            </td>

                            {/* 3. Pet (Name) & Breed */}
                            <td className="py-3 px-3 whitespace-nowrap text-slate-700">
                              <div className="font-bold text-slate-900">
                                {b.pets.map(p => p.petName || 'Unnamed').join(', ')}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {b.pets.map(p => p.breed || p.species).join(', ')}
                              </div>
                            </td>

                            {/* 4. Service */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className="font-semibold text-slate-800 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                                {b.primaryService}
                              </span>
                              {b.petSittingBreakdown && (
                                <div
                                  className="text-[10px] text-amber-800 font-medium mt-1 max-w-[140px] truncate"
                                  title={b.petSittingBreakdown.summaryText}
                                >
                                  {b.petSittingBreakdown.summaryText}
                                </div>
                              )}
                            </td>

                            {/* 5. In and Out Date */}
                            <td className="py-3 px-3 whitespace-nowrap text-slate-700">
                              <div>In: <strong>{b.checkInDate}</strong></div>
                              {b.checkOutDate ? (
                                <div className="text-slate-500 text-[11px]">Out: {b.checkOutDate}</div>
                              ) : (
                                <div className="text-slate-400 text-[10px]">{b.checkInTime || '-'}</div>
                              )}
                            </td>

                            {/* 6. Total Amount */}
                            <td className="py-3 px-3 whitespace-nowrap font-black text-slate-900">
                              RM {b.totalAmount}
                            </td>

                            {/* 7. Paid & Last Updated Date */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <div className="font-bold text-emerald-700">RM {b.totalPaid}</div>
                              <div className="text-[10px] text-slate-400 truncate max-w-[110px]" title={b.lastModifiedAt || b.bookingDate}>
                                {b.lastModifiedAt ? formatAuditDate(b.lastModifiedAt) : b.bookingDate}
                              </div>
                            </td>

                            {/* 8. Balance Due */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className={b.balanceDue > 0 ? "font-black text-rose-600" : "font-bold text-emerald-700"}>
                                RM {b.balanceDue}
                              </span>
                            </td>

                            {/* 9. Status (Direct dropdown) */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <select
                                value={b.status}
                                onChange={(e) => handleInlineStatusChange(b.id, e.target.value)}
                                className="text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-300 bg-white cursor-pointer focus:border-amber-600"
                              >
                                {ALL_STATUSES.map((st) => (
                                  <option key={st} value={st}>
                                    {st}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* 10. Actions */}
                            <td className="py-3 px-3 whitespace-nowrap text-right space-x-1">
                              <button
                                onClick={() => handleSendWhatsApp(b, 'confirmation')}
                                title="Send WhatsApp confirmation"
                                className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 cursor-pointer"
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </button>

                              {canVerifyDeposit(b) && (
                                <button
                                  onClick={() => openVerification(b)}
                                  title="Verify Deposit Slip"
                                  className="p-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {b.balanceDue > 0 && (
                                <button
                                  onClick={() => {
                                    setPaymentError(null);
                                setSettleMethod('Cash');
                                setSettlingBooking(b);
                                    setSettleAmount(b.balanceDue);
                                  }}
                                  title="Settle In-Store Balance"
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white cursor-pointer"
                                >
                                  <DollarSign className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                onClick={() => onOpenInvoiceModal(b, 'invoice')}
                                title="View Official Invoice / Receipt"
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>

                          {/* Expanded Card Row */}
                          {isExpanded && (
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <td colSpan={11} className="p-0">
                                {renderExpandedCard(b)}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODE 2: MASTER ALL-BOOKINGS LIST VIEW */}
      {dashboardMode === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          {/* Search & Filters Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search owner, pet, reference..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:border-amber-600 focus:outline-hidden"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium"
              >
                <option value="all">All Services</option>
                <option value="Boarding">Boarding</option>
                <option value="Grooming">Grooming</option>
                <option value="Pet Sitting">Pet Sitting</option>
                <option value="Day Care">Day Care</option>
                <option value="Pet Taxi">Pet Taxi</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium"
              >
                <option value="all">All Statuses</option>
                {ALL_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Master Table with 10 Columns */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-2 w-8 text-center"></th>
                  <th className="py-3 px-3">Date &amp; Ref</th>
                  <th className="py-3 px-3">Owner &amp; Contact</th>
                  <th className="py-3 px-3">Pet (Name) &amp; Breed</th>
                  <th className="py-3 px-3">Service</th>
                  <th className="py-3 px-3">In &amp; Out Date</th>
                  <th className="py-3 px-3">Total (RM)</th>
                  <th className="py-3 px-3">Paid &amp; Last Updated</th>
                  <th className="py-3 px-3">Balance (RM)</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBookings.map((b) => {
                  const isExpanded = expandedBookingIds.has(b.id);
                  return (
                    <React.Fragment key={b.id}>
                      <tr className="hover:bg-amber-50/30 transition-colors">
                        <td className="py-3 px-2 text-center">
                          <button
                            onClick={() => toggleExpand(b.id)}
                            className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 cursor-pointer"
                            title={isExpanded ? 'Collapse' : 'Expand'}
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </td>

                        {/* 1. Date & Ref */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-mono font-bold text-amber-800">{b.bookingReference}</div>
                          <div className="text-[10px] text-slate-500 font-medium">Booked: {b.bookingDate}</div>
                        </td>

                        {/* 2. Owner & Contact (clickable WhatsApp) */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-bold text-slate-900">{b.customerName}</div>
                          <a
                            href={`https://wa.me/${b.customerContact.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 font-mono font-medium"
                            title="Chat on WhatsApp"
                          >
                            <Phone className="w-2.5 h-2.5 text-emerald-600" />
                            {b.customerContact}
                          </a>
                        </td>

                        {/* 3. Pet (Name) & Breed */}
                        <td className="py-3 px-3 whitespace-nowrap text-slate-700">
                          <div className="font-bold text-slate-900">
                            {b.pets.map(p => p.petName || 'Unnamed').join(', ')}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {b.pets.map(p => p.breed || p.species).join(', ')}
                          </div>
                        </td>

                        {/* 4. Service */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="font-semibold text-slate-800 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                            {b.primaryService}
                          </span>
                        </td>

                        {/* 5. In and Out Date */}
                        <td className="py-3 px-3 whitespace-nowrap text-slate-700">
                          <div>In: <strong>{b.checkInDate}</strong></div>
                          {b.checkOutDate ? (
                            <div className="text-slate-500 text-[11px]">Out: {b.checkOutDate}</div>
                          ) : (
                            <div className="text-slate-400 text-[10px]">{b.checkInTime || '-'}</div>
                          )}
                        </td>

                        {/* 6. Total Amount */}
                        <td className="py-3 px-3 whitespace-nowrap font-black text-slate-900">
                          RM {b.totalAmount}
                        </td>

                        {/* 7. Paid & Last Updated Date */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-bold text-emerald-700">RM {b.totalPaid}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[110px]" title={b.lastModifiedAt || b.bookingDate}>
                            {b.lastModifiedAt ? formatAuditDate(b.lastModifiedAt) : b.bookingDate}
                          </div>
                        </td>

                        {/* 8. Balance Due */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={b.balanceDue > 0 ? "font-black text-rose-600" : "font-bold text-emerald-700"}>
                            RM {b.balanceDue}
                          </span>
                        </td>

                        {/* 9. Status (Direct dropdown) */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <select
                            value={b.status}
                            onChange={(e) => handleInlineStatusChange(b.id, e.target.value)}
                            className="text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-300 bg-white cursor-pointer focus:border-amber-600"
                          >
                            {ALL_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* 10. Actions */}
                        <td className="py-3 px-3 whitespace-nowrap text-right space-x-1">
                          <button
                            onClick={() => handleSendWhatsApp(b, 'confirmation')}
                            title="Send WhatsApp confirmation"
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 cursor-pointer"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </button>

                          {canVerifyDeposit(b) && (
                            <button
                              onClick={() => openVerification(b)}
                              title="Verify Deposit Slip"
                              className="p-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {b.balanceDue > 0 && (
                            <button
                              onClick={() => {
                                setPaymentError(null);
                                setSettleMethod('Cash');
                                setSettlingBooking(b);
                                setSettleAmount(b.balanceDue);
                              }}
                              title="Settle In-Store Balance"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white cursor-pointer"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => onOpenInvoiceModal(b, 'invoice')}
                            title="View Official Invoice / Receipt"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>

                          {role === 'boss' && (
                            <button
                              onClick={async () => {
    try {

                                if (confirm(`Delete booking ${b.bookingReference}?`)) {
                                  await deleteBooking(b.id);
                                }
                              
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
}}
                              title="Delete Booking (Boss only)"
                              className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Card Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <td colSpan={11} className="p-0">
                            {renderExpandedCard(b)}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: VERIFY DEPOSIT SLIP */}
      {verifyingBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Eye className="w-5 h-5 text-amber-600" />
              Verify Bank Transfer Slip
            </h3>
            <p className="text-xs text-slate-500">
              Booking Ref: <strong>{verifyingBooking.bookingReference}</strong> • {verifyingBooking.customerName}
            </p>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div>Total Amount: <strong>RM {verifyingBooking.totalAmount}</strong></div>
              <div>Required Deposit: <strong>RM {verifyingBooking.depositRequired}</strong></div>
              <label className="block pt-2 font-bold">Amount confirmed received by the shop (RM)
                <input type="number" min="0.01" step="0.01" max={verifyingBooking.totalAmount - verifyingBooking.finalPaid}
                  value={verifiedAmount} onChange={e => setVerifiedAmount(Number(e.target.value))}
                  className="block w-full mt-1 p-2 border border-slate-300 rounded-lg" />
              </label>
              <p>Check the shop bank account and customer details before approving. An uploaded slip alone is not confirmation.</p>
            </div>

            <div className="border border-slate-200 rounded-xl p-2 bg-slate-100 text-center max-h-64 overflow-y-auto">
              {verifyingBooking.depositReceiptUrl ? (
                verifyingBooking.depositReceiptUrl.startsWith('data:application/pdf') ? (
                  <a href={verifyingBooking.depositReceiptUrl} target="_blank" rel="noopener noreferrer" className="text-amber-800 underline">Open uploaded PDF proof</a>
                ) : <img src={verifyingBooking.depositReceiptUrl} alt="Customer Transfer Proof" className="max-h-60 mx-auto rounded-lg" />
              ) : <p className="py-4 text-xs">No proof attached. Contact the customer and confirm the payment in the shop bank account.</p>}
            </div>
            {paymentError && <p role="alert" className="text-sm text-rose-700">{paymentError}</p>}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setVerifyingBooking(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => submitVerification(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-100 text-rose-700 hover:bg-rose-200 cursor-pointer"
              >
                Reject Proof
              </button>
              <button
                onClick={() => submitVerification(true)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer flex items-center gap-1"
              >
                <CheckCircle2 className="w-4 h-4" />
                Approve &amp; Issue R01
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SETTLE PICK-UP BALANCE IN STORE */}
      {settlingBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              Settle Pick-Up Balance In-Store
            </h3>
            <p className="text-xs text-slate-500">
              Customer: <strong>{settlingBooking.customerName}</strong> ({settlingBooking.bookingReference})
            </p>

            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs">
              <div className="text-amber-800 font-medium">Outstanding Balance Due:</div>
              <div className="text-2xl font-black text-amber-900 mt-1">RM {settlingBooking.balanceDue}</div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={settleMethod}
                  onChange={(e) => setSettleMethod(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                >
                  <option value="Cash">Cash (In-Store)</option>
                  <option value="DuitNow QR">DuitNow QR / E-Wallet</option>
                  <option value="Bank Transfer">Bank Transfer (Maybank)</option>
                  <option value="Credit Card">Credit / Debit Card</option>
                  {canManageCredit(role, isBossLoggedIn, isStaffLoggedIn, systemConfig.staffCanManageCredit) && <option value="Store Credit">Shop-approved Store Credit Redemption</option>}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Amount Paid (RM)</label>
                <input
                  type="number"
                  min="0.01" step="0.01" max={settlingBooking.balanceDue}
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold text-slate-900"
                />
              </div>
            </div>

            {settleMethod === 'Store Credit' && <p className="text-xs text-slate-600">Record this only after the customer contacts the shop and an authorised shop user approves using the recorded credit. No money transfer occurs here.</p>}
            {paymentError && <p role="alert" className="text-sm text-rose-700">{paymentError}</p>}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setSettlingBooking(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    if (settleMethod === 'Store Credit') {
                      if (!await applyStoreCreditToBooking(settlingBooking.id, settleAmount)) {
                        throw new Error('Customer credit record not found or insufficient credit.');
                      }
                    } else {
                      await settlePickupBalance(settlingBooking.id, settleMethod, settleAmount);
                    }
                    setSettlingBooking(null);
                    setPaymentError(null);
                  } catch (error) {
                    setPaymentError(error instanceof Error ? error.message : 'Unable to record settlement.');
                  }
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-black text-white shadow-xs cursor-pointer"
              >
                Confirm Settlement &amp; Generate R02
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
