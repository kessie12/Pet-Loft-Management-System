import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { CustomerBookingPortal } from './components/CustomerBookingPortal';
import { MyBookingLookup } from './components/MyBookingLookup';
import { DualDashboard } from './components/DualDashboard';
import { RoomInventoryView } from './components/RoomInventoryView';
import { CustomerDirectoryView } from './components/CustomerDirectoryView';
import { StoreCreditWalletView } from './components/StoreCreditWalletView';
import { BossSettingsView } from './components/BossSettingsView';
import { InvoiceReceiptModal } from './components/InvoiceReceiptModal';
import { Booking } from './types';
import { DataConnectionStatus } from './components/DataConnectionStatus';
import { PawPrint, Lock, KeyRound, AlertCircle } from 'lucide-react';

const AppContent: React.FC = () => {
  const { 
    systemConfig, dataStatus, dataMode,
    setRole, 
    isStaffLoggedIn, 
    isBossLoggedIn, 
    loginStaff, 
    loginBoss 
  } = useApp();

  // URL / Route state: 'customer' | 'staff' | 'boss'
  const [portal, setPortal] = useState<'customer' | 'staff' | 'boss'>('customer');
  const [currentTab, setCurrentTab] = useState<string>('book');

  // Login form state
  const [staffUsername, setStaffUsername] = useState('staff');
  const [staffPin, setStaffPin] = useState('');
  const [bossUsername, setBossUsername] = useState('admin');
  const [bossPassword, setBossPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Modal State for Invoice / Receipt
  const [invoiceModalBooking, setInvoiceModalBooking] = useState<Booking | null>(null);
  const [invoiceModalType, setInvoiceModalType] = useState<'invoice' | 'depositReceipt' | 'finalReceipt'>('invoice');

  // Detect URL Hash on mount & hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('boss')) {
        setPortal('boss');
        setRole('boss');
        setCurrentTab('dashboard');
      } else if (hash.includes('staff')) {
        setPortal('staff');
        setRole('staff');
        setCurrentTab('dashboard');
      } else {
        setPortal('customer');
        setRole('customer');
        setCurrentTab('book');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [setRole]);

  const handleNavigatePortal = (newPortal: 'customer' | 'staff' | 'boss') => {
    window.location.hash = `#${newPortal}`;
    setPortal(newPortal);
    setRole(newPortal);
    setCurrentTab(newPortal === 'customer' ? 'book' : 'dashboard');
    setLoginError(null);
  };

  const handleOpenInvoiceModal = (booking: Booking, type: 'invoice' | 'depositReceipt' | 'finalReceipt') => {
    setInvoiceModalBooking(booking);
    setInvoiceModalType(type);
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const ok = await loginStaff(staffUsername, staffPin);
    if (!ok) {
      setLoginError('Unable to sign in. Check your username, password and the connection message above.');
    } else {
      setStaffPin('');
    }
  };

  const handleBossLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const ok = await loginBoss(bossUsername, bossPassword);
    if (!ok) {
      setLoginError('Unable to sign in. Check your username, password and the connection message above.');
    } else {
      setBossPassword('');
    }
  };

  const cleanStorePhone = systemConfig.phone.replace(/[^0-9]/g, '');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      <DataConnectionStatus />
      <fieldset disabled={dataStatus==='saving'} className="contents">
      <Navbar 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab} 
        portal={portal}
        onNavigatePortal={handleNavigatePortal}
      />

      <main className="flex-1 pb-16">
        {/* CUSTOMER PORTAL (Public, No Login) */}
        {portal === 'customer' && (
          <>
            {currentTab === 'book' && <CustomerBookingPortal />}
            {currentTab === 'my-booking' && <MyBookingLookup />}
          </>
        )}

        {/* STAFF PORTAL (Login Required) */}
        {portal === 'staff' && (
          !isStaffLoggedIn ? (
            <div className="max-w-md mx-auto my-16 px-4">
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl text-center">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-black text-slate-900">Staff Portal Login</h2>
                <p className="text-xs text-slate-500 mt-1 mb-6">
                  Enter your staff username and password to access daily bookings.
                </p>

                {loginError && (
                  <div className="mb-4 p-3 bg-rose-50 text-rose-700 text-xs rounded-xl flex items-center gap-2 border border-rose-200 text-left">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <form onSubmit={handleStaffLogin} className="space-y-4">
                  <div className="text-left">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Staff Username</label>
                    <input
                      type="text"
                      autoFocus
                      placeholder="Your staff username"
                      value={staffUsername}
                      onChange={(e) => setStaffUsername(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm font-semibold rounded-xl border border-slate-300 focus:border-blue-600 focus:outline-hidden"
                    />
                  </div>
                  <div className="text-left">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Staff Password</label>
                    <input
                      type="password"
                      placeholder={dataMode==='demo'?'Demo PIN: 1234':'Your account password'}
                      value={staffPin}
                      onChange={(e) => setStaffPin(e.target.value)}
                      className="w-full px-4 py-2.5 text-center tracking-widest text-base font-mono rounded-xl border border-slate-300 focus:border-blue-600 focus:outline-hidden"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer shadow-xs"
                  >
                    Enter Staff Portal
                  </button>
                </form>

                <div className="mt-6 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => handleNavigatePortal('customer')}
                    className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Return to Customer Booking
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {currentTab === 'dashboard' && (
                <DualDashboard onOpenInvoiceModal={handleOpenInvoiceModal} />
              )}
              {currentTab === 'rooms' && <RoomInventoryView />}
              {currentTab === 'customers' && <CustomerDirectoryView onOpenInvoiceModal={handleOpenInvoiceModal} />}
              {currentTab === 'credits' && <StoreCreditWalletView />}
            </>
          )
        )}

        {/* BOSS PORTAL (Login Required) */}
        {portal === 'boss' && (
          !isBossLoggedIn ? (
            <div className="max-w-md mx-auto my-16 px-4">
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl text-center">
                <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
                  <KeyRound className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-black text-slate-900">Boss Master Login</h2>
                <p className="text-xs text-slate-500 mt-1 mb-6">
                  Authorized access for Allyson &amp; Anson only.
                </p>

                {loginError && (
                  <div className="mb-4 p-3 bg-rose-50 text-rose-700 text-xs rounded-xl flex items-center gap-2 border border-rose-200 text-left">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <form onSubmit={handleBossLogin} className="space-y-4">
                  <div className="text-left">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Boss Username</label>
                    <input
                      type="text"
                      autoFocus
                      placeholder="Your boss username"
                      value={bossUsername}
                      onChange={(e) => setBossUsername(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm font-semibold rounded-xl border border-slate-300 focus:border-amber-600 focus:outline-hidden"
                    />
                  </div>
                  <div className="text-left">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Boss Master Password</label>
                    <input
                      type="password"
                      placeholder={dataMode==='demo'?'Demo password: admin':'Your boss password'}
                      value={bossPassword}
                      onChange={(e) => setBossPassword(e.target.value)}
                      className="w-full px-4 py-2.5 text-center text-sm font-semibold rounded-xl border border-slate-300 focus:border-amber-600 focus:outline-hidden"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer shadow-xs"
                  >
                    Enter Boss Dashboard
                  </button>
                </form>

                <div className="mt-6 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => handleNavigatePortal('customer')}
                    className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Return to Customer Booking
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {currentTab === 'dashboard' && (
                <DualDashboard onOpenInvoiceModal={handleOpenInvoiceModal} />
              )}
              {currentTab === 'rooms' && <RoomInventoryView />}
              {currentTab === 'customers' && <CustomerDirectoryView onOpenInvoiceModal={handleOpenInvoiceModal} />}
              {currentTab === 'credits' && <StoreCreditWalletView />}
              {currentTab === 'settings' && <BossSettingsView />}
            </>
          )
        )}
      </main>

      {/* Footer formatted according to exact specifications:
          1. Logo matches uploaded custom logo
          2. SSM and Address separated into 2 distinct lines
          3. WhatsApp formatted as clickable link
          4. WhatsApp and Email separated into 2 distinct lines
          5. All rights reserved placed at bottom middle */}
      <footer className="no-print bg-slate-950 text-slate-400 py-10 px-4 border-t border-slate-900 text-xs">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            {/* Left Column: Logo, Shop Name, SSM line, Address line */}
            <div className="flex items-start sm:items-center gap-3">
              {systemConfig.logoUrl ? (
                <img 
                  src={systemConfig.logoUrl} 
                  alt="Pet Loft Logo" 
                  className="w-10 h-10 rounded-xl object-cover shadow-xs shrink-0" 
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                  <PawPrint className="w-5 h-5" />
                </div>
              )}
              <div className="space-y-1">
                <span className="font-bold text-white text-base">Pet Loft</span>
                <p className="text-[11px] text-slate-400 leading-tight">
                  SSM: {systemConfig.ssmNumber}
                </p>
                <p className="text-[11px] text-slate-400 leading-tight">
                  {systemConfig.address}
                </p>
              </div>
            </div>

            {/* Right Column: WhatsApp link (Line 1) and Email (Line 2) */}
            <div className="text-left md:text-right space-y-1 text-[11px] text-slate-400">
              <div>
                WhatsApp:{' '}
                <a 
                  href={`https://wa.me/${cleanStorePhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white hover:text-emerald-400 font-mono font-bold underline transition-colors"
                >
                  {systemConfig.phone}
                </a>
              </div>
              <div>
                Email: <strong className="text-white">{systemConfig.email}</strong>
              </div>
            </div>
          </div>

          {/* Bottom Middle: All rights reserved */}
          <div className="mt-8 pt-6 border-t border-slate-900 text-center text-[11px] text-slate-500">
            &copy; {new Date().getFullYear()} Pet Loft Concept Store. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Invoice & Receipt Modal */}
      {invoiceModalBooking && (
        <InvoiceReceiptModal
          booking={invoiceModalBooking}
          initialType={invoiceModalType}
          onClose={() => setInvoiceModalBooking(null)}
        />
      )}
      </fieldset>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
