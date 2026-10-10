import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { PhysicalKennelSettings } from './PhysicalKennelSettings';
import { StaffAccountSettings } from './StaffAccountSettings';
import { GroomingPriceSettings } from './GroomingPriceSettings';
import { ReceiptFormatSettings } from './ReceiptFormatSettings';
import { SheetConnectionSettings } from './SheetConnectionSettings';
import { 
  WeightBracket, 
  RoomAssignmentRule, 
  CustomerBoardingRoom, 
  SpeciesType, 
  PetSittingConfig,
  DayCareConfig,
  PetTaxiConfig
} from '../types';
import { 
  defaultCustomerBoardingRooms, 
  defaultPetSittingConfig,
  defaultDayCareConfig,
  defaultPetTaxiConfig
} from '../data/seedData';
import { 
  ShieldCheck, 
  CheckCircle2, 
  Trash2, 
  Clock, 
  Home, 
  Image as ImageIcon, 
  ArrowUp, 
  ArrowDown, 
  Edit3, 
  KeyRound, 
  FileSpreadsheet, 
  Save, 
  ToggleLeft, 
  ToggleRight, 
  X, 
  CreditCard, 
  Plus,
  RotateCcw,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronUp,
  HeartHandshake,
  Car,
  Scissors
} from 'lucide-react';

type SettingsTab = 'boarding' | 'grooming' | 'daycare' | 'sitting' | 'taxi' | 'rooms' | 'form' | 'deposit' | 'staff' | 'shop' | 'backup' | 'kennels' | 'receipts';

const settingsCategories: { id: string; label: string; description: string; icon: typeof Home; tabs: { id: SettingsTab; label: string }[] }[] = [
  { id: 'services', label: 'Service Settings', description: 'Pricing, packages & schedules', icon: Scissors, tabs: [
    { id: 'boarding', label: 'Boarding Rooms' }, { id: 'grooming', label: 'Grooming' },
    { id: 'daycare', label: 'Day Care' }, { id: 'sitting', label: 'Pet Sitting' }, { id: 'taxi', label: 'Pet Taxi' },
  ] },
  { id: 'operations', label: 'Operations', description: 'Room allocation & booking rules', icon: LayoutGrid, tabs: [
    { id: 'rooms', label: 'Auto-Room Rules' }, { id: 'kennels', label: 'Physical Kennels' }, { id: 'form', label: 'Booking Form Rules' },
  ] },
  { id: 'administration', label: 'Administration', description: 'Staff access & shop details', icon: ShieldCheck, tabs: [
    { id: 'staff', label: 'Staff & Credentials' }, { id: 'shop', label: 'Shop & Bank Profile' },
  ] },
  { id: 'finance', label: 'Finance', description: 'Deposits & payment records', icon: CreditCard, tabs: [
    { id: 'deposit', label: 'Deposit & Payment' }, { id: 'receipts', label: 'Receipt Format' },
  ] },
  { id: 'backup', label: 'Backup & Data', description: 'Shared records & connection', icon: FileSpreadsheet, tabs: [
    { id: 'backup', label: 'Spreadsheet & Backups' },
  ] },
];

export const BossSettingsView: React.FC = () => {
  const { 
    systemConfig: savedSystemConfig,
    updateSystemConfig: persistSystemConfig,
    dataMode,
    saveCredentials,
    rooms, 
    addRoomAssignmentRule,
    updateRoomAssignmentRule,
    deleteRoomAssignmentRule,
    moveRoomAssignmentRule,
    resetCustomerBoardingRooms,
    getCalculatedTimeSlots,
  } = useApp();

  const [systemConfig, setDraftConfig] = useState(savedSystemConfig);
  const pendingSettings = useRef<Partial<typeof savedSystemConfig>>({});
  const [hasPendingSettings, setHasPendingSettings] = useState(false);
  useEffect(() => setDraftConfig({...savedSystemConfig,...pendingSettings.current}), [savedSystemConfig]);
  const updateSystemConfig = async (updates:Partial<typeof savedSystemConfig>) => {
    pendingSettings.current = {...pendingSettings.current,...updates};
    setDraftConfig(current => ({...current,...updates}));
    setHasPendingSettings(true);
  };
  const [activeTab, setActiveTab] = useState<SettingsTab>('boarding');
  const activeCategory = settingsCategories.find((category) => category.tabs.some((tab) => tab.id === activeTab))!;
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Day Care Pricing Config State
  const [dayCareConfig, setDayCareConfig] = useState<DayCareConfig>(
    systemConfig.dayCareConfig || defaultDayCareConfig
  );
  const [dayCareViewMode, setDayCareViewMode] = useState<'cards' | 'list'>('list');

  useEffect(() => {
    if (systemConfig.dayCareConfig) {
      setDayCareConfig(systemConfig.dayCareConfig);
    }
  }, [systemConfig.dayCareConfig]);

  const handleSaveDayCareConfig = async () => {
    try {

    await updateSystemConfig({ dayCareConfig });
    triggerSaved('Day Care pricing & plans saved successfully!');
  
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
};

  const handleResetDayCareConfig = async () => {
    try {

    if (confirm('Reset Day Care pricing to default presets?')) {
      setDayCareConfig(defaultDayCareConfig);
      await updateSystemConfig({ dayCareConfig: defaultDayCareConfig });
      triggerSaved('Day Care pricing reset to defaults!');
    }
  
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
};

  const handleEditDayCareTier = (index: number, field: 'dailyRate' | 'monthlyRate', val: number) => {
    setDayCareConfig((prev) => {
      const updatedTiers = [...prev.tiers];
      updatedTiers[index] = { ...updatedTiers[index], [field]: Math.max(0, val) };
      return { ...prev, tiers: updatedTiers };
    });
  };

  // Pet Taxi Pricing Config State
  const [taxiConfig, setTaxiConfig] = useState<PetTaxiConfig>(
    systemConfig.petTaxiConfig || defaultPetTaxiConfig
  );
  const [taxiViewMode, setTaxiViewMode] = useState<'cards' | 'list'>('list');

  useEffect(() => {
    if (systemConfig.petTaxiConfig) {
      setTaxiConfig(systemConfig.petTaxiConfig);
    }
  }, [systemConfig.petTaxiConfig]);

  const handleSaveTaxiConfig = async () => {
    try {

    await updateSystemConfig({ petTaxiConfig: taxiConfig });
    triggerSaved('Pet Taxi rates and fuel charge saved successfully!');
  
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
};

  const handleResetTaxiConfig = async () => {
    try {

    if (confirm('Reset Pet Taxi rates to default presets?')) {
      setTaxiConfig(defaultPetTaxiConfig);
      await updateSystemConfig({ petTaxiConfig: defaultPetTaxiConfig });
      triggerSaved('Pet Taxi rates reset to defaults!');
    }
  
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
};

  const handleEditTaxiTier = (index: number, val: number) => {
    setTaxiConfig((prev) => {
      const updatedTiers = [...prev.tiers];
      updatedTiers[index] = { ...updatedTiers[index], basePrice: Math.max(0, val) };
      return { ...prev, tiers: updatedTiers };
    });
  };

  const handleEditFuelCharge = (val: number) => {
    setTaxiConfig((prev) => ({
      ...prev,
      fuelChargePerKm: Math.max(0, val),
    }));
  };

  // Pet Sitting Pricing Config State
  const [sittingConfig, setSittingConfig] = useState<PetSittingConfig>(
    systemConfig.petSittingConfig || defaultPetSittingConfig
  );
  const [sittingViewMode, setSittingViewMode] = useState<'cards' | 'list'>('list');

  useEffect(() => {
    if (systemConfig.petSittingConfig) {
      setSittingConfig(systemConfig.petSittingConfig);
    }
  }, [systemConfig.petSittingConfig]);

  const handleSaveSittingConfig = async () => {
    try {

    await updateSystemConfig({ petSittingConfig: sittingConfig });
    triggerSaved('Pet Sitting rates and additional services saved successfully!');
  
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
};

  const handleResetSittingConfig = async () => {
    try {

    if (confirm('Reset Pet Sitting rates and additional services to default spreadsheet price list?')) {
      setSittingConfig(defaultPetSittingConfig);
      await updateSystemConfig({ petSittingConfig: defaultPetSittingConfig });
      triggerSaved('Pet Sitting rates reset to default price list presets!');
    }
  
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
};

  // Customer Boarding Room Options State (Customer-Facing descriptions and pricing)
  const [customerRoomSpeciesTab, setCustomerRoomSpeciesTab] = useState<'Dog' | 'Cat'>('Dog');
  const [roomViewMode, setRoomViewMode] = useState<'cards' | 'list'>('list');
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
  const [displayedCustomerRooms, setDisplayedCustomerRooms] = useState<CustomerBoardingRoom[]>(
    systemConfig.customerBoardingRooms && systemConfig.customerBoardingRooms.length > 0
      ? systemConfig.customerBoardingRooms.filter(r => r.species === 'Dog' || r.species === 'Cat')
      : defaultCustomerBoardingRooms.filter(r => r.species === 'Dog' || r.species === 'Cat')
  );

  // Small Pets Flat Fee State
  const [smallPetsFee, setSmallPetsFee] = useState<number>(
    systemConfig.smallPetsBoardingFee ?? 10
  );

  useEffect(() => {
    if (systemConfig.customerBoardingRooms && systemConfig.customerBoardingRooms.length > 0) {
      setDisplayedCustomerRooms(systemConfig.customerBoardingRooms.filter(r => r.species === 'Dog' || r.species === 'Cat'));
    }
    if (systemConfig.smallPetsBoardingFee !== undefined) {
      setSmallPetsFee(systemConfig.smallPetsBoardingFee);
    }
  }, [systemConfig.customerBoardingRooms, systemConfig.smallPetsBoardingFee]);

  // New Customer Room Form State
  const [newCustomerRoomId, setNewCustomerRoomId] = useState('');
  const [newCustomerRoomTitle, setNewCustomerRoomTitle] = useState('');
  const [newCustomerRoomPrice, setNewCustomerRoomPrice] = useState(50);
  const [newCustomerRoomCap, setNewCustomerRoomCap] = useState(2);
  const [newCustomerRoomExtra, setNewCustomerRoomExtra] = useState(10);
  const [newCustomerRoomDesc, setNewCustomerRoomDesc] = useState('');

  const handleEditRoomField = (id: string, species: SpeciesType, field: keyof CustomerBoardingRoom, value: any) => {
    setDisplayedCustomerRooms((prev) =>
      prev.map((r) => (r.id === id && r.species === species ? { ...r, [field]: value } : r))
    );
  };

  const handleAddNewCustomerRoom = async () => {
    try {

    if (!newCustomerRoomId.trim() || !newCustomerRoomTitle.trim()) {
      alert('Please provide a Room ID and Display Title.');
      return;
    }
    const targetSpecies = customerRoomSpeciesTab === 'Cat' ? 'Cat' : 'Dog';
    const newRoom: CustomerBoardingRoom = {
      id: newCustomerRoomId.trim(),
      species: targetSpecies,
      title: newCustomerRoomTitle.trim(),
      price: Math.max(0, newCustomerRoomPrice),
      capacity: Math.max(1, newCustomerRoomCap),
      extraPetPrice: Math.max(0, newCustomerRoomExtra),
      desc: newCustomerRoomDesc.trim() || `Fit up to ${newCustomerRoomCap} ${targetSpecies.toLowerCase()}s`,
      active: true,
    };
    const updated = [...displayedCustomerRooms, newRoom];
    setDisplayedCustomerRooms(updated);
    await updateSystemConfig({ customerBoardingRooms: updated, smallPetsBoardingFee: smallPetsFee });
    setNewCustomerRoomId('');
    setNewCustomerRoomTitle('');
    setNewCustomerRoomDesc('');
    triggerSaved(`New ${targetSpecies} room option '${newRoom.title}' added!`);
  
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
};

  const handleDeleteCustomerRoom = async (id: string, species: SpeciesType) => {
    try {

    if (!confirm(`Are you sure you want to delete this room option?`)) return;
    const updated = displayedCustomerRooms.filter((r) => !(r.id === id && r.species === species));
    setDisplayedCustomerRooms(updated);
    await updateSystemConfig({ customerBoardingRooms: updated, smallPetsBoardingFee: smallPetsFee });
    triggerSaved('Room option deleted successfully.');
  
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
};

  const handleSaveAllCustomerRooms = async () => {
    try {

    await updateSystemConfig({ 
      customerBoardingRooms: displayedCustomerRooms,
      smallPetsBoardingFee: smallPetsFee
    });
    triggerSaved('Customer room configurations and small pet lodging fee saved successfully!');
  
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
};

  // New staff state (Only 'Boss' or 'Staff')

  // Login credentials state
  const [staffUsername, setStaffUsername] = useState(systemConfig.staffCredentials?.username || 'staff');
  const [staffPin, setStaffPin] = useState('');
  const [bossUsername, setBossUsername] = useState(systemConfig.bossCredentials?.username || 'admin');
  const [bossPassword, setBossPassword] = useState('');

  // New Room Rule state
  const [newRuleSpecies, setNewRuleSpecies] = useState<'Dog' | 'Cat'>('Dog');
  const [newRuleWeight, setNewRuleWeight] = useState<WeightBracket>('< 5kg');
  const [newRuleRooms, setNewRuleRooms] = useState('D-01, D-02');
  const [newRuleMaxPets, setNewRuleMaxPets] = useState(2);

  // Edit Room Rule modal state
  const [editingRule, setEditingRule] = useState<RoomAssignmentRule | null>(null);
  const [editRoomsInput, setEditRoomsInput] = useState('');

  const triggerSaved = async (msg:string) => {
    setSuccessMsg(null);
    const changes = pendingSettings.current;
    try {
      if (Object.keys(changes).length) {
        await persistSystemConfig(changes);
        for (const key of Object.keys(changes) as (keyof typeof changes)[]) {
          if (pendingSettings.current[key] === changes[key]) delete pendingSettings.current[key];
        }
        setHasPendingSettings(Object.keys(pendingSettings.current).length > 0);
      }
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error) { alert(error instanceof Error ? error.message : 'Settings were not saved.'); }
  };

  const handleSaveCredentials = async () => {
    try {
      await saveCredentials(staffUsername, staffPin, bossUsername, bossPassword);
      setStaffPin(''); setBossPassword('');
      triggerSaved('Login credentials saved as salted password hashes.');
    } catch (error) { alert(error instanceof Error ? error.message : 'Unable to save credentials.'); }
  };

  const handleOpenEditRule = (rule: RoomAssignmentRule) => {
    setEditingRule(rule);
    setEditRoomsInput(rule.preferredRooms.join(', '));
  };

  const handleSaveEditRule = async () => {
    try {

    if (!editingRule) return;
    const roomArr = editRoomsInput.split(',').map((s) => s.trim()).filter(Boolean);
    await updateRoomAssignmentRule(editingRule.id, {
      species: editingRule.species,
      weightBracket: editingRule.weightBracket,
      preferredRooms: roomArr.length > 0 ? roomArr : editingRule.preferredRooms,
      maxPetsPerRoom: editingRule.maxPetsPerRoom,
    });
    setEditingRule(null);
    triggerSaved('Room assignment rule updated successfully');
  
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
};

  // Live calculated slots preview
  const previewGroomingSlots = getCalculatedTimeSlots('Grooming');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-amber-600" />
            Boss Master Administration (Pet Loft)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage service pricing, booking rules, staff access, receipt formats and the shared database.
          </p>
        </div>

        {successMsg && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 animate-fade-in shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {successMsg}
          </div>
        )}
      </div>

      {hasPendingSettings && <div role="status" className="flex items-center justify-between gap-4 border border-amber-300 bg-amber-50 rounded-xl p-4 text-sm"><span>Settings changes are waiting to be saved.</span><button className="font-bold bg-amber-600 text-white px-4 py-2 rounded-lg cursor-pointer" onClick={() => void triggerSaved('Settings saved successfully.')}>Save settings</button></div>}
      <nav aria-label="Settings categories" className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {settingsCategories.map((category) => {
            const Icon = category.icon;
            const selected = activeCategory.id === category.id;
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={selected}
                onClick={() => { if (!selected) setActiveTab(category.tabs[0].id); }}
                className={`p-3 rounded-xl text-left border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 ${selected
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                  : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-amber-50 hover:border-amber-300'}`}
              >
                <Icon className="w-5 h-5 mb-2" />
                <span className="block text-sm font-bold">{category.label}</span>
                <span className={`block text-xs mt-1 leading-relaxed ${selected ? 'text-amber-50' : 'text-slate-500'}`}>{category.description}</span>
              </button>
            );
          })}
        </div>
        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{activeCategory.label}</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label={`${activeCategory.label} sections`}>
            {activeCategory.tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 ${activeTab === tab.id
                  ? 'bg-amber-50 text-amber-900 border-amber-500'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* TAB 1: GROOMING SLOTS & TIME ENGINE */}
      {activeTab === 'grooming' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <GroomingPriceSettings />
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              Operating Hours & Grooming Slot Time Calculator
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Set shop operation times and buffer periods. The system automatically divides the day by your pet capacity and generates customer-selectable appointment slots with empty rest/sanitizing buffers!
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200 text-xs">
              <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Operating Time & Buffer Controls
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Opening Time</label>
                  <input
                    type="time"
                    value={systemConfig.operatingHours?.openTime || '10:00'}
                    onChange={async (e) => {
    try {

                      await updateSystemConfig({
                        operatingHours: {
                          ...systemConfig.operatingHours,
                          openTime: e.target.value,
                        },
                      });
                    
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
}}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Closing Time</label>
                  <input
                    type="time"
                    value={systemConfig.operatingHours?.closeTime || '19:00'}
                    onChange={async (e) => {
    try {

                      await updateSystemConfig({
                        operatingHours: {
                          ...systemConfig.operatingHours,
                          closeTime: e.target.value,
                        },
                      });
                    
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
}}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Buffer / Resting Period Between Each Pet Service
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
    try {

                      await updateSystemConfig({
                        operatingHours: {
                          ...systemConfig.operatingHours,
                          bufferMinutes: 30,
                        },
                      });
                    
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
}}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      systemConfig.operatingHours?.bufferMinutes === 30
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    30 Minutes Buffer
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
    try {

                      await updateSystemConfig({
                        operatingHours: {
                          ...systemConfig.operatingHours,
                          bufferMinutes: 60,
                        },
                      });
                    
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
}}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      systemConfig.operatingHours?.bufferMinutes === 60
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    1 Hour (60m) Buffer
                  </button>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Leaves 30m to 1h unbooked between slots for sanitizing, bathing cleanup, and staff rest.
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Maximum Pets / Dogs per Day
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={systemConfig.groomingCapacity.maxDogsPerDay}
                  onChange={async (e) => {
    try {

                    await updateSystemConfig({
                      groomingCapacity: {
                        ...systemConfig.groomingCapacity,
                        maxDogsPerDay: Number(e.target.value),
                      },
                    });
                  
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
}}
                  className="w-32 px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-2">Active Operating Days</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { day: 0, label: 'Sun' },
                    { day: 1, label: 'Mon' },
                    { day: 2, label: 'Tue' },
                    { day: 3, label: 'Wed' },
                    { day: 4, label: 'Thu' },
                    { day: 5, label: 'Fri' },
                    { day: 6, label: 'Sat' },
                  ].map((d) => {
                    const isActive = systemConfig.groomingCapacity.activeDays.includes(d.day);
                    return (
                      <button
                        key={d.day}
                        type="button"
                        onClick={async () => {
    try {

                          const newDays = isActive
                            ? systemConfig.groomingCapacity.activeDays.filter((x) => x !== d.day)
                            : [...systemConfig.groomingCapacity.activeDays, d.day];
                          await updateSystemConfig({
                            groomingCapacity: {
                              ...systemConfig.groomingCapacity,
                              activeDays: newDays,
                            },
                          });
                        
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
}}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-amber-600 text-white'
                            : 'bg-white text-slate-400 border border-slate-200'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Live Calculated Time Slots Preview */}
            <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-200 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Live Calculated Customer Slots:
                </h3>
                <p className="text-xs text-slate-600 mb-4">
                  Based on operating hours ({systemConfig.operatingHours?.openTime || '10:00'} - {systemConfig.operatingHours?.closeTime || '19:00'}), {systemConfig.groomingCapacity.maxDogsPerDay} pets/day, and a {systemConfig.operatingHours?.bufferMinutes || 30}-min rest buffer:
                </p>

                <div className="space-y-2">
                  {previewGroomingSlots.map((slot, i) => (
                    <div
                      key={i}
                      className="bg-white px-3.5 py-2.5 rounded-xl border border-amber-200 text-xs font-bold text-slate-800 flex items-center justify-between shadow-xs"
                    >
                      <span>Slot #{i + 1}: {slot}</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                        Buffer: {systemConfig.operatingHours?.bufferMinutes || 30}m
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-[11px] text-slate-500 mt-4 pt-3 border-t border-amber-200">
                Customers selecting Grooming on the booking form will only be able to choose from these exact calculated slots.
              </div>
            </div>
          </div>

          {/* Explicit Save Button */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">Changes are saved directly to local storage and active immediately.</span>
            <button
              type="button"
              onClick={() => triggerSaved('Operating hours and grooming slots updated successfully!')}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Grooming Configuration
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: ROOM AUTO-ASSIGNMENT RULES (EDITABLE & SORTABLE) */}
      {activeTab === 'rooms' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Home className="w-5 h-5 text-amber-600" />
                Room Auto-Assignment Rules (Priority Order & Fully Editable)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Rules are evaluated in order from top to bottom. Use the Move Up (↑) / Down (↓) buttons to adjust priority matching, or click Edit to modify any rule.
              </p>
            </div>
          </div>

          {/* Operation Side Notice */}
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-950">
              <span>ℹ️</span> Operation Kennel Auto-Assignment (Pet Weight &amp; Kennel Codes)
            </div>
            <p className="text-[11px] leading-relaxed text-amber-800">
              Saved Boarding Room Types supply the matrix and allocator with the same capacity, price and description. These rules add weight-based limits; the effective limit is the smaller of room capacity and weight-rule limit. Rules configured here are for the <strong>operation side</strong> — assigning physical kennels (e.g. D-01, D-02) based on species and pet weight brackets during check-in. Customer-facing room options, descriptions, and pricing are managed separately under{' '}
              <button
                type="button"
                onClick={() => setActiveTab('boarding')}
                className="underline font-bold text-amber-900 hover:text-amber-700 cursor-pointer"
              >
                Customer Portal &gt; Customer Room Types &amp; Pricing
              </button>.
            </p>
          </div>

          {/* Add New Rule Form */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
            <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-3">
              Add New Room Assignment Rule
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Species</label>
                <select
                  value={newRuleSpecies}
                  onChange={(e) => setNewRuleSpecies(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="Dog">Dog</option>
                  <option value="Cat">Cat</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Weight Bracket</label>
                <select
                  value={newRuleWeight}
                  onChange={(e) => setNewRuleWeight(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="< 5kg">&lt; 5kg</option>
                  <option value="6 - 12 kg">6 - 12 kg</option>
                  <option value="13 - 20 kg">13 - 20 kg</option>
                  <option value="21 - 30 kg">21 - 30 kg</option>
                  <option value="> 30 kg">&gt; 30 kg</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Preferred Rooms (e.g. D-01, D-02)</label>
                <input
                  type="text"
                  placeholder="e.g. D-01, D-02"
                  value={newRuleRooms}
                  onChange={(e) => setNewRuleRooms(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Max Pets/Room</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={newRuleMaxPets}
                    onChange={(e) => setNewRuleMaxPets(Number(e.target.value))}
                    className="w-20 px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                  />
                  <button
                    type="button"
                    onClick={async () => {
    try {

                      const roomArr = newRuleRooms.split(',').map((s) => s.trim()).filter(Boolean);
                      await addRoomAssignmentRule({
                        species: newRuleSpecies,
                        weightBracket: newRuleWeight,
                        preferredRooms: roomArr.length > 0 ? roomArr : ['D-01'],
                        maxPetsPerRoom: newRuleMaxPets,
                      });
                      triggerSaved('Room assignment rule added');
                    
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
}}
                    className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl cursor-pointer"
                  >
                    Add Rule
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Existing Rules Table with Priority Reordering, Edit and Delete */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Priority / Order</th>
                  <th className="py-2.5 px-3">Species</th>
                  <th className="py-2.5 px-3">Weight Bracket</th>
                  <th className="py-2.5 px-3">Preferred Room Numbers</th>
                  <th className="py-2.5 px-3">Max Pets / Room</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(systemConfig.roomAssignmentRules || []).map((rule, idx) => (
                  <tr key={rule.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold text-slate-500">
                      <div className="flex items-center gap-1">
                        <span className="w-5 text-center">{idx + 1}</span>
                        <div className="flex flex-col">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={async () => {
    try {

                              await moveRoomAssignmentRule(idx, 'up');
                              triggerSaved('Rule priority moved up');
                            
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
}}
                            title="Move priority up"
                            className="p-0.5 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === (systemConfig.roomAssignmentRules || []).length - 1}
                            onClick={async () => {
    try {

                              await moveRoomAssignmentRule(idx, 'down');
                              triggerSaved('Rule priority moved down');
                            
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
}}
                            title="Move priority down"
                            className="p-0.5 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-bold">{rule.species}</td>
                    <td className="py-2.5 px-3">{rule.weightBracket}</td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-amber-800">
                      {rule.preferredRooms.map(number => { const room = rooms.find(r => r.roomNumber === number); return room ? `${number} (max ${Math.min(room.maxCapacity, rule.maxPetsPerRoom)})` : `${number} (unknown)`; }).join(', ')}
                    </td>
                    <td className="py-2.5 px-3 font-bold">{rule.maxPetsPerRoom}</td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditRule(rule)}
                          title="Edit this rule"
                          className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
    try {

                            await deleteRoomAssignmentRule(rule.id);
                            triggerSaved('Rule deleted');
                          
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
}}
                          title="Delete this rule"
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Edit Rule Modal */}
          {editingRule && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-amber-600" />
                    Edit Room Assignment Rule
                  </h3>
                  <button
                    onClick={() => setEditingRule(null)}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Species</label>
                    <select
                      value={editingRule.species}
                      onChange={(e) => setEditingRule({ ...editingRule, species: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                    >
                      <option value="Dog">Dog</option>
                      <option value="Cat">Cat</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Weight Bracket</label>
                    <select
                      value={editingRule.weightBracket}
                      onChange={(e) => setEditingRule({ ...editingRule, weightBracket: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                    >
                      <option value="< 5kg">&lt; 5kg</option>
                      <option value="6 - 12 kg">6 - 12 kg</option>
                      <option value="13 - 20 kg">13 - 20 kg</option>
                      <option value="21 - 30 kg">21 - 30 kg</option>
                      <option value="> 30 kg">&gt; 30 kg</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Preferred Rooms (comma separated)</label>
                    <input
                      type="text"
                      value={editRoomsInput}
                      onChange={(e) => setEditRoomsInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Max Pets Allowed Per Room</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={editingRule.maxPetsPerRoom}
                      onChange={(e) => setEditingRule({ ...editingRule, maxPetsPerRoom: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingRule(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEditRule}
                    className="px-5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl cursor-pointer shadow-xs"
                  >
                    Save Rule Changes
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Explicit Save Bar */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">Rules priority sorting persists instantly.</span>
            <button
              type="button"
              onClick={() => triggerSaved('Room auto-assignment configuration saved successfully!')}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              <Save className="w-4 h-4" />
              Update Room Rules
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: FORM FIELD RULES */}
      {activeTab === 'form' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            Customer Booking Portal — Required vs. Optional Fields
          </h2>
          <p className="text-xs text-slate-500">
            Configure which fields are mandatory on the public form. (Pet Number, Pet Weight, and Scheduled Time are always mandatory).
          </p>

          <div className="divide-y divide-slate-100 max-w-xl">
            {[
              { key: 'petNameRequired', label: 'Pet Name' },
              { key: 'petBreedRequired', label: 'Pet Breed' },
              { key: 'vaxDateRequired', label: 'Vaccination Expiry Date' },
              { key: 'notesRequired', label: 'Special Notes & Behavior' },
            ].map((field) => (
              <div key={field.key} className="py-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-slate-800">{field.label}</span>
                  <span className="text-xs text-slate-400 block">
                    {systemConfig.formFieldConfig[field.key as keyof typeof systemConfig.formFieldConfig]
                      ? 'Marked as Required'
                      : 'Marked as Optional'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
    try {

                    const current = systemConfig.formFieldConfig[field.key as keyof typeof systemConfig.formFieldConfig];
                    await updateSystemConfig({
                      formFieldConfig: {
                        ...systemConfig.formFieldConfig,
                        [field.key]: !current,
                      },
                    });
                  
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
}}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    systemConfig.formFieldConfig[field.key as keyof typeof systemConfig.formFieldConfig]
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {systemConfig.formFieldConfig[field.key as keyof typeof systemConfig.formFieldConfig]
                    ? 'Required'
                    : 'Optional'}
                </button>
              </div>
            ))}
          </div>

          {/* Explicit Save Bar */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">Field validations update immediately on the customer portal.</span>
            <button
              type="button"
              onClick={() => triggerSaved('Form field requirements saved successfully!')}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Field Configuration
            </button>
          </div>
        </div>
      )}

      {/* TAB: BOARDING ROOM TYPES & PRICING */}
      {activeTab === 'boarding' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Home className="w-5 h-5 text-amber-600" />
                Boarding Room Types &amp; Pricing
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Configure Dog &amp; Cat room types (base price, capacity, extra pet fee) and Small Pet (own cage) flat lodging fee.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
    try {

                  if (confirm('Reset all customer room options to default price list presets?')) {
                    await resetCustomerBoardingRooms();
                    setDisplayedCustomerRooms(defaultCustomerBoardingRooms);
                    triggerSaved('Customer room options reset to default presets!');
                  }
                
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
}}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Defaults
              </button>
              <button
                type="button"
                onClick={handleSaveAllCustomerRooms}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>

          {/* Clean Explainer: How Pricing & Surcharges Work */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50/80 to-amber-100/40 border border-amber-200 text-xs space-y-3">
            <div className="font-bold flex items-center gap-2 text-amber-950 text-sm">
              <span>💡</span> How Room &amp; Enclosure Pricing Works (Clear Guide)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-amber-900">
              <div className="p-2.5 rounded-lg bg-white/80 border border-amber-200/60 space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-1">
                  <span>🏷️</span> Base Price (RM/night)
                </div>
                <p className="text-slate-600 leading-relaxed">
                  The standard room rate per night. <strong>Includes the 1st pet</strong> staying in that room or enclosure.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-white/80 border border-amber-200/60 space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-1">
                  <span>👥</span> Max Capacity (Pets)
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Maximum number of pets permitted to stay together in 1 single room or enclosure.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-white/80 border border-amber-200/60 space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-1">
                  <span>➕</span> Extra Pet Fee (+RM)
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Additional fee charged <strong>per extra pet starting from the 2nd pet</strong> in the same room. Set to 0 if single occupancy only.
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-amber-100/70 text-[11px] text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <strong>🔄 Multi-Pet Recalculation Rule:</strong> When customers choose <strong>Separate Rooms</strong>, price is <em>Pets × Base Price</em>. When pets <strong>Share Room(s)</strong>, price is <em>Base Price + (Pets - 1) × Extra Pet Fee</em>.
              </div>
            </div>
          </div>

          {/* Species Filter Tabs (Dogs & Cats only - Small pets use own cage) & View Mode Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'Dog' as const, icon: '🐶', label: 'Dogs' },
                { id: 'Cat' as const, icon: '🐱', label: 'Cats' },
              ].map((tab) => {
                const count = displayedCustomerRooms.filter((r) => r.species === tab.id).length;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setCustomerRoomSpeciesTab(tab.id);
                      setExpandedRoomId(null);
                    }}
                    className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                      customerRoomSpeciesTab === tab.id
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>{tab.icon}</span> {tab.label} ({count})
                  </button>
                );
              })}
            </div>

            {/* View Mode Toggle: List View (Default) vs Cards View */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setRoomViewMode('list')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  roomViewMode === 'list'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                List View
              </button>
              <button
                type="button"
                onClick={() => setRoomViewMode('cards')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  roomViewMode === 'cards'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Cards View
              </button>
            </div>
          </div>

          {/* Small Pets (Own Cage) Policy & Flat Lodging Fee Setting */}
          <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-2xl p-2 bg-white rounded-xl border border-amber-200 shadow-xs">🐰🐹🦜</span>
              <div>
                <div className="font-bold text-slate-900 text-sm">Small Pets (Rabbit, Hamster, Bird) Boarding Policy</div>
                <div className="text-slate-600 text-[11px] mt-0.5">
                  Owners bring their own cage / habitat. Flat per-night lodging fee per pet (no room types configured on customer portal).
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-amber-200 shrink-0">
              <span className="font-bold text-slate-700 text-xs">Per-Night Fee:</span>
              <div className="flex items-center">
                <span className="text-slate-400 font-bold mr-1 text-xs">RM</span>
                <input
                  type="number"
                  min="0"
                  value={smallPetsFee}
                  onChange={(e) => setSmallPetsFee(Number(e.target.value))}
                  className="w-14 font-black text-amber-700 text-sm text-center outline-none bg-slate-50 py-0.5 rounded border border-slate-200"
                />
                <span className="text-slate-500 text-[11px] ml-1">/ pet / night</span>
              </div>
            </div>
          </div>

          {/* LIST VIEW OR CARDS VIEW */}
          {roomViewMode === 'list' ? (
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-4">Room / Habitat Type</th>
                      <th className="py-3 px-4">Base (RM/night)</th>
                      <th className="py-3 px-4">Capacity</th>
                      <th className="py-3 px-4">Extra Pet Fee</th>
                      <th className="py-3 px-4">Customer Description</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedCustomerRooms
                      .filter((r) => r.species === customerRoomSpeciesTab)
                      .map((room) => {
                        const isExpanded = expandedRoomId === room.id;
                        return (
                          <React.Fragment key={`${room.species}-${room.id}`}>
                            <tr
                              onClick={() => setExpandedRoomId(isExpanded ? null : room.id)}
                              className={`cursor-pointer transition-colors ${
                                isExpanded ? 'bg-amber-50/60' : 'hover:bg-slate-50/80'
                              }`}
                            >
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-900 flex items-center gap-2">
                                  <span>{room.title}</span>
                                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                    {room.id}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-4 font-black text-amber-700 text-xs">
                                RM {room.price}
                              </td>
                              <td className="py-3 px-4 font-semibold text-slate-700">
                                {room.capacity} {room.capacity === 1 ? 'pet' : 'pets'}
                              </td>
                              <td className="py-3 px-4 text-slate-600">
                                {room.capacity > 1 ? (
                                  <span className="font-medium text-amber-800">+{room.extraPetPrice} / extra</span>
                                ) : (
                                  <span className="text-slate-400">Single</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-slate-500 max-w-xs truncate" title={room.desc}>
                                {room.desc}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedRoomId(isExpanded ? null : room.id)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                                      isExpanded
                                        ? 'bg-amber-600 text-white shadow-xs'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                    }`}
                                    title="Click to edit room details"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                    {isExpanded ? 'Done' : 'Edit'}
                                    {isExpanded ? (
                                      <ChevronUp className="w-3 h-3" />
                                    ) : (
                                      <ChevronDown className="w-3 h-3" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCustomerRoom(room.id, room.species)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                    title="Delete room type"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Expandable Accordion Panel */}
                            {isExpanded && (
                              <tr className="bg-amber-50/40 border-b border-amber-200">
                                <td colSpan={6} className="p-4">
                                  <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs space-y-4">
                                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                      <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                                        <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                                        <span>Editing Room Type: <strong>{room.title}</strong></span>
                                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                          ID: {room.id}
                                        </span>
                                      </div>
                                      <span className="text-[11px] text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                        Inline Editor
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                      <div className="md:col-span-2">
                                        <label className="block font-bold text-slate-700 mb-1">
                                          Room / Habitat Display Name
                                        </label>
                                        <input
                                          type="text"
                                          value={room.title}
                                          onChange={(e) => handleEditRoomField(room.id, room.species, 'title', e.target.value)}
                                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-900 text-xs"
                                        />
                                      </div>

                                      <div>
                                        <label className="block font-bold text-slate-700 mb-1">Base Price (RM/night)</label>
                                        <input
                                          type="number"
                                          min="0"
                                          value={room.price}
                                          onChange={(e) => handleEditRoomField(room.id, room.species, 'price', Number(e.target.value))}
                                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-black text-amber-700 text-xs"
                                        />
                                      </div>

                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="block font-bold text-slate-700 mb-1">Max Cap</label>
                                          <input
                                            type="number"
                                            min="1"
                                            max="10"
                                            value={room.capacity}
                                            onChange={(e) => handleEditRoomField(room.id, room.species, 'capacity', Number(e.target.value))}
                                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 text-xs text-center"
                                          />
                                        </div>
                                        <div>
                                          <label className="block font-bold text-slate-700 mb-1">Extra (+RM)</label>
                                          <input
                                            type="number"
                                            min="0"
                                            value={room.extraPetPrice}
                                            onChange={(e) => handleEditRoomField(room.id, room.species, 'extraPetPrice', Number(e.target.value))}
                                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 text-xs text-center"
                                          />
                                        </div>
                                      </div>
                                    </div>

                                    <div>
                                      <label className="block font-bold text-slate-700 mb-1">
                                        Customer Portal Description (Shown on public booking form)
                                      </label>
                                      <textarea
                                        rows={2}
                                        value={room.desc}
                                        onChange={(e) => handleEditRoomField(room.id, room.species, 'desc', e.target.value)}
                                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs resize-none"
                                      />
                                    </div>

                                    {/* Live Calculation Formula Preview */}
                                    <div className="bg-amber-50/80 p-3 rounded-lg border border-amber-200/70 text-[11px] text-amber-950 space-y-2">
                                      <div className="font-bold text-[10px] uppercase tracking-wider text-amber-800 flex items-center justify-between">
                                        <span>💡 Live Pricing Formula</span>
                                        <span className="font-mono text-slate-500 font-normal">Cap: {room.capacity} pets</span>
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <div className="bg-white/95 p-2 rounded-lg border border-amber-100">
                                          <span className="text-slate-500 block text-[10px]">1 Pet:</span>
                                          <strong className="text-slate-900">RM {room.price}</strong> / night
                                        </div>
                                        {room.capacity > 1 ? (
                                          <div className="bg-white/95 p-2 rounded-lg border border-amber-100">
                                            <span className="text-slate-500 block text-[10px]">2 Pets (Shared):</span>
                                            <strong className="text-amber-800">RM {room.price + room.extraPetPrice}</strong> / night
                                            <span className="text-[9px] text-slate-500 block mt-0.5">(+{room.extraPetPrice} extra)</span>
                                          </div>
                                        ) : (
                                          <div className="bg-white/95 p-2 rounded-lg border border-amber-100 text-slate-500">
                                            <span className="text-slate-500 block text-[10px]">2 Pets:</span>
                                            2 separate rooms
                                          </div>
                                        )}
                                        <div className="bg-white/95 p-2 rounded-lg border border-amber-100">
                                          <span className="text-slate-500 block text-[10px]">5 Pets (Separate):</span>
                                          <strong className="text-slate-900">RM {room.price * 5}</strong> / night
                                          <span className="text-[9px] text-slate-500 block mt-0.5">(5 × RM {room.price})</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex justify-end pt-1">
                                      <button
                                        type="button"
                                        onClick={() => setExpandedRoomId(null)}
                                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                      >
                                        <ChevronUp className="w-3.5 h-3.5" />
                                        Done / Collapse
                                      </button>
                                    </div>
                                  </div>
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
          ) : (
            /* CARDS VIEW */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedCustomerRooms
                .filter((r) => r.species === customerRoomSpeciesTab)
                .map((room) => (
                  <div
                    key={`${room.species}-${room.id}`}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3 hover:border-amber-300 transition-colors"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                        ID: {room.id}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomerRoom(room.id, room.species)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                        title="Delete room type"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="block font-bold text-slate-700 mb-0.5">Room / Habitat Display Name</label>
                        <input
                          type="text"
                          value={room.title}
                          onChange={(e) => handleEditRoomField(room.id, room.species, 'title', e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-900 text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block font-bold text-slate-700 mb-0.5">Base (RM/night)</label>
                          <input
                            type="number"
                            min="0"
                            value={room.price}
                            onChange={(e) => handleEditRoomField(room.id, room.species, 'price', Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-black text-amber-700 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-0.5">Max Capacity</label>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={room.capacity}
                            onChange={(e) => handleEditRoomField(room.id, room.species, 'capacity', Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-0.5">Extra Pet (+RM)</label>
                          <input
                            type="number"
                            min="0"
                            value={room.extraPetPrice}
                            onChange={(e) => handleEditRoomField(room.id, room.species, 'extraPetPrice', Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 text-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-0.5">
                          Customer Portal Description (Shown under room card)
                        </label>
                        <textarea
                          rows={2}
                          value={room.desc}
                          onChange={(e) => handleEditRoomField(room.id, room.species, 'desc', e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs resize-none"
                        />
                      </div>

                      {/* Live Calculation Preview Pill */}
                      <div className="bg-amber-50/80 p-2.5 rounded-lg border border-amber-200/70 text-[11px] text-amber-950 space-y-1">
                        <div className="font-bold text-[10px] uppercase tracking-wider text-amber-800 flex items-center justify-between">
                          <span>💡 Live Pricing Formula</span>
                          <span className="font-mono text-slate-500 font-normal">Cap: {room.capacity} pets</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[11px]">
                          <div className="bg-white/90 px-2 py-1 rounded border border-amber-100">
                            <span className="text-slate-500 block text-[10px]">1 Pet:</span>
                            <strong className="text-slate-900">RM {room.price}</strong> / night
                          </div>
                          {room.capacity > 1 ? (
                            <div className="bg-white/90 px-2 py-1 rounded border border-amber-100">
                              <span className="text-slate-500 block text-[10px]">2 Pets (Shared):</span>
                              <strong className="text-amber-800">RM {room.price + room.extraPetPrice}</strong> / night
                              <span className="text-[9px] text-slate-500 block leading-none mt-0.5">(+{room.extraPetPrice} extra)</span>
                            </div>
                          ) : (
                            <div className="bg-white/90 px-2 py-1 rounded border border-amber-100 text-slate-500">
                              <span className="text-slate-500 block text-[10px]">2 Pets:</span>
                              2 separate rooms
                            </div>
                          )}
                          <div className="bg-white/90 px-2 py-1 rounded border border-amber-100">
                            <span className="text-slate-500 block text-[10px]">5 Pets (Separate):</span>
                            <strong className="text-slate-900">RM {room.price * 5}</strong> / night
                            <span className="text-[9px] text-slate-500 block leading-none mt-0.5">(5 × RM {room.price})</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Add New Room Type Section */}
          <div className="p-4 rounded-xl border border-dashed border-amber-300 bg-amber-50/40 space-y-3">
            <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-amber-700" />
              Add New {customerRoomSpeciesTab} Room Type Option
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-0.5">Room ID / Key</label>
                <input
                  type="text"
                  placeholder="e.g. VIP Suite"
                  value={newCustomerRoomId}
                  onChange={(e) => setNewCustomerRoomId(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-0.5">Display Title</label>
                <input
                  type="text"
                  placeholder="e.g. VIP Glass Suite"
                  value={newCustomerRoomTitle}
                  onChange={(e) => setNewCustomerRoomTitle(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-0.5">Base Price (RM)</label>
                <input
                  type="number"
                  min="0"
                  value={newCustomerRoomPrice}
                  onChange={(e) => setNewCustomerRoomPrice(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-0.5">Max Capacity / Extra Fee</label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    min="1"
                    placeholder="Cap"
                    value={newCustomerRoomCap}
                    onChange={(e) => setNewCustomerRoomCap(Number(e.target.value))}
                    className="w-1/2 px-2 py-1.5 rounded-lg border border-slate-300 bg-white"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="+RM"
                    value={newCustomerRoomExtra}
                    onChange={(e) => setNewCustomerRoomExtra(Number(e.target.value))}
                    className="w-1/2 px-2 py-1.5 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 text-xs mb-0.5">Description</label>
              <input
                type="text"
                placeholder="e.g. Luxury VIP Suite • Fit up to 4 dogs • +RM20/dog from 2nd dog"
                value={newCustomerRoomDesc}
                onChange={(e) => setNewCustomerRoomDesc(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
              />
            </div>
            <button
              type="button"
              onClick={handleAddNewCustomerRoom}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-xs"
            >
              + Add {customerRoomSpeciesTab} Room Type
            </button>
          </div>

          {/* Explicit Save Bar */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Click to save and instantly update the customer booking portal descriptions and pricing.
            </span>
            <button
              type="button"
              onClick={handleSaveAllCustomerRooms}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Customer Room Settings
            </button>
          </div>
        </div>
      )}

      {/* TAB: PET SITTING PRICING & SERVICES */}
      {activeTab === 'sitting' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <HeartHandshake className="w-5 h-5 text-amber-600" />
                Pet Sitting Pricing &amp; Additional Services
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Configure base session rates (first/largest pet), extra pet rates, and additional home care services directly matching the master price list.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetSittingConfig}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Defaults
              </button>
              <button
                type="button"
                onClick={handleSaveSittingConfig}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>

          {/* Pricing Rule Explainer */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50/80 to-amber-100/40 border border-amber-200 text-xs space-y-3">
            <div className="font-bold flex items-center gap-2 text-amber-950 text-sm">
              <span>💡</span> How Pet Sitting Multi-Pet Pricing Works (Clear Guide)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-amber-900">
              <div className="p-2.5 rounded-lg bg-white/80 border border-amber-200/60 space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-1">
                  <span>🐕</span> 1st Pet (Largest Pet Base Rate)
                </div>
                <p className="text-slate-600 leading-relaxed">
                  The primary session fee is determined by the <strong>largest pet</strong> in the booking (Small &lt;10kg: RM {sittingConfig.baseRates.small}, Medium 10-30kg: RM {sittingConfig.baseRates.medium}, Large/XL &gt;30kg: RM {sittingConfig.baseRates.largeXl}).
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-white/80 border border-amber-200/60 space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-1">
                  <span>➕</span> Extra Pets (Smaller / Subsequent Pets)
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Additional pets in the same session are charged extra pet rates: <strong>&lt; 25kg</strong> is +RM {sittingConfig.extraPetRates.under25kg}/pet, and <strong>&gt; 25kg</strong> is +RM {sittingConfig.extraPetRates.over25kg}/pet.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-white/80 border border-amber-200/60 space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-1">
                  <span>✨</span> Add-ons &amp; Peak Surcharge
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Services like dog walking, medication feeding, cage cleaning, home area cleaning, and peak period surcharges are added transparently to the session total.
                </p>
              </div>
            </div>
          </div>

          {/* View Mode Toggle Switcher */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Pet Sitting Price Items:</span>
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setSittingViewMode('cards')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  sittingViewMode === 'cards'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Cards View
              </button>
              <button
                type="button"
                onClick={() => setSittingViewMode('list')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  sittingViewMode === 'list'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                List View
              </button>
            </div>
          </div>

          {/* LIST VIEW */}
          {sittingViewMode === 'list' ? (
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-4">Item Code</th>
                      <th className="py-3 px-4">Service Name</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Billing Unit</th>
                      <th className="py-3 px-4">Weight / Criteria</th>
                      <th className="py-3 px-4 text-right">Price (RM)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* PS01 */}
                    <tr className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">PS01</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">Pet Sitting - S</td>
                      <td className="py-3 px-4 text-slate-600">Pet Sitting (1st Pet)</td>
                      <td className="py-3 px-4 text-slate-600">Per Pet</td>
                      <td className="py-3 px-4 font-mono text-slate-600">&lt; 10 kg</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-slate-400">RM</span>
                          <input
                            type="number"
                            min="0"
                            value={sittingConfig.baseRates.small}
                            onChange={(e) =>
                              setSittingConfig((prev) => ({
                                ...prev,
                                baseRates: { ...prev.baseRates, small: Number(e.target.value) },
                              }))
                            }
                            className="w-20 px-2 py-1 rounded-lg border border-slate-300 font-bold text-amber-700 text-right text-xs"
                          />
                        </div>
                      </td>
                    </tr>

                    {/* PS02 */}
                    <tr className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">PS02</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">Pet Sitting - M</td>
                      <td className="py-3 px-4 text-slate-600">Pet Sitting (1st Pet)</td>
                      <td className="py-3 px-4 text-slate-600">Per Pet</td>
                      <td className="py-3 px-4 font-mono text-slate-600">10 - 30 kg</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-slate-400">RM</span>
                          <input
                            type="number"
                            min="0"
                            value={sittingConfig.baseRates.medium}
                            onChange={(e) =>
                              setSittingConfig((prev) => ({
                                ...prev,
                                baseRates: { ...prev.baseRates, medium: Number(e.target.value) },
                              }))
                            }
                            className="w-20 px-2 py-1 rounded-lg border border-slate-300 font-bold text-amber-700 text-right text-xs"
                          />
                        </div>
                      </td>
                    </tr>

                    {/* PS03 */}
                    <tr className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">PS03</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">Pet Sitting - L / XL</td>
                      <td className="py-3 px-4 text-slate-600">Pet Sitting (1st Pet)</td>
                      <td className="py-3 px-4 text-slate-600">Per Pet</td>
                      <td className="py-3 px-4 font-mono text-slate-600">&gt; 30 kg</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-slate-400">RM</span>
                          <input
                            type="number"
                            min="0"
                            value={sittingConfig.baseRates.largeXl}
                            onChange={(e) =>
                              setSittingConfig((prev) => ({
                                ...prev,
                                baseRates: { ...prev.baseRates, largeXl: Number(e.target.value) },
                              }))
                            }
                            className="w-20 px-2 py-1 rounded-lg border border-slate-300 font-bold text-amber-700 text-right text-xs"
                          />
                        </div>
                      </td>
                    </tr>

                    {/* PS04 */}
                    <tr className="hover:bg-slate-50/70 bg-amber-50/30">
                      <td className="py-3 px-4 font-mono font-bold text-amber-900">PS04</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">Pet Sitting - Extra Pet</td>
                      <td className="py-3 px-4 text-amber-800">Extra Pet (Subsequent)</td>
                      <td className="py-3 px-4 text-slate-600">Per Pet (Max. 3)</td>
                      <td className="py-3 px-4 font-mono text-slate-600">&lt; 25 kg</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-slate-400">RM</span>
                          <input
                            type="number"
                            min="0"
                            value={sittingConfig.extraPetRates.under25kg}
                            onChange={(e) =>
                              setSittingConfig((prev) => ({
                                ...prev,
                                extraPetRates: { ...prev.extraPetRates, under25kg: Number(e.target.value) },
                              }))
                            }
                            className="w-20 px-2 py-1 rounded-lg border border-slate-300 font-bold text-amber-700 text-right text-xs"
                          />
                        </div>
                      </td>
                    </tr>

                    {/* PS05 */}
                    <tr className="hover:bg-slate-50/70 bg-amber-50/30">
                      <td className="py-3 px-4 font-mono font-bold text-amber-900">PS05</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">Pet Sitting - Extra Pet</td>
                      <td className="py-3 px-4 text-amber-800">Extra Pet (Subsequent)</td>
                      <td className="py-3 px-4 text-slate-600">Per Pet (Max. 3)</td>
                      <td className="py-3 px-4 font-mono text-slate-600">&gt; 25 kg</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-slate-400">RM</span>
                          <input
                            type="number"
                            min="0"
                            value={sittingConfig.extraPetRates.over25kg}
                            onChange={(e) =>
                              setSittingConfig((prev) => ({
                                ...prev,
                                extraPetRates: { ...prev.extraPetRates, over25kg: Number(e.target.value) },
                              }))
                            }
                            className="w-20 px-2 py-1 rounded-lg border border-slate-300 font-bold text-amber-700 text-right text-xs"
                          />
                        </div>
                      </td>
                    </tr>

                    {/* PS-W */}
                    <tr className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">PS-W</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">Pet Sitting - Walk</td>
                      <td className="py-3 px-4 text-slate-600">Additional Services</td>
                      <td className="py-3 px-4 text-slate-600">Every 10 min</td>
                      <td className="py-3 px-4 text-slate-400">—</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-slate-400">RM</span>
                          <input
                            type="number"
                            min="0"
                            value={sittingConfig.addons.walkPer10Min}
                            onChange={(e) =>
                              setSittingConfig((prev) => ({
                                ...prev,
                                addons: { ...prev.addons, walkPer10Min: Number(e.target.value) },
                              }))
                            }
                            className="w-20 px-2 py-1 rounded-lg border border-slate-300 font-bold text-amber-700 text-right text-xs"
                          />
                        </div>
                      </td>
                    </tr>

                    {/* PS-MF */}
                    <tr className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">PS-MF</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">Pet Sitting - Med Feed</td>
                      <td className="py-3 px-4 text-slate-600">Additional Services</td>
                      <td className="py-3 px-4 text-slate-600">Per Time</td>
                      <td className="py-3 px-4 text-slate-400">—</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-slate-400">RM</span>
                          <input
                            type="number"
                            min="0"
                            value={sittingConfig.addons.medFeedPerTime}
                            onChange={(e) =>
                              setSittingConfig((prev) => ({
                                ...prev,
                                addons: { ...prev.addons, medFeedPerTime: Number(e.target.value) },
                              }))
                            }
                            className="w-20 px-2 py-1 rounded-lg border border-slate-300 font-bold text-amber-700 text-right text-xs"
                          />
                        </div>
                      </td>
                    </tr>

                    {/* PS-FF */}
                    <tr className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">PS-FF</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">Pet Sitting - Fresh Food Cooking</td>
                      <td className="py-3 px-4 text-slate-600">Additional Services</td>
                      <td className="py-3 px-4 text-slate-600">Per Time</td>
                      <td className="py-3 px-4 text-slate-400">—</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-slate-400">RM</span>
                          <input
                            type="number"
                            min="0"
                            value={sittingConfig.addons.freshFoodPerTime}
                            onChange={(e) =>
                              setSittingConfig((prev) => ({
                                ...prev,
                                addons: { ...prev.addons, freshFoodPerTime: Number(e.target.value) },
                              }))
                            }
                            className="w-20 px-2 py-1 rounded-lg border border-slate-300 font-bold text-amber-700 text-right text-xs"
                          />
                        </div>
                      </td>
                    </tr>

                    {/* PS-C01 */}
                    <tr className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">PS-C01</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">Pet Sitting - Cage Cleaning - S</td>
                      <td className="py-3 px-4 text-slate-600">Additional Services</td>
                      <td className="py-3 px-4 text-slate-600">Per Cage</td>
                      <td className="py-3 px-4 font-mono text-slate-600">&lt; 10 kg</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-slate-400">RM</span>
                          <input
                            type="number"
                            min="0"
                            value={sittingConfig.addons.cageCleaningS}
                            onChange={(e) =>
                              setSittingConfig((prev) => ({
                                ...prev,
                                addons: { ...prev.addons, cageCleaningS: Number(e.target.value) },
                              }))
                            }
                            className="w-20 px-2 py-1 rounded-lg border border-slate-300 font-bold text-amber-700 text-right text-xs"
                          />
                        </div>
                      </td>
                    </tr>

                    {/* PS-C02 */}
                    <tr className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">PS-C02</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">Pet Sitting - Cage Cleaning - M</td>
                      <td className="py-3 px-4 text-slate-600">Additional Services</td>
                      <td className="py-3 px-4 text-slate-600">Per Cage</td>
                      <td className="py-3 px-4 font-mono text-slate-600">10 - 30 kg</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-slate-400">RM</span>
                          <input
                            type="number"
                            min="0"
                            value={sittingConfig.addons.cageCleaningM}
                            onChange={(e) =>
                              setSittingConfig((prev) => ({
                                ...prev,
                                addons: { ...prev.addons, cageCleaningM: Number(e.target.value) },
                              }))
                            }
                            className="w-20 px-2 py-1 rounded-lg border border-slate-300 font-bold text-amber-700 text-right text-xs"
                          />
                        </div>
                      </td>
                    </tr>

                    {/* PS-C03 */}
                    <tr className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">PS-C03</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">Pet Sitting - Cage Cleaning - L</td>
                      <td className="py-3 px-4 text-slate-600">Additional Services</td>
                      <td className="py-3 px-4 text-slate-600">Per Cage</td>
                      <td className="py-3 px-4 font-mono text-slate-600">&gt; 30 kg</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-slate-400">RM</span>
                          <input
                            type="number"
                            min="0"
                            value={sittingConfig.addons.cageCleaningL}
                            onChange={(e) =>
                              setSittingConfig((prev) => ({
                                ...prev,
                                addons: { ...prev.addons, cageCleaningL: Number(e.target.value) },
                              }))
                            }
                            className="w-20 px-2 py-1 rounded-lg border border-slate-300 font-bold text-amber-700 text-right text-xs"
                          />
                        </div>
                      </td>
                    </tr>

                    {/* PS-C04 */}
                    <tr className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">PS-C04</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">Pet Sitting - Cleaning - Living Room</td>
                      <td className="py-3 px-4 text-slate-600">Additional Services</td>
                      <td className="py-3 px-4 text-slate-600">Per Visit</td>
                      <td className="py-3 px-4 text-slate-400">—</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-slate-400">RM</span>
                          <input
                            type="number"
                            min="0"
                            value={sittingConfig.addons.cleanLivingRoom}
                            onChange={(e) =>
                              setSittingConfig((prev) => ({
                                ...prev,
                                addons: { ...prev.addons, cleanLivingRoom: Number(e.target.value) },
                              }))
                            }
                            className="w-20 px-2 py-1 rounded-lg border border-slate-300 font-bold text-amber-700 text-right text-xs"
                          />
                        </div>
                      </td>
                    </tr>

                    {/* PS-C05 */}
                    <tr className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">PS-C05</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">Pet Sitting - Cleaning - Bedroom</td>
                      <td className="py-3 px-4 text-slate-600">Additional Services</td>
                      <td className="py-3 px-4 text-slate-600">Per Visit</td>
                      <td className="py-3 px-4 text-slate-400">—</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-slate-400">RM</span>
                          <input
                            type="number"
                            min="0"
                            value={sittingConfig.addons.cleanBedroom}
                            onChange={(e) =>
                              setSittingConfig((prev) => ({
                                ...prev,
                                addons: { ...prev.addons, cleanBedroom: Number(e.target.value) },
                              }))
                            }
                            className="w-20 px-2 py-1 rounded-lg border border-slate-300 font-bold text-amber-700 text-right text-xs"
                          />
                        </div>
                      </td>
                    </tr>

                    {/* PS-C06 */}
                    <tr className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">PS-C06</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">Pet Sitting - Cleaning - Kitchen</td>
                      <td className="py-3 px-4 text-slate-600">Additional Services</td>
                      <td className="py-3 px-4 text-slate-600">Per Visit</td>
                      <td className="py-3 px-4 text-slate-400">—</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-slate-400">RM</span>
                          <input
                            type="number"
                            min="0"
                            value={sittingConfig.addons.cleanKitchen}
                            onChange={(e) =>
                              setSittingConfig((prev) => ({
                                ...prev,
                                addons: { ...prev.addons, cleanKitchen: Number(e.target.value) },
                              }))
                            }
                            className="w-20 px-2 py-1 rounded-lg border border-slate-300 font-bold text-amber-700 text-right text-xs"
                          />
                        </div>
                      </td>
                    </tr>

                    {/* PS-C07 */}
                    <tr className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">PS-C07</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">Pet Sitting - Cleaning - Carpark Area</td>
                      <td className="py-3 px-4 text-slate-600">Additional Services</td>
                      <td className="py-3 px-4 text-slate-600">Per Visit</td>
                      <td className="py-3 px-4 text-slate-400">—</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-slate-400">RM</span>
                          <input
                            type="number"
                            min="0"
                            value={sittingConfig.addons.cleanCarpark}
                            onChange={(e) =>
                              setSittingConfig((prev) => ({
                                ...prev,
                                addons: { ...prev.addons, cleanCarpark: Number(e.target.value) },
                              }))
                            }
                            className="w-20 px-2 py-1 rounded-lg border border-slate-300 font-bold text-amber-700 text-right text-xs"
                          />
                        </div>
                      </td>
                    </tr>

                    {/* S-PP */}
                    <tr className="hover:bg-slate-50/70 bg-rose-50/30">
                      <td className="py-3 px-4 font-mono font-bold text-rose-900">S-PP</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">Peak Period Surcharge</td>
                      <td className="py-3 px-4 text-rose-800">Surcharge</td>
                      <td className="py-3 px-4 text-slate-600">Per Order</td>
                      <td className="py-3 px-4 text-slate-400">—</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-slate-400">RM</span>
                          <input
                            type="number"
                            min="0"
                            value={sittingConfig.peakSurcharge}
                            onChange={(e) =>
                              setSittingConfig((prev) => ({
                                ...prev,
                                peakSurcharge: Number(e.target.value),
                              }))
                            }
                            className="w-20 px-2 py-1 rounded-lg border border-slate-300 font-bold text-rose-700 text-right text-xs"
                          />
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* CARDS VIEW */
            <div className="space-y-6">
              {/* Card Group 1: 1st Pet Base Rates */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span>🐕</span> 1st Pet Base Session Rates (Determined by Biggest Pet)
                  </h3>
                  <span className="text-[10px] text-amber-900 bg-amber-100 font-semibold px-2 py-0.5 rounded-full">
                    PS01 - PS03
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                    <span className="font-mono text-[10px] text-slate-500">PS01 • &lt; 10 kg (Small)</span>
                    <label className="block font-bold text-slate-900 text-xs">Pet Sitting - S</label>
                    <div className="flex items-center gap-1 pt-1">
                      <span className="text-slate-400 text-xs">RM</span>
                      <input
                        type="number"
                        min="0"
                        value={sittingConfig.baseRates.small}
                        onChange={(e) =>
                          setSittingConfig((prev) => ({
                            ...prev,
                            baseRates: { ...prev.baseRates, small: Number(e.target.value) },
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold text-amber-700 text-sm"
                      />
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                    <span className="font-mono text-[10px] text-slate-500">PS02 • 10 - 30 kg (Medium)</span>
                    <label className="block font-bold text-slate-900 text-xs">Pet Sitting - M</label>
                    <div className="flex items-center gap-1 pt-1">
                      <span className="text-slate-400 text-xs">RM</span>
                      <input
                        type="number"
                        min="0"
                        value={sittingConfig.baseRates.medium}
                        onChange={(e) =>
                          setSittingConfig((prev) => ({
                            ...prev,
                            baseRates: { ...prev.baseRates, medium: Number(e.target.value) },
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold text-amber-700 text-sm"
                      />
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                    <span className="font-mono text-[10px] text-slate-500">PS03 • &gt; 30 kg (Large / XL)</span>
                    <label className="block font-bold text-slate-900 text-xs">Pet Sitting - L / XL</label>
                    <div className="flex items-center gap-1 pt-1">
                      <span className="text-slate-400 text-xs">RM</span>
                      <input
                        type="number"
                        min="0"
                        value={sittingConfig.baseRates.largeXl}
                        onChange={(e) =>
                          setSittingConfig((prev) => ({
                            ...prev,
                            baseRates: { ...prev.baseRates, largeXl: Number(e.target.value) },
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold text-amber-700 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Group 2: Extra Pet Rates */}
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-3">
                <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                  <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span>➕</span> Extra Pet Rates (Smaller / Subsequent Pets)
                  </h3>
                  <span className="text-[10px] text-amber-900 bg-amber-100 font-semibold px-2 py-0.5 rounded-full">
                    PS04 - PS05 • Per Pet (Max. 3)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white p-3 rounded-lg border border-amber-200 space-y-1">
                    <span className="font-mono text-[10px] text-slate-500">PS04 • &lt; 25 kg (Small / Medium Extra Pet)</span>
                    <label className="block font-bold text-slate-900 text-xs">Extra Pet (&lt; 25kg)</label>
                    <div className="flex items-center gap-1 pt-1">
                      <span className="text-slate-400 text-xs">RM</span>
                      <input
                        type="number"
                        min="0"
                        value={sittingConfig.extraPetRates.under25kg}
                        onChange={(e) =>
                          setSittingConfig((prev) => ({
                            ...prev,
                            extraPetRates: { ...prev.extraPetRates, under25kg: Number(e.target.value) },
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold text-amber-800 text-sm"
                      />
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-amber-200 space-y-1">
                    <span className="font-mono text-[10px] text-slate-500">PS05 • &gt; 25 kg (Large Extra Pet)</span>
                    <label className="block font-bold text-slate-900 text-xs">Extra Pet (&gt; 25kg)</label>
                    <div className="flex items-center gap-1 pt-1">
                      <span className="text-slate-400 text-xs">RM</span>
                      <input
                        type="number"
                        min="0"
                        value={sittingConfig.extraPetRates.over25kg}
                        onChange={(e) =>
                          setSittingConfig((prev) => ({
                            ...prev,
                            extraPetRates: { ...prev.extraPetRates, over25kg: Number(e.target.value) },
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold text-amber-800 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Group 3: Additional Services & Add-ons */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span>✨</span> Pet Sitting Additional Services &amp; Add-ons
                  </h3>
                  <span className="text-[10px] text-slate-600 bg-slate-200 font-semibold px-2 py-0.5 rounded-full">
                    PS-W to PS-C07
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="font-mono text-[10px] text-slate-500 block">PS-W • Every 10 min</span>
                    <label className="font-bold text-slate-800 block mb-1">Dog Walk</label>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">RM</span>
                      <input
                        type="number"
                        min="0"
                        value={sittingConfig.addons.walkPer10Min}
                        onChange={(e) =>
                          setSittingConfig((prev) => ({
                            ...prev,
                            addons: { ...prev.addons, walkPer10Min: Number(e.target.value) },
                          }))
                        }
                        className="w-full px-2 py-1 rounded border border-slate-300 font-bold text-amber-700"
                      />
                    </div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="font-mono text-[10px] text-slate-500 block">PS-MF • Per Time</span>
                    <label className="font-bold text-slate-800 block mb-1">Medication Feeding</label>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">RM</span>
                      <input
                        type="number"
                        min="0"
                        value={sittingConfig.addons.medFeedPerTime}
                        onChange={(e) =>
                          setSittingConfig((prev) => ({
                            ...prev,
                            addons: { ...prev.addons, medFeedPerTime: Number(e.target.value) },
                          }))
                        }
                        className="w-full px-2 py-1 rounded border border-slate-300 font-bold text-amber-700"
                      />
                    </div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="font-mono text-[10px] text-slate-500 block">PS-FF • Per Time</span>
                    <label className="font-bold text-slate-800 block mb-1">Fresh Food Cooking</label>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">RM</span>
                      <input
                        type="number"
                        min="0"
                        value={sittingConfig.addons.freshFoodPerTime}
                        onChange={(e) =>
                          setSittingConfig((prev) => ({
                            ...prev,
                            addons: { ...prev.addons, freshFoodPerTime: Number(e.target.value) },
                          }))
                        }
                        className="w-full px-2 py-1 rounded border border-slate-300 font-bold text-amber-700"
                      />
                    </div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-rose-200">
                    <span className="font-mono text-[10px] text-rose-600 block">S-PP • Per Order</span>
                    <label className="font-bold text-slate-800 block mb-1">Peak Surcharge</label>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">RM</span>
                      <input
                        type="number"
                        min="0"
                        value={sittingConfig.peakSurcharge}
                        onChange={(e) =>
                          setSittingConfig((prev) => ({
                            ...prev,
                            peakSurcharge: Number(e.target.value),
                          }))
                        }
                        className="w-full px-2 py-1 rounded border border-rose-300 font-bold text-rose-700"
                      />
                    </div>
                  </div>

                  {/* Cage Cleanings */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="font-mono text-[10px] text-slate-500 block">PS-C01 • Per Cage</span>
                    <label className="font-bold text-slate-800 block mb-1">Cage Cleaning - S</label>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">RM</span>
                      <input
                        type="number"
                        min="0"
                        value={sittingConfig.addons.cageCleaningS}
                        onChange={(e) =>
                          setSittingConfig((prev) => ({
                            ...prev,
                            addons: { ...prev.addons, cageCleaningS: Number(e.target.value) },
                          }))
                        }
                        className="w-full px-2 py-1 rounded border border-slate-300 font-bold text-amber-700"
                      />
                    </div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="font-mono text-[10px] text-slate-500 block">PS-C02 • Per Cage</span>
                    <label className="font-bold text-slate-800 block mb-1">Cage Cleaning - M</label>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">RM</span>
                      <input
                        type="number"
                        min="0"
                        value={sittingConfig.addons.cageCleaningM}
                        onChange={(e) =>
                          setSittingConfig((prev) => ({
                            ...prev,
                            addons: { ...prev.addons, cageCleaningM: Number(e.target.value) },
                          }))
                        }
                        className="w-full px-2 py-1 rounded border border-slate-300 font-bold text-amber-700"
                      />
                    </div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="font-mono text-[10px] text-slate-500 block">PS-C03 • Per Cage</span>
                    <label className="font-bold text-slate-800 block mb-1">Cage Cleaning - L</label>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">RM</span>
                      <input
                        type="number"
                        min="0"
                        value={sittingConfig.addons.cageCleaningL}
                        onChange={(e) =>
                          setSittingConfig((prev) => ({
                            ...prev,
                            addons: { ...prev.addons, cageCleaningL: Number(e.target.value) },
                          }))
                        }
                        className="w-full px-2 py-1 rounded border border-slate-300 font-bold text-amber-700"
                      />
                    </div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="font-mono text-[10px] text-slate-500 block">PS-C04 • Per Visit</span>
                    <label className="font-bold text-slate-800 block mb-1">Cleaning - Living Room</label>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">RM</span>
                      <input
                        type="number"
                        min="0"
                        value={sittingConfig.addons.cleanLivingRoom}
                        onChange={(e) =>
                          setSittingConfig((prev) => ({
                            ...prev,
                            addons: { ...prev.addons, cleanLivingRoom: Number(e.target.value) },
                          }))
                        }
                        className="w-full px-2 py-1 rounded border border-slate-300 font-bold text-amber-700"
                      />
                    </div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="font-mono text-[10px] text-slate-500 block">PS-C05 • Per Room</span>
                    <label className="font-bold text-slate-800 block mb-1">Cleaning - Bedroom</label>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">RM</span>
                      <input
                        type="number"
                        min="0"
                        value={sittingConfig.addons.cleanBedroom}
                        onChange={(e) =>
                          setSittingConfig((prev) => ({
                            ...prev,
                            addons: { ...prev.addons, cleanBedroom: Number(e.target.value) },
                          }))
                        }
                        className="w-full px-2 py-1 rounded border border-slate-300 font-bold text-amber-700"
                      />
                    </div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="font-mono text-[10px] text-slate-500 block">PS-C06 • Per Visit</span>
                    <label className="font-bold text-slate-800 block mb-1">Cleaning - Kitchen</label>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">RM</span>
                      <input
                        type="number"
                        min="0"
                        value={sittingConfig.addons.cleanKitchen}
                        onChange={(e) =>
                          setSittingConfig((prev) => ({
                            ...prev,
                            addons: { ...prev.addons, cleanKitchen: Number(e.target.value) },
                          }))
                        }
                        className="w-full px-2 py-1 rounded border border-slate-300 font-bold text-amber-700"
                      />
                    </div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="font-mono text-[10px] text-slate-500 block">PS-C07 • Per Visit</span>
                    <label className="font-bold text-slate-800 block mb-1">Cleaning - Carpark Area</label>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">RM</span>
                      <input
                        type="number"
                        min="0"
                        value={sittingConfig.addons.cleanCarpark}
                        onChange={(e) =>
                          setSittingConfig((prev) => ({
                            ...prev,
                            addons: { ...prev.addons, cleanCarpark: Number(e.target.value) },
                          }))
                        }
                        className="w-full px-2 py-1 rounded border border-slate-300 font-bold text-amber-700"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: DAY CARE PRICING & PLANS */}
      {activeTab === 'daycare' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                Day Care Pricing &amp; Plans
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Configure full-day care daily rates and monthly packages across all pet weight categories (S, M, L, XL, XXL).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetDayCareConfig}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Defaults
              </button>
              <button
                type="button"
                onClick={handleSaveDayCareConfig}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                Save Day Care Rates
              </button>
            </div>
          </div>

          {/* View Mode Toggle: List (Default) vs Cards */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Rates apply automatically to customer Day Care bookings and quotes.
            </div>
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setDayCareViewMode('list')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  dayCareViewMode === 'list'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                List View
              </button>
              <button
                type="button"
                onClick={() => setDayCareViewMode('cards')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  dayCareViewMode === 'cards'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Cards View
              </button>
            </div>
          </div>

          {/* List or Cards View */}
          {dayCareViewMode === 'list' ? (
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4">Weight Tier / Category</th>
                      <th className="py-3 px-4">Daily Rate (RM / day)</th>
                      <th className="py-3 px-4">Monthly Rate (RM / month)</th>
                      <th className="py-3 px-4">Customer Formula Preview</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dayCareConfig.tiers.map((tier, idx) => (
                      <tr key={tier.code} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                          {tier.code}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900">{tier.name}</span>
                          <span className="block text-[11px] text-slate-500 font-mono">{tier.weightBracket}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 font-bold">RM</span>
                            <input
                              type="number"
                              min="0"
                              value={tier.dailyRate}
                              onChange={(e) => handleEditDayCareTier(idx, 'dailyRate', Number(e.target.value))}
                              className="w-20 px-2 py-1 rounded-lg border border-slate-300 bg-white font-black text-amber-700 text-xs"
                            />
                            <span className="text-slate-400 text-[11px]">/ day</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 font-bold">RM</span>
                            <input
                              type="number"
                              min="0"
                              value={tier.monthlyRate}
                              onChange={(e) => handleEditDayCareTier(idx, 'monthlyRate', Number(e.target.value))}
                              className="w-24 px-2 py-1 rounded-lg border border-slate-300 bg-white font-black text-slate-900 text-xs"
                            />
                            <span className="text-slate-400 text-[11px]">/ mo</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          <span className="font-medium bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/60 text-amber-900 inline-block">
                            Daily: <strong>RM {tier.dailyRate}</strong> • Monthly: <strong>RM {tier.monthlyRate}</strong>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dayCareConfig.tiers.map((tier, idx) => (
                <div key={tier.code} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                      {tier.code}
                    </span>
                    <span className="text-xs font-bold text-slate-900">{tier.weightBracket}</span>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 text-xs mb-1">Tier Name</label>
                    <div className="font-bold text-slate-900 text-sm">{tier.name}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 text-xs mb-1">Daily Rate</label>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 font-bold text-xs">RM</span>
                        <input
                          type="number"
                          min="0"
                          value={tier.dailyRate}
                          onChange={(e) => handleEditDayCareTier(idx, 'dailyRate', Number(e.target.value))}
                          className="w-full px-2 py-1 rounded-lg border border-slate-300 bg-white font-black text-amber-700 text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 text-xs mb-1">Monthly Package</label>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 font-bold text-xs">RM</span>
                        <input
                          type="number"
                          min="0"
                          value={tier.monthlyRate}
                          onChange={(e) => handleEditDayCareTier(idx, 'monthlyRate', Number(e.target.value))}
                          className="w-full px-2 py-1 rounded-lg border border-slate-300 bg-white font-black text-slate-900 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Explicit Save Bar */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Click to save and instantly update the customer booking portal Day Care rates.
            </span>
            <button
              type="button"
              onClick={handleSaveDayCareConfig}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Day Care Rates
            </button>
          </div>
        </div>
      )}

      {/* TAB: PET TAXI PRICING & FUEL RATES */}
      {activeTab === 'taxi' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Car className="w-5 h-5 text-amber-600" />
                Pet Taxi Pricing &amp; Fuel Rates
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Configure pick-up / drop-off base rates by pet size (T01-T03) and distance fuel charge per kilometer (FC).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetTaxiConfig}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Defaults
              </button>
              <button
                type="button"
                onClick={handleSaveTaxiConfig}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                Save Pet Taxi Rates
              </button>
            </div>
          </div>

          {/* Fuel Surcharge Configuration Banner */}
          <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-2xl p-2 bg-white rounded-xl border border-amber-200 shadow-xs">⛽</span>
              <div>
                <div className="font-bold text-slate-900 text-sm">FC: Fuel Mileage Surcharge</div>
                <div className="text-slate-600 text-[11px] mt-0.5">
                  Calculated dynamically on customer portal based on total distance (KM) per trip.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-amber-200 shrink-0">
              <span className="font-bold text-slate-700 text-xs">Rate per KM:</span>
              <div className="flex items-center">
                <span className="text-slate-400 font-bold mr-1 text-xs">RM</span>
                <input
                  type="number"
                  min="0"
                  value={taxiConfig.fuelChargePerKm}
                  onChange={(e) => handleEditFuelCharge(Number(e.target.value))}
                  className="w-14 font-black text-amber-700 text-sm text-center outline-none bg-slate-50 py-0.5 rounded border border-slate-200"
                />
                <span className="text-slate-500 text-[11px] ml-1">/ KM</span>
              </div>
            </div>
          </div>

          {/* View Mode Toggle: List (Default) vs Cards */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Base rates charged per pet according to pet size category.
            </div>
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setTaxiViewMode('list')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  taxiViewMode === 'list'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                List View
              </button>
              <button
                type="button"
                onClick={() => setTaxiViewMode('cards')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  taxiViewMode === 'cards'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Cards View
              </button>
            </div>
          </div>

          {/* List or Cards View */}
          {taxiViewMode === 'list' ? (
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4">Service Tier &amp; Pet Size</th>
                      <th className="py-3 px-4">Base Rate (RM / pet)</th>
                      <th className="py-3 px-4">Example Formula (5 KM trip)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {taxiConfig.tiers.map((tier, idx) => (
                      <tr key={tier.code} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                          {tier.code}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900">{tier.name}</span>
                          <span className="block text-[11px] text-slate-500 font-mono">{tier.weightBracket}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 font-bold">RM</span>
                            <input
                              type="number"
                              min="0"
                              value={tier.basePrice}
                              onChange={(e) => handleEditTaxiTier(idx, Number(e.target.value))}
                              className="w-20 px-2 py-1 rounded-lg border border-slate-300 bg-white font-black text-amber-700 text-xs"
                            />
                            <span className="text-slate-400 text-[11px]">/ pet</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          <span className="font-medium bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/60 text-amber-900 inline-block">
                            RM {tier.basePrice} + (5 km × RM {taxiConfig.fuelChargePerKm}) = <strong>RM {tier.basePrice + 5 * taxiConfig.fuelChargePerKm}</strong>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {taxiConfig.tiers.map((tier, idx) => (
                <div key={tier.code} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                      {tier.code}
                    </span>
                    <span className="text-xs font-bold text-slate-900">{tier.weightBracket}</span>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 text-xs mb-1">Service Tier</label>
                    <div className="font-bold text-slate-900 text-xs leading-snug">{tier.name}</div>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 text-xs mb-1">Base Price (RM/pet)</label>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 font-bold text-xs">RM</span>
                      <input
                        type="number"
                        min="0"
                        value={tier.basePrice}
                        onChange={(e) => handleEditTaxiTier(idx, Number(e.target.value))}
                        className="w-full px-2 py-1 rounded-lg border border-slate-300 bg-white font-black text-amber-700 text-xs"
                      />
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                    5 KM Trip: RM {tier.basePrice + 5 * taxiConfig.fuelChargePerKm}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Explicit Save Bar */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Click to save and instantly update the customer booking portal Pet Taxi rates.
            </span>
            <button
              type="button"
              onClick={handleSaveTaxiConfig}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Pet Taxi Rates
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: DEPOSIT FORMULA & ONLINE PAYMENT GATE */}
      {activeTab === 'deposit' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-amber-600" />
              Deposit Formula & Online Payment Gate
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Control whether customers pay online deposits upfront or submit free bookings directed to store WhatsApp.
            </p>
          </div>

          {/* Online Payment Gate (Open vs Closed) */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-800">
                  Customer Online Payment Status
                </span>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 mt-0.5">
                  {systemConfig.onlinePaymentEnabled ? (
                    <>
                      <ToggleRight className="w-6 h-6 text-emerald-600" />
                      <span className="text-emerald-700">Online Payment is OPEN (Active)</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-6 h-6 text-slate-400" />
                      <span className="text-slate-700">Online Payment is CLOSED (No Upfront Payment)</span>
                    </>
                  )}
                </h3>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
    try {

                    await updateSystemConfig({ onlinePaymentEnabled: false });
                    triggerSaved('Online payment gate set to CLOSED');
                  
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
}}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    !systemConfig.onlinePaymentEnabled
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Close Payment Gate
                </button>
                <button
                  type="button"
                  onClick={async () => {
    try {

                    await updateSystemConfig({ onlinePaymentEnabled: true });
                    triggerSaved('Online payment gate set to OPEN');
                  
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
}}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    systemConfig.onlinePaymentEnabled
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Open Online Payment
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {!systemConfig.onlinePaymentEnabled ? (
                <span>
                  <strong>Currently:</strong> The customer booking portal hides Maybank details and upload slips. Customers submit directly with 0 upfront payment requirement and are prompted to contact shop WhatsApp to arrange their deposit payment.
                </span>
              ) : (
                <span>
                  <strong>Currently:</strong> The customer booking portal displays Maybank bank account details & DuitNow QR and allows customers to upload payment receipt slips for verification.
                </span>
              )}
            </p>
          </div>

          {/* Deposit Formula Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Minimum Deposit for Small Orders (&lt; Threshold)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-500">RM</span>
                <input
                  type="number"
                  value={systemConfig.depositConfig.minDepositAmount}
                  onChange={async (e) => {
    try {

                    await updateSystemConfig({
                      depositConfig: {
                        ...systemConfig.depositConfig,
                        minDepositAmount: Number(e.target.value),
                      },
                    });
                  
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
}}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Threshold Amount for Percentage Deposit
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-500">RM</span>
                <input
                  type="number"
                  value={systemConfig.depositConfig.percentageThreshold}
                  onChange={async (e) => {
    try {

                    await updateSystemConfig({
                      depositConfig: {
                        ...systemConfig.depositConfig,
                        percentageThreshold: Number(e.target.value),
                      },
                    });
                  
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
}}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Percentage Rate for Orders &ge; Threshold
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.05"
                  value={systemConfig.depositConfig.percentageRate}
                  onChange={async (e) => {
    try {

                    await updateSystemConfig({
                      depositConfig: {
                        ...systemConfig.depositConfig,
                        percentageRate: Number(e.target.value),
                      },
                    });
                  
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
}}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-bold"
                />
                <span className="text-sm font-bold text-slate-500">
                  ({Math.round(systemConfig.depositConfig.percentageRate * 100)}%)
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Peak Season Surcharge
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-500">RM</span>
                <input
                  type="number"
                  value={systemConfig.depositConfig.peakSurcharge}
                  onChange={async (e) => {
    try {

                    await updateSystemConfig({
                      depositConfig: {
                        ...systemConfig.depositConfig,
                        peakSurcharge: Number(e.target.value),
                      },
                    });
                  
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
}}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-bold"
                />
              </div>
            </div>
          </div>

          {/* Explicit Save Bar */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">Choose Save to apply these settings.</span>
            <button
              type="button"
              onClick={() => triggerSaved('Deposit and payment gate settings updated successfully!')}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Payment & Deposit Settings
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: STAFF ACCOUNTS & LOGIN CREDENTIALS */}
      {activeTab === 'staff' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-600" />
              Staff Accounts & Security Login Credentials
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Manage operational staff accounts and customize login credentials for Staff and Boss portals.
            </p>
          </div>

          {/* Local demo credentials; cloud accounts are managed individually below. */}
          {dataMode === 'demo' && <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-600" />
              Portal Login Credentials (Customizable by Boss)
            </h3>
            <p className="text-xs text-slate-600">Passwords and PINs are saved as salted hashes and are never shown here. Leave them blank to keep the current credentials. These credentials apply only to the local demo. Cloud accounts use server verification.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              {/* Staff Portal Credentials */}
              <div className="bg-white p-4 rounded-xl border border-blue-200 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="font-bold text-blue-900 text-sm">Staff Portal Login</span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                    Role: Staff
                  </span>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Staff Username</label>
                  <input
                    type="text"
                    value={staffUsername}
                    onChange={(e) => setStaffUsername(e.target.value)}
                    placeholder="e.g. staff"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Staff PIN / Password</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={staffPin}
                    onChange={(e) => setStaffPin(e.target.value)}
                    placeholder="Leave blank to keep current PIN"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Boss Master Credentials */}
              <div className="bg-white p-4 rounded-xl border border-amber-200 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="font-bold text-amber-900 text-sm">Boss Master Login</span>
                  <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                    Role: Boss (Admin)
                  </span>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Boss Username</label>
                  <input
                    type="text"
                    value={bossUsername}
                    onChange={(e) => setBossUsername(e.target.value)}
                    placeholder="e.g. admin"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Boss Master Password</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={bossPassword}
                    onChange={(e) => setBossPassword(e.target.value)}
                    placeholder="Leave blank to keep current password"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSaveCredentials}
                className="px-6 py-2.5 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Login Credentials
              </button>
            </div>
          </div>

          }
          {/* Section 1.5: Staff Store Credit Action Permissions */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-amber-600" />
                  Staff Store Credit Management Access
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Choose whether staff members can top-up and adjust customer store credits, or view-only.
                </p>
              </div>

              <button
                type="button"
                onClick={async () => {
    try {

                  const current = Boolean(systemConfig.staffCanManageCredit);
                  await updateSystemConfig({ staffCanManageCredit: !current });
                  triggerSaved(current ? 'Staff credit access set to VIEW ONLY' : 'Staff credit access set to FULL ACTION');
                
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
}}
                className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                  systemConfig.staffCanManageCredit
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 border border-slate-300'
                }`}
              >
                {systemConfig.staffCanManageCredit ? 'Full Action Allowed for Staff' : 'Locked (View-Only for Staff)'}
              </button>
            </div>
          </div>

          <StaffAccountSettings />
        </div>
      )}

      {/* TAB 6: SHOP LOGO & BANK PROFILE */}
      {activeTab === 'shop' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-amber-600" />
            Store Logo, Branding & Bank Profile
          </h2>
          <p className="text-xs text-slate-500">
            Upload your custom store logo and set payment details.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            {/* Custom Logo Upload */}
            <div className="sm:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-slate-800">Custom Store Logo</label>
              <div className="flex items-center gap-4">
                {systemConfig.logoUrl ? (
                  <img src={systemConfig.logoUrl} alt="Logo" className="w-14 h-14 rounded-xl object-cover border" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800 font-bold text-xs">
                    No Logo
                  </div>
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    id="logo-upload"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if(file.size>1_000_000){alert('Logo must be no larger than 1 MB.');return;}
                        const reader = new FileReader();
                        reader.onloadend = async () => {
    try {

                          await updateSystemConfig({ logoUrl: reader.result as string });
                          triggerSaved('Custom logo uploaded');
                        
    } catch (error) { alert(error instanceof Error ? error.message : "The save failed."); }
};
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="text-xs text-slate-600"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">PNG, JPG or SVG logo</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Display Shop Name</label>
              <input
                type="text"
                value={systemConfig.shopName}
                onChange={async (e) => await updateSystemConfig({ shopName: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
              />
              <span className="text-[10px] text-slate-400">Default: Pet Loft</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Official Legal Name (Invoices)</label>
              <input
                type="text"
                value={systemConfig.legalShopName || 'MELLOW PET LOFT CONCEPT STORE'}
                onChange={async (e) => await updateSystemConfig({ legalShopName: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
              />
              <span className="text-[10px] text-slate-400">Printed strictly on Invoices & Receipts</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">SSM Registration No.</label>
              <input
                type="text"
                value={systemConfig.ssmNumber}
                onChange={async (e) => await updateSystemConfig({ ssmNumber: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Store WhatsApp Phone</label>
              <input
                type="text"
                value={systemConfig.phone}
                onChange={async (e) => await updateSystemConfig({ phone: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Shop Address</label>
              <input
                type="text"
                value={systemConfig.address}
                onChange={async (e) => await updateSystemConfig({ address: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Bank Name</label>
              <input
                type="text"
                value={systemConfig.bankName}
                onChange={async (e) => await updateSystemConfig({ bankName: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Maybank Account Number</label>
              <input
                type="text"
                value={systemConfig.accountNumber}
                onChange={async (e) => await updateSystemConfig({ accountNumber: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono font-bold"
              />
            </div>
          </div>

          {/* Explicit Save Bar */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">Logo and branding updates apply across the system.</span>
            <button
              type="button"
              onClick={() => triggerSaved('Shop branding and bank profile updated successfully!')}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Shop Profile
            </button>
          </div>
        </div>
      )}

      {activeTab === 'kennels' && <PhysicalKennelSettings />}
      {activeTab === 'receipts' && <ReceiptFormatSettings />}
      {activeTab === 'backup' && <SheetConnectionSettings />}

    </div>
  );
};
