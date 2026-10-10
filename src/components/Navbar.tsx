import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  PawPrint, 
  Calendar, 
  Users, 
  Home, 
  Settings, 
  LogOut,
  PlusCircle,
  FileText,
  FileSpreadsheet,
  ExternalLink
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  portal: 'customer' | 'staff' | 'boss';
  onNavigatePortal: (portal: 'customer' | 'staff' | 'boss') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  currentTab, 
  setCurrentTab, 
  portal, 
  onNavigatePortal 
}) => {
  const { systemConfig, logout } = useApp();

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-amber-100 shadow-xs">
      {/* Main Navigation Bar (Top orange-brown bar is completely removed) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand: Pet Loft */}
          <div 
            onClick={() => {
              if (portal === 'customer') setCurrentTab('book');
              else setCurrentTab('dashboard');
            }}
            className="flex items-center gap-3 cursor-pointer group"
          >
            {systemConfig.logoUrl ? (
              <img 
                src={systemConfig.logoUrl} 
                alt="Pet Loft Logo" 
                className="w-10 h-10 rounded-xl object-cover shadow-sm group-hover:scale-105 transition-transform" 
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                <PawPrint className="w-6 h-6" />
              </div>
            )}
            
            <div>
              <div className="font-extrabold text-slate-900 tracking-tight text-lg leading-tight flex items-center gap-2">
                <span>Pet Loft</span>
                {portal !== 'customer' && (
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    portal === 'boss' ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'
                  }`}>
                    {portal === 'boss' ? 'Boss Admin' : 'Staff Portal'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Boarding • Grooming • Pet Care</p>
            </div>
          </div>

          {/* Navigation Links based on portal */}
          <nav className="flex items-center gap-1 sm:gap-2">
            {portal === 'customer' ? (
              <>
                <button
                  onClick={() => setCurrentTab('book')}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    currentTab === 'book'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-amber-50 hover:text-amber-900'
                  }`}
                >
                  <PlusCircle className="w-4 h-4" />
                  Book A Slot
                </button>
                <button
                  onClick={() => setCurrentTab('my-booking')}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    currentTab === 'my-booking'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-amber-50 hover:text-amber-900'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Track Booking Status
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setCurrentTab('dashboard')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    currentTab === 'dashboard'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-amber-50 hover:text-amber-900'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  Dashboard
                </button>

                <button
                  onClick={() => setCurrentTab('rooms')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    currentTab === 'rooms'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-amber-50 hover:text-amber-900'
                  }`}
                >
                  <Home className="w-4 h-4" />
                  Rooms
                </button>

                <button
                  onClick={() => setCurrentTab('customers')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    currentTab === 'customers'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-amber-50 hover:text-amber-900'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Customers & Pets
                </button>

                {portal === 'boss' && (
                  <button
                    onClick={() => setCurrentTab('settings')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      currentTab === 'settings'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-amber-50 hover:text-amber-900'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    Boss Settings
                  </button>
                )}

                {/* Direct Google Sheet Shortcut (Method 3: Zero Apps Script) */}
                {systemConfig.directGoogleSheetUrl && (
                  <a
                    href={systemConfig.directGoogleSheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open official Google Sheet in new tab"
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="hidden md:inline">Google Sheet</span>
                    <ExternalLink className="w-3 h-3 text-emerald-600" />
                  </a>
                )}

                {/* Logout Button */}
                <button
                  onClick={() => {
                    logout();
                    if (portal === 'boss') {
                      onNavigatePortal('boss');
                    } else if (portal === 'staff') {
                      onNavigatePortal('staff');
                    } else {
                      onNavigatePortal('customer');
                    }
                  }}
                  title="Sign out of portal"
                  className="ml-2 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-600 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out</span>
                </button>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};
