import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Booking, 
  Customer, 
  Room, 
  ServiceItem, 
  StoreCreditRecord, 
  StaffAccount, 
  SystemConfig, 
  UserRole,
  PaymentStatus,
  BookingPet,
  RoomAssignmentRule,
  SpeciesType,
  CustomerBoardingRoom,
  CustomerBookingInput,
  ManualBookingInput
} from '../types';
import { 
  initialBookings, 
  initialCustomers, 
  initialRooms, 
  initialServices, 
  initialStoreCreditRecords, 
  initialStaff, 
  initialSystemConfig,
  defaultCustomerBoardingRooms,
  defaultPetSittingConfig,
  defaultDayCareConfig,
  defaultPetTaxiConfig
} from '../data/seedData';

import { allocateBoardingRooms, normalizePendingDeposit, recordSettlement, reviewDeposit, validateRoomAssignments } from '../lib/bookingLogic';

import { buildCustomerRecord, normalizeCustomerContact, validateManualBooking } from '../lib/manualEntry';
import type { NewCustomerInput } from '../lib/manualEntry';
import { canManageCredit, resolveRoomInventory, validateGroomingCapacity, validateReceiptDataUrl } from '../lib/systemRules';
import { hashCredential, migrateCredentials, verifyCredential } from '../lib/credentials';
import { cloudMode, cloudRequest, cloudCommand, uploadReceipt, type CloudSnapshot } from '../lib/cloudApi';
import { defaultGroomingPricing, defaultReceiptConfig, quoteBooking, quoteDeposit } from '../lib/pricing';

interface AppContextType {
  dataMode: 'cloud' | 'demo';
  dataStatus: 'loading' | 'ready' | 'saving' | 'error';
  dataError: string | null;
  sheetPrepared: boolean;
  refreshData: () => Promise<void>;
  dismissDataError: () => void;
  checkSheetConnection: (url: string) => Promise<{prepared:boolean;counts:{bookings:number;customers:number;credits:number};serviceAccount:string}>;
  connectSheet: (url: string, prepare: boolean) => Promise<void>;
  savePhysicalRooms: (rooms: Room[]) => Promise<void>;
  saveStaffAccount: (account: StaffAccount & {password?:string}) => Promise<void>;
  lookupBooking: (reference: string, contact: string) => Promise<Booking[]>;

  role: UserRole;
  setRole: (role: UserRole) => void;
  activeStaff: StaffAccount;
  setActiveStaff: (staff: StaffAccount) => void;

  // Authentication
  isStaffLoggedIn: boolean;
  isBossLoggedIn: boolean;
  loginStaff: (username: string, pin: string) => Promise<boolean>;
  loginBoss: (username: string, password: string) => Promise<boolean>;
  saveCredentials: (staffUsername: string, staffPin: string, bossUsername: string, bossPassword: string) => Promise<void>;
  logout: () => void;

  bookings: Booking[];
  customers: Customer[];
  rooms: Room[];
  services: ServiceItem[];
  storeCredits: StoreCreditRecord[];
  staffMembers: StaffAccount[];
  systemConfig: SystemConfig;

  // Actions
  createCustomerBooking: (data: CustomerBookingInput) => Promise<Booking>;
  createManualBooking: (data: ManualBookingInput) => Promise<Booking>;
  createCustomer: (data: NewCustomerInput) => Promise<Customer>;

  updateBooking: (id: string, updates: Partial<Booking>) => Promise<void>;
  deleteBooking: (id: string) => Promise<void>;
  verifyDeposit: (id: string, approved: boolean, depositAmountPaid?: number) => Promise<void>;
  settlePickupBalance: (id: string, paymentMethod: string, amount: number) => Promise<void>;
  assignRoomToPet: (bookingId: string, petIndex: number, roomNumber: string) => Promise<void>;
  
  // Store Credit Actions
  addStoreCreditRecord: (record: Omit<StoreCreditRecord, 'id'>) => Promise<void>;
  updateStoreCreditRecord: (id: string, updates: Partial<StoreCreditRecord>) => Promise<void>;
  applyStoreCreditToBooking: (bookingId: string, creditAmount: number) => Promise<boolean>;

  // Customer Actions
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;

  // Boss Config & Staff
  updateSystemConfig: (updates: Partial<SystemConfig>) => Promise<void>;
  addStaffMember: (member: Omit<StaffAccount, 'id'>) => Promise<void>;
  updateStaffMember: (id: string, updates: Partial<StaffAccount>) => Promise<void>;
  deleteStaffMember: (id: string) => Promise<void>;

  // Room Assignment Rules Editor & Reordering
  addRoomAssignmentRule: (rule: Omit<RoomAssignmentRule, 'id'>) => Promise<void>;
  updateRoomAssignmentRule: (id: string, updates: Partial<RoomAssignmentRule>) => Promise<void>;
  deleteRoomAssignmentRule: (id: string) => Promise<void>;
  moveRoomAssignmentRule: (index: number, direction: 'up' | 'down') => Promise<void>;

  // Customer Boarding Room Types (Customer Side Configuration)
  updateCustomerBoardingRoom: (room: CustomerBoardingRoom) => Promise<void>;
  addCustomerBoardingRoom: (room: CustomerBoardingRoom) => Promise<void>;
  deleteCustomerBoardingRoom: (id: string, species: SpeciesType) => Promise<void>;
  resetCustomerBoardingRooms: () => Promise<void>;

  // Time Slot Calculator helper
  getCalculatedTimeSlots: (service: Booking['primaryService']) => string[];

  // Backup & Restore & Excel Export
  exportAllData: () => Promise<string>;
  exportToExcelCsv: () => void;
  exportCustomersCsv: () => void;
  importAllData: (jsonData: string) => boolean;
  importMasterBookingCsv: (csvContent: string) => { success: boolean; count: number; error?: string };
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  BOOKINGS: 'pl_bookings_v8',
  CUSTOMERS: 'pl_customers_v8',
  ROOMS: 'pl_rooms_v7',
  SERVICES: 'pl_services_v7',
  CREDITS: 'pl_credits_v8',
  STAFF: 'pl_staff_v7',
  CONFIG: 'pl_config_v7',
  ROLE: 'pl_current_role_v7',
  STAFF_AUTH: 'pl_staff_auth_v7',
  BOSS_AUTH: 'pl_boss_auth_v7',
};

// Keep action reads current even when several shop actions happen before React renders.
const useActionState = <T,>(initial: () => T) => {
  const [value, setValue] = useState(initial);
  const current = useRef(value);
  const set = useCallback((update: React.SetStateAction<T>) => {
    const next = typeof update === 'function' ? (update as (prev: T) => T)(current.current) : update;
    current.current = next;
    setValue(next);
  }, []);
  return [value, set, current] as const;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UserRole>(() => {
    // Retire the previous customer dataset without clearing shop configuration.
    // New v8 customer records survive future reloads and imports.
    for (const key of ['pl_customers_v7', 'pl_bookings_v7', 'pl_credits_v7']) {
      localStorage.removeItem(key);
    }
    return 'customer';
  });

  const [isStaffLoggedIn, setIsStaffLoggedIn] = useState<boolean>(() => {
    return !cloudMode && localStorage.getItem(STORAGE_KEYS.STAFF_AUTH) === 'true';
  });

  const [isBossLoggedIn, setIsBossLoggedIn] = useState<boolean>(() => {
    return !cloudMode && localStorage.getItem(STORAGE_KEYS.BOSS_AUTH) === 'true';
  });

  const [systemConfig, setSystemConfig, configRef] = useActionState<SystemConfig>(() => {
    const saved = cloudMode ? null : localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (!saved) return { ...initialSystemConfig, groomingPricing: defaultGroomingPricing, receiptConfig: defaultReceiptConfig,
      ...(cloudMode ? { staffCredentials: {username:'staff'}, bossCredentials: {username:'admin'} } : {}) };
    try {
      const parsed: SystemConfig = JSON.parse(saved);
      delete (parsed as SystemConfig & { googleSheetWebhookUrl?: string }).googleSheetWebhookUrl;
      // Use the original shop sheet instead of the tutorial or generated copy.
      // Preserve unrelated custom links and a deliberately cleared link.
      if (parsed.directGoogleSheetUrl === undefined ||
          /^https:\/\/docs\.google\.com\/spreadsheets\/d\/(?:1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms|1XrQLiods9hj0hV6j2Rk7lgoBFmoGP2yqgx3rYmoCKw4)(?:\/|$)/.test(parsed.directGoogleSheetUrl)) {
        parsed.directGoogleSheetUrl = initialSystemConfig.directGoogleSheetUrl;
      }
      parsed.customerBoardingRooms = (parsed.customerBoardingRooms || defaultCustomerBoardingRooms).filter(
        (r) => r.species === 'Dog' || r.species === 'Cat'
      );
      if (!parsed.smallPetsBoardingFee) {
        parsed.smallPetsBoardingFee = 10;
      }
      if (!parsed.dayCareConfig) {
        parsed.dayCareConfig = defaultDayCareConfig;
      }
      if (!parsed.petTaxiConfig) {
        parsed.petTaxiConfig = defaultPetTaxiConfig;
      }
      if (!parsed.petSittingConfig) {
        parsed.petSittingConfig = defaultPetSittingConfig;
      }
      return parsed;
    } catch {
      return initialSystemConfig;
    }
  });

  const [staffMembers, setStaffMembers] = useState<StaffAccount[]>(() => {
    const saved = cloudMode ? null : localStorage.getItem(STORAGE_KEYS.STAFF);
    return saved ? JSON.parse(saved) : initialStaff;
  });

  const [activeStaff, setActiveStaff] = useState<StaffAccount>(staffMembers[0] || initialStaff[0]);

  const [storedRooms, setRooms] = useActionState<Room[]>(() => {
    const saved = cloudMode ? null : localStorage.getItem(STORAGE_KEYS.ROOMS);
    return saved ? JSON.parse(saved) : initialRooms;
  });

  const rooms = useMemo(() => resolveRoomInventory(storedRooms, systemConfig.customerBoardingRooms || defaultCustomerBoardingRooms), [storedRooms, systemConfig.customerBoardingRooms]);

  const [services, setServices] = useState<ServiceItem[]>(() => {
    const saved = cloudMode ? null : localStorage.getItem(STORAGE_KEYS.SERVICES);
    return saved ? JSON.parse(saved) : initialServices;
  });

  const [customers, setCustomers, customersRef] = useActionState<Customer[]>(() => {
    const saved = cloudMode ? null : localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    return saved ? JSON.parse(saved) : initialCustomers;
  });

  const [storeCredits, setStoreCredits] = useState<StoreCreditRecord[]>(() => {
    const saved = cloudMode ? null : localStorage.getItem(STORAGE_KEYS.CREDITS);
    return saved ? JSON.parse(saved) : initialStoreCreditRecords;
  });

  const [bookings, setBookings, bookingsRef] = useActionState<Booking[]>(() => {
    const saved = cloudMode ? null : localStorage.getItem(STORAGE_KEYS.BOOKINGS);
    return (saved ? JSON.parse(saved) : initialBookings).map(normalizePendingDeposit);
  });

  const [dataStatus, setDataStatus] = useState<'loading'|'ready'|'saving'|'error'>(cloudMode ? 'loading' : 'ready');
  const [dataError,setDataError] = useState<string|null>(null);
  const [sheetPrepared,setSheetPrepared] = useState(false);
  const revisionRef=useRef(0);
  const queueRef=useRef<Promise<unknown>>(Promise.resolve());
  const operationEpoch=useRef(0);
  const pendingWrites=useRef(0);
  const applySnapshot=useCallback((snapshot:CloudSnapshot)=>{
    if(snapshot.systemConfig)setSystemConfig(snapshot.systemConfig);
    if(snapshot.rooms)setRooms(snapshot.rooms);
    if(snapshot.services)setServices(snapshot.services);
    if(snapshot.staffMembers)setStaffMembers(snapshot.staffMembers);
    if(snapshot.bookings)setBookings(snapshot.bookings);
    if(snapshot.customers)setCustomers(snapshot.customers);
    if(snapshot.storeCredits)setStoreCredits(snapshot.storeCredits);
    if(snapshot.revision!==undefined)revisionRef.current=snapshot.revision;
    if(snapshot.prepared!==undefined)setSheetPrepared(snapshot.prepared);
    if(snapshot.account!==undefined){
      setIsBossLoggedIn(snapshot.account?.role==='Boss');
      setIsStaffLoggedIn(Boolean(snapshot.account));
      if(snapshot.account)setActiveStaff({id:snapshot.account.id,name:snapshot.account.name,role:snapshot.account.role,username:snapshot.account.username,canManageCredit:snapshot.account.canManageCredit,active:true});
    }
  },[setSystemConfig,setRooms,setBookings,setCustomers]);
  const refreshData=useCallback(async()=>{
    if(!cloudMode)return;
    const epoch=operationEpoch.current;
    try{
      const auth=await cloudRequest<CloudSnapshot>('bootstrap?records=false');
      if(epoch!==operationEpoch.current||pendingWrites.current)return;
      applySnapshot(auth);
      if(auth.account){const records=await cloudRequest<CloudSnapshot>('bootstrap');if(epoch!==operationEpoch.current||pendingWrites.current)return;applySnapshot(records);}
      else{setBookings([]);setCustomers([]);setStoreCredits([]);}
      setDataError(null);setDataStatus('ready');
    }catch(error){setDataError(error instanceof Error?error.message:'Unable to connect.');setDataStatus('error');}
  },[applySnapshot,setBookings,setCustomers]);
  useEffect(()=>{
    if(!cloudMode)return;
    void refreshData();
    const interval=window.setInterval(()=>{if(document.visibilityState==='visible'&&!pendingWrites.current)void refreshData();},60000);
    const focus=()=>{if(!pendingWrites.current)void refreshData();};window.addEventListener('focus',focus);
    return ()=>{window.clearInterval(interval);window.removeEventListener('focus',focus);};
  },[refreshData]);
  const remote=async<T,>(work:()=>Promise<T>):Promise<T>=>{
    operationEpoch.current++;pendingWrites.current++;setDataStatus('saving');
    const task=queueRef.current.catch(()=>undefined).then(work);
    queueRef.current=task;
    try{const result=await task;setDataError(null);return result;}
    catch(error){setDataError(error instanceof Error?error.message:'The save failed.');throw error;}
    finally{pendingWrites.current--;if(!pendingWrites.current)setDataStatus('ready');}
  };
  const runCommand=async<T,>(action:string,payload:Record<string,unknown>):Promise<T>=>remote(async()=>{
    const result=await cloudCommand<T>(action,payload);applySnapshot(result);return result.result;
  });
  const saveRemoteConfig=async(updates:Partial<SystemConfig>,nextRooms?:Room[])=>remote(async()=>{
    applySnapshot(await cloudRequest<CloudSnapshot>('settings',{revision:revisionRef.current,updates,rooms:nextRooms},'PATCH'));
  });
  const checkSheetConnection=async(url:string)=>cloudRequest<{prepared:boolean;counts:{bookings:number;customers:number;credits:number};serviceAccount:string}>('connection/check',{url});
  const connectSheet=async(url:string,prepare:boolean)=>{
    if(!cloudMode)throw new Error('Use cloud mode to connect a shared database.');
    await remote(async()=>applySnapshot(await cloudRequest<CloudSnapshot>('connection',{url,prepare,revision:revisionRef.current})));
  };
  const savePhysicalRooms=async(nextRooms:Room[])=>{
    if(cloudMode)return saveRemoteConfig({},nextRooms);
    if(role!=='boss'||!isBossLoggedIn)throw new Error('Only the boss can edit kennels.');
    const resolved=resolveRoomInventory(nextRooms,configRef.current.customerBoardingRooms||[]);
    for(const booking of bookingsRef.current)validateRoomAssignments(booking,bookingsRef.current,resolved,configRef.current.roomAssignmentRules||[]);
    setRooms(nextRooms);
  };
  const saveStaffAccount=async(account:StaffAccount&{password?:string})=>{
    if(cloudMode)return remote(async()=>{const result=await cloudRequest<{staffMembers:StaffAccount[]}>('accounts',account);setStaffMembers(result.staffMembers);});
    if(role!=='boss'||!isBossLoggedIn)throw new Error('Only the boss can edit accounts.');
    setStaffMembers(prev=>prev.some(s=>s.id===account.id)?prev.map(s=>s.id===account.id?{...account,password:undefined}:s):[...prev,{...account,id:account.id||'staff-'+crypto.randomUUID(),password:undefined}]);
  };
  const lookupBooking=async(reference:string,contact:string):Promise<Booking[]>=>cloudMode?(await cloudRequest<{bookings:Booking[]}>('lookup',{reference,contact})).bookings:bookingsRef.current.filter(b=>b.bookingReference.toLowerCase()===reference.trim().toLowerCase()&&b.customerContact.replace(/\D/g,'')===contact.replace(/\D/g,''));

  // Upgrade legacy plaintext credentials before saving configuration again.
  useEffect(() => {
    if (!systemConfig.staffCredentials.pin && !systemConfig.bossCredentials.password) return;
    const original = systemConfig;
    void migrateCredentials(original).then(migrated => {
      setSystemConfig(current => current === original ? migrated : current);
    });
  }, [systemConfig, setSystemConfig]);

  // Browser persistence is available only in the explicit demo preview.
  useEffect(() => {
    if (cloudMode) return;
    localStorage.setItem(STORAGE_KEYS.STAFF_AUTH, String(isStaffLoggedIn));
  }, [isStaffLoggedIn]);

  useEffect(() => {
    if (cloudMode) return;
    localStorage.setItem(STORAGE_KEYS.BOSS_AUTH, String(isBossLoggedIn));
  }, [isBossLoggedIn]);

  useEffect(() => {
    if (cloudMode) return;
    if (cloudMode || systemConfig.staffCredentials.pin || systemConfig.bossCredentials.password) return;
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(systemConfig));
  }, [systemConfig]);

  useEffect(() => {
    if (cloudMode) return;
    localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(staffMembers));
  }, [staffMembers]);

  useEffect(() => {
    if (cloudMode) return;
    localStorage.setItem(STORAGE_KEYS.ROOMS, JSON.stringify(storedRooms));
  }, [storedRooms]);

  useEffect(() => {
    if (cloudMode) return;
    localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(services));
  }, [services]);

  useEffect(() => {
    if (cloudMode) return;
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    if (cloudMode) return;
    localStorage.setItem(STORAGE_KEYS.CREDITS, JSON.stringify(storeCredits));
  }, [storeCredits]);

  useEffect(() => {
    if (cloudMode) return;
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
  }, [bookings]);

  const setRole = useCallback((newRole: UserRole) => {
    setRoleState(newRole);
  }, []);

  // Hashing protects stored passwords; production authorization still requires a server.
  const loginStaff = async (username: string, pin: string): Promise<boolean> => {
    if(cloudMode){try{await cloudRequest('login',{username,password:pin,portal:'staff'});await refreshData();return true;}catch(error){setDataError(error instanceof Error?error.message:'Login failed.');return false;}}
    const secured = await migrateCredentials(systemConfig);
    if (username.trim().toLowerCase() !== secured.staffCredentials.username.toLowerCase()) return false;
    const valid = await verifyCredential(pin, secured.staffCredentials.passwordHash);
    if (valid) setIsStaffLoggedIn(true);
    return valid;
  };

  const loginBoss = async (username: string, password: string): Promise<boolean> => {
    if(cloudMode){try{await cloudRequest('login',{username,password,portal:'boss'});await refreshData();return true;}catch(error){setDataError(error instanceof Error?error.message:'Login failed.');return false;}}
    const secured = await migrateCredentials(systemConfig);
    if (username.trim().toLowerCase() !== secured.bossCredentials.username.toLowerCase()) return false;
    const valid = await verifyCredential(password, secured.bossCredentials.passwordHash);
    if (valid) setIsBossLoggedIn(true);
    return valid;
  };

  const saveCredentials = async (staffUsername: string, staffPin: string, bossUsername: string, bossPassword: string) => {
    if (role !== 'boss' || !isBossLoggedIn) throw new Error('Only the boss can change login credentials.');
    if(cloudMode)throw new Error('Manage each login in Boss Settings → Staff Accounts.');
    if (!staffUsername.trim() || !bossUsername.trim()) throw new Error('Enter both login usernames.');
    const secured = await migrateCredentials(systemConfig);
    const staffHash = staffPin ? await hashCredential(staffPin) : secured.staffCredentials.passwordHash;
    const bossHash = bossPassword ? await hashCredential(bossPassword) : secured.bossCredentials.passwordHash;
    setSystemConfig(current => ({ ...current,
      staffCredentials: { username: staffUsername.trim(), passwordHash: staffHash },
      bossCredentials: { username: bossUsername.trim(), passwordHash: bossHash },
    }));
  };

  const logout = () => {
    if(cloudMode){void cloudRequest('logout',{}).catch(error=>setDataError(error.message));setBookings([]);setCustomers([]);setStoreCredits([]);}
    setIsStaffLoggedIn(false);
    setIsBossLoggedIn(false);
  };

  // Helper to generate IDs and numbering sequences
  const generateSeqNumber = (prefix: 'INV' | 'R01' | 'R02') => {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randomSuffix = String(Math.floor(Math.random() * 900) + 100);
    return `${prefix}-${yearMonth}${randomSuffix}`;
  };

  // Time Slot Calculator helper
  const getCalculatedTimeSlots = (service: Booking['primaryService']): string[] => {
    if (service === 'Boarding' || service === 'Day Care') {
      const [startHour] = (systemConfig.operatingHours?.openTime || '10:00').split(':').map(Number);
      const [endHour] = (systemConfig.operatingHours?.closeTime || '19:00').split(':').map(Number);
      const slots: string[] = [];

      for (let h = startHour; h < endHour; h++) {
        const period = h >= 12 ? 'PM' : 'AM';
        const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
        slots.push(`${String(displayHour).padStart(2, '0')}:00 ${period} (Drop-Off)`);
        slots.push(`${String(displayHour).padStart(2, '0')}:30 ${period} (Drop-Off)`);
      }
      return slots;
    }

    const [startHour, startMin] = (systemConfig.operatingHours?.openTime || '10:00').split(':').map(Number);
    const [endHour, endMin] = (systemConfig.operatingHours?.closeTime || '19:00').split(':').map(Number);
    const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);

    const maxPets = Math.max(1, systemConfig.groomingCapacity.maxDogsPerDay || 4);
    const bufferMin = systemConfig.operatingHours?.bufferMinutes || 30;

    const totalBufferTime = maxPets * bufferMin;
    const remainingTime = Math.max(60, totalMinutes - totalBufferTime);
    const serviceDuration = Math.max(45, Math.floor(remainingTime / maxPets));

    const slots: string[] = [];
    let currentMin = startHour * 60 + startMin;

    for (let i = 0; i < maxPets; i++) {
      const slotStart = currentMin;
      const slotEnd = slotStart + serviceDuration;
      if (slotEnd > endHour * 60 + endMin) break;

      const formatTime = (mins: number) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        const period = h >= 12 ? 'PM' : 'AM';
        const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
        return `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
      };

      slots.push(`${formatTime(slotStart)} - ${formatTime(slotEnd)}`);
      currentMin = slotEnd + bufferMin;
    }

    return slots.length > 0 ? slots : [
      '10:00 AM - 11:30 AM',
      '12:00 PM - 01:30 PM',
      '02:30 PM - 04:00 PM',
      '04:30 PM - 06:00 PM',
    ];
  };

  // Public Booking Creation
  const createBooking = (data: CustomerBookingInput, manual?: ManualBookingInput): Booking => {
    const contact = normalizeCustomerContact(data.customerContact, data.countryCode);
    const totalAmount = data.totalAmountOverride !== undefined
      ? data.totalAmountOverride
      : quoteBooking(data,systemConfig).total;

    const depositRequired = manual?.depositRequiredOverride ?? quoteDeposit(totalAmount,systemConfig.depositConfig);

    const hasProof = Boolean(data.depositReceiptUrl && data.depositReceiptUrl.length > 0);
    const paymentStatus: PaymentStatus = hasProof ? 'Deposit Verification Pending' : manual && totalAmount === 0 ? 'Paid' : 'Outstanding';
    const status = hasProof ? 'Deposit Verification Pending' : 'Booked';

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    let count = bookingsRef.current.length + 1;
    while (bookingsRef.current.some(b => b.bookingReference === `MPL-${yearMonth}-${String(count).padStart(3, '0')}`)) count++;
    const refCode = `MPL-${yearMonth}-${String(count).padStart(3, '0')}`;
    const invoiceNumber = generateSeqNumber('INV');

    const newBooking: Booking = {
      id: `book-${crypto.randomUUID()}`,
      bookingReference: refCode,
      bookingDate: dateStr,
      primaryService: data.primaryService,
      checkInDate: data.checkInDate,
      checkInTime: data.checkInTime,
      checkOutDate: data.checkOutDate,
      customerName: data.customerName,
      customerContact: contact,
      countryCode: data.countryCode || '+60',
      numberOfPets: data.numberOfPets,
      pets: data.pets,
      boardingBreakdown: data.boardingBreakdown,
      groomingBreakdown: data.groomingBreakdown,
      petSittingBreakdown: data.petSittingBreakdown,
      dayCareFrequency: data.dayCareFrequency,
      petTaxiKm: data.petTaxiKm,
      status: status,
      operationalAlert: 'Pending WhatsApp',
      roomAlert: data.primaryService === 'Boarding' ? 'Pending Check-In' : '-',
      groomingAlert: data.primaryService === 'Grooming' ? 'Pending Session' : '-',
      staffAssigned: manual?.staffAssigned || 'Allyson',
      totalAmount,
      depositRequired,
      depositPaid: 0,
      depositDate: undefined,
      depositMethod: hasProof ? 'Bank Transfer / DuitNow QR' : undefined,
      depositReceiptUrl: data.depositReceiptUrl,
      finalPaid: 0,
      totalPaid: 0,
      balanceDue: totalAmount,
      paymentStatus: paymentStatus,
      invoiceNo: invoiceNumber,
      notes: data.notes,
      ...(manual ? { lastModifiedBy: role === 'boss' ? 'Boss' : 'Staff', lastModifiedAt: new Date().toISOString() } : {}),
    };

    validateReceiptDataUrl(data.depositReceiptUrl);
    validateGroomingCapacity(newBooking, bookingsRef.current, systemConfig.groomingCapacity);
    if (data.primaryService === 'Boarding') {
      newBooking.pets = allocateBoardingRooms(newBooking, bookingsRef.current, rooms, systemConfig.roomAssignmentRules || []);
    }
    setBookings((prev) => [newBooking, ...prev]);

    // Upsert Customer profile
    setCustomers((prev) => {
      const existing = prev.find((c) => c.contact.replace(/\D/g, '') === contact.replace(/\D/g, ''));
      if (existing) {
        if (manual) return prev;
        return prev.map((c) => 
          c.id === existing.id
            ? { ...c, name: data.customerName, countryCode: data.countryCode, notes: data.notes || c.notes } 
            : c
        );
      } else {
        return [
          {
            id: `cust-${crypto.randomUUID()}`,
            name: data.customerName,
            contact,
            countryCode: data.countryCode || '+60',
            storeCredit: 0,
            notes: data.notes,
            petName: data.pets[0]?.petName,
            petBreed: data.pets[0]?.breed,
            vaxExpiryDate: data.pets[0]?.vaxExpiryDate,
            createdAt: dateStr,
          },
          ...prev,
        ];
      }
    });

    return newBooking;
  };

  const requireShop = () => {
    if (!((role === 'boss' && isBossLoggedIn) || (role === 'staff' && isStaffLoggedIn))) {
      throw new Error('Only logged-in shop staff can record payments or change bookings.');
    }
  };

  const createCustomer = (data: NewCustomerInput): Customer => {
    requireShop();
    const customer = buildCustomerRecord(data, customersRef.current, `cust-${crypto.randomUUID()}`, role === 'boss' ? 'Boss' : 'Staff');
    setCustomers(prev => [customer, ...prev]);
    return customer;
  };

  const createCustomerBooking = (data: CustomerBookingInput): Booking => createBooking(data);

  const createManualBooking = (data: ManualBookingInput): Booking => {
    requireShop();
    validateManualBooking(data, data.depositRequiredOverride);
    // Shop-entered bookings start unpaid. Confirm received money using deposit verification.
    return createBooking({ ...data, depositReceiptUrl: undefined }, data);
  };

  const updateBooking = (id: string, updates: Partial<Booking>) => {
    requireShop();
    const current = bookingsRef.current.find(b => b.id === id);
    if (!current) return;
    let candidate = { ...current, ...updates };
    if (current.paymentStatus === 'Deposit Verification Pending') {
      if ((updates.depositPaid !== undefined && updates.depositPaid !== 0) || (updates.finalPaid !== undefined && updates.finalPaid !== current.finalPaid)) {
        throw new Error('Review the pending deposit before editing paid amounts.');
      }
      candidate = normalizePendingDeposit({ ...candidate, paymentStatus: 'Deposit Verification Pending' });
      if (candidate.status === 'Completed') throw new Error('Review the pending deposit before completing this booking.');
    }
    if (updates.pets || updates.checkInDate || updates.checkOutDate || updates.status) {
      const roomChanged = JSON.stringify(current.pets.map(p => p.assignedRoom)) !== JSON.stringify(candidate.pets.map(p => p.assignedRoom));
      if (roomChanged || updates.checkInDate || updates.checkOutDate || (updates.status && current.status !== candidate.status)) {
        validateRoomAssignments(candidate, bookingsRef.current, rooms, systemConfig.roomAssignmentRules || []);
      }
    }
    if (updates.primaryService || updates.checkInDate || updates.pets || updates.status) {
      validateGroomingCapacity(candidate, bookingsRef.current, systemConfig.groomingCapacity);
    }
    if (updates.depositReceiptUrl) validateReceiptDataUrl(updates.depositReceiptUrl);
    setBookings(prev => prev.map(b => b.id === id ? candidate : b));
  };

  const deleteBooking = (id: string) => {
    setBookings((prev) => prev.filter((b) => b.id !== id));
  };

  const verifyDeposit = (id: string, approved: boolean, depositAmountPaid?: number) => {
    requireShop();
    const current = bookingsRef.current.find(b => b.id === id);
    if (!current) throw new Error('Booking not found.');
    const reviewed = reviewDeposit(current, approved, depositAmountPaid ?? current.depositRequired,
      generateSeqNumber('R01'), new Date().toISOString().split('T')[0], activeStaff.name);
    setBookings(prev => prev.map(b => b.id === id ? reviewed : b));
  };

  const settlePickupBalance = (id: string, paymentMethod: string, amount: number) => {
    requireShop();
    if (paymentMethod === 'Store Credit') throw new Error('Store credit must be recorded through the shop credit redemption action.');
    const current = bookingsRef.current.find(b => b.id === id);
    if (!current) throw new Error('Booking not found.');
    const settled = recordSettlement(current, paymentMethod, amount, generateSeqNumber('R02'), new Date().toISOString().split('T')[0]);
    setBookings(prev => prev.map(b => b.id === id ? settled : b));
  };

  const assignRoomToPet = (bookingId: string, petIndex: number, roomNumber: string) => {
    const current = bookingsRef.current.find(b => b.id === bookingId);
    if (!current || !current.pets[petIndex]) throw new Error('Booking or pet not found.');
    const pets = current.pets.map((p, i) => i === petIndex ? { ...p, assignedRoom: roomNumber } : p);
    updateBooking(bookingId, { pets });
  };

  const requireCreditAccess = () => {
    if (!canManageCredit(role, isBossLoggedIn, isStaffLoggedIn, systemConfig.staffCanManageCredit)) {
      throw new Error('Credit changes are restricted to the boss unless the boss explicitly enables staff access.');
    }
  };

  const recordCreditChange = (record: Omit<StoreCreditRecord, 'id'>, adjustment = false) => {
    requireCreditAccess();
    const contact = normalizeCustomerContact(record.contact);
    const customer = customersRef.current.find(c => normalizeCustomerContact(c.contact, c.countryCode) === contact);
    if (!customer) throw new Error('Choose an existing customer before recording credit.');
    if (!Number.isFinite(record.cashIn) || !Number.isFinite(record.bonusGift) ||
        (!adjustment && (record.cashIn < 0 || record.bonusGift < 0))) throw new Error('Enter valid, non-negative top-up amounts.');
    const totalCredit = Math.round((customer.storeCredit + record.cashIn + record.bonusGift) * 100) / 100;
    if (totalCredit < 0) throw new Error('Credit cannot be reduced below zero.');
    const newRecord: StoreCreditRecord = { ...record, contact: customer.contact, ownerName: customer.name,
      totalCredit, id: `cr-${crypto.randomUUID()}` };
    setStoreCredits(prev => [newRecord, ...prev]);
    setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, storeCredit: totalCredit, unusedBalance: totalCredit } : c));
  };

  const addStoreCreditRecord = (record: Omit<StoreCreditRecord, 'id'>) => recordCreditChange(record);

  const updateStoreCreditRecord = (id: string, updates: Partial<StoreCreditRecord>) => {
    requireCreditAccess();
    if (Object.keys(updates).some(key => !['remark', 'receiptNo'].includes(key))) throw new Error('Ledger amounts cannot be overwritten; record a credit adjustment.');
    setStoreCredits((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const applyStoreCreditToBooking = (bookingId: string, creditAmount: number): boolean => {
    const booking = bookingsRef.current.find((b) => b.id === bookingId);
    if (!booking) return false;

    const customer = customersRef.current.find((c) => c.contact === booking.customerContact);
    if (!customer || customer.storeCredit < creditAmount) return false;

    requireCreditAccess();
    const settled = recordSettlement(booking, 'Store Credit', creditAmount, generateSeqNumber('R02'), new Date().toISOString().split('T')[0]);
    setBookings(prev => prev.map(b => b.id === bookingId ? settled : b));

    recordCreditChange({
      topUpDate: new Date().toISOString().split('T')[0],
      contact: customer.contact,
      ownerName: customer.name,
      cashIn: -creditAmount,
      paymentMethod: 'Store Credit Redemption',
      bonusGift: 0,
      totalCredit: customer.storeCredit - creditAmount,
      remark: `Applied RM ${creditAmount} to booking ${booking.bookingReference}`,
      receiptNo: booking.invoiceNo,
    }, true);

    return true;
  };

  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    requireShop();
    const customer = customersRef.current.find(c => c.id === id);
    if (!customer) throw new Error('Customer not found.');
    if (updates.unusedBalanceReason !== undefined && updates.unusedBalanceReason !== customer.unusedBalanceReason) requireCreditAccess();
    if ((updates.storeCredit !== undefined && updates.storeCredit !== customer.storeCredit) ||
        (updates.unusedBalance !== undefined && updates.unusedBalance !== customer.unusedBalance)) {
      requireCreditAccess();
      const amount = updates.storeCredit ?? updates.unusedBalance!;
      if (!Number.isFinite(amount) || amount < 0) throw new Error('Credit balance must be zero or greater.');
      recordCreditChange({ topUpDate: new Date().toISOString().slice(0, 10), contact: customer.contact, ownerName: customer.name,
        cashIn: amount - customer.storeCredit, bonusGift: 0, totalCredit: amount, paymentMethod: 'Shop Adjustment',
        remark: updates.unusedBalanceReason || 'Profile credit adjustment' }, true);
    }
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const updateSystemConfig = (updates: Partial<SystemConfig>) => {
    if (role !== 'boss' || !isBossLoggedIn) throw new Error('Only the boss can change system settings.');
    if (updates.staffCredentials || updates.bossCredentials) throw new Error('Use the credential settings action.');
    setSystemConfig((prev) => ({ ...prev, ...updates }));
  };

  const addStaffMember = (member: Omit<StaffAccount, 'id'>) => {
    if(role!=='boss'||!isBossLoggedIn)throw new Error('Only the boss can change these settings.');
    const newStaff: StaffAccount = { ...member, id: `staff-${Date.now()}` };
    setStaffMembers((prev) => [...prev, newStaff]);
  };

  const updateStaffMember = (id: string, updates: Partial<StaffAccount>) => {
    if(role!=='boss'||!isBossLoggedIn)throw new Error('Only the boss can change these settings.');
    setStaffMembers((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const deleteStaffMember = (id: string) => {
    if(role!=='boss'||!isBossLoggedIn)throw new Error('Only the boss can change these settings.');
    setStaffMembers((prev) => prev.filter((s) => s.id !== id));
  };

  // Room Assignment Rules CRUD & Reordering
  const addRoomAssignmentRule = (rule: Omit<RoomAssignmentRule, 'id'>) => {
    if(role!=='boss'||!isBossLoggedIn)throw new Error('Only the boss can change these settings.');
    const newRule: RoomAssignmentRule = {
      ...rule,
      id: `rule-${Date.now()}`,
    };
    setSystemConfig((prev) => ({
      ...prev,
      roomAssignmentRules: [...(prev.roomAssignmentRules || []), newRule],
    }));
  };

  const updateRoomAssignmentRule = (id: string, updates: Partial<RoomAssignmentRule>) => {
    if(role!=='boss'||!isBossLoggedIn)throw new Error('Only the boss can change these settings.');
    setSystemConfig((prev) => ({
      ...prev,
      roomAssignmentRules: (prev.roomAssignmentRules || []).map((r) =>
        r.id === id ? { ...r, ...updates } : r
      ),
    }));
  };

  const deleteRoomAssignmentRule = (id: string) => {
    if(role!=='boss'||!isBossLoggedIn)throw new Error('Only the boss can change these settings.');
    setSystemConfig((prev) => ({
      ...prev,
      roomAssignmentRules: (prev.roomAssignmentRules || []).filter((r) => r.id !== id),
    }));
  };

  const moveRoomAssignmentRule = (index: number, direction: 'up' | 'down') => {
    if(role!=='boss'||!isBossLoggedIn)throw new Error('Only the boss can change these settings.');
    setSystemConfig((prev) => {
      const list = [...(prev.roomAssignmentRules || [])];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= list.length) return prev;
      const temp = list[index];
      list[index] = list[targetIndex];
      list[targetIndex] = temp;
      return { ...prev, roomAssignmentRules: list };
    });
  };

  // Customer Boarding Room Types (Customer Side Configuration)
  const updateCustomerBoardingRoom = (updatedRoom: CustomerBoardingRoom) => {
    if(role!=='boss'||!isBossLoggedIn)throw new Error('Only the boss can change these settings.');
    setSystemConfig((prev) => {
      const currentList = prev.customerBoardingRooms || defaultCustomerBoardingRooms;
      const newList = currentList.map((r) =>
        r.id === updatedRoom.id && r.species === updatedRoom.species ? updatedRoom : r
      );
      return { ...prev, customerBoardingRooms: newList };
    });
  };

  const addCustomerBoardingRoom = (newRoom: CustomerBoardingRoom) => {
    if(role!=='boss'||!isBossLoggedIn)throw new Error('Only the boss can change these settings.');
    setSystemConfig((prev) => {
      const currentList = prev.customerBoardingRooms || defaultCustomerBoardingRooms;
      return { ...prev, customerBoardingRooms: [...currentList, newRoom] };
    });
  };

  const deleteCustomerBoardingRoom = (id: string, species: SpeciesType) => {
    if(role!=='boss'||!isBossLoggedIn)throw new Error('Only the boss can change these settings.');
    setSystemConfig((prev) => {
      const currentList = prev.customerBoardingRooms || defaultCustomerBoardingRooms;
      return {
        ...prev,
        customerBoardingRooms: currentList.filter((r) => !(r.id === id && r.species === species)),
      };
    });
  };

  const resetCustomerBoardingRooms = () => {
    if(role!=='boss'||!isBossLoggedIn)throw new Error('Only the boss can change these settings.');
    setSystemConfig((prev) => ({
      ...prev,
      customerBoardingRooms: defaultCustomerBoardingRooms,
    }));
  };

  const exportAllData = async () => {
    const securedConfig = cloudMode ? systemConfig : await migrateCredentials(systemConfig);
    const dump = {
      timestamp: new Date().toISOString(),
      shop: systemConfig.shopName,
      bookings,
      customers,
      rooms,
      services,
      storeCredits,
      staffMembers,
      systemConfig: securedConfig,
    };
    return JSON.stringify(dump, null, 2);
  };

  // 1-Click Multi-Sheet Excel / CSV Export matching Google Sheet format exactly
  const exportToExcelCsv = () => {
    // 39 Exact Column Headers in identical order to official Google Sheet
    const headers = [
      'Booking Date', 'Status', 'Service', 'In Date', 'Out Date', 'Contact', 'Name', 'Pet Name', 'Breed', 'Weight',
      'Room', 'Vax Date', 'Staff', 'Characteristics', 'Allergies/Notes', 'Total Amount', 'Deposit Required', 'Deposit Paid',
      'Date', ' Method', 'Final Paid', 'Date', ' Method', 'Total Paid', 'Balance Due', 'Payment Status', 'Service Month',
      'Room Alert', 'Grooming Alert', 'Feeding/Taxi Alert', '', '', '', 'Deposit Month', 'Final Month',
      'Invoice No', 'Deposit Receipt No', 'Final Receipt No', 'Calendar Event ID'
    ];

    const formatDateToDMY = (dateStr?: string): string => {
      if (!dateStr) return '';
      const trimmed = dateStr.trim();
      if (trimmed.includes('/')) return trimmed;
      const parts = trimmed.split('-');
      if (parts.length === 3) {
        const [year, month, day] = parts;
        return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
      }
      return trimmed;
    };

    const escapeCsv = (val: string | number | undefined | null): string => {
      if (val === undefined || val === null) return '';
      const str = String(val).trim();
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = bookings.map((b) => {
      const pet = b.pets[0] || {};
      const cleanContact = b.customerContact.replace(/[^0-9]/g, '');
      const contactVal = cleanContact.length > 5 ? cleanContact : b.customerContact;

      return [
        escapeCsv(formatDateToDMY(b.bookingDate)),
        escapeCsv(b.status),
        escapeCsv(b.primaryService),
        escapeCsv(formatDateToDMY(b.checkInDate)),
        escapeCsv(b.checkOutDate ? formatDateToDMY(b.checkOutDate) : ''),
        escapeCsv(contactVal),
        escapeCsv(b.customerName),
        escapeCsv(pet.petName || '-'),
        escapeCsv(pet.breed || ''),
        escapeCsv(pet.weightBracket || ''),
        escapeCsv(pet.assignedRoom || ''),
        escapeCsv(pet.vaxExpiryDate || ''),
        escapeCsv(b.staffAssigned || ''),
        escapeCsv(pet.characteristics || ''),
        escapeCsv(pet.allergiesNotes || ''),
        Number(b.totalAmount || 0).toFixed(2),
        Number(b.depositRequired || 0).toFixed(2),
        b.depositPaid ? Number(b.depositPaid).toFixed(2) : '',
        escapeCsv(b.depositDate ? formatDateToDMY(b.depositDate) : ''),
        escapeCsv(b.depositMethod || ''),
        b.finalPaid ? Number(b.finalPaid).toFixed(2) : '',
        escapeCsv(b.finalDate ? formatDateToDMY(b.finalDate) : ''),
        escapeCsv(b.finalMethod || ''),
        Number(b.totalPaid || 0).toFixed(2),
        Number(b.balanceDue || 0).toFixed(2),
        escapeCsv(b.paymentStatus),
        escapeCsv(b.serviceMonth || ''),
        escapeCsv(b.roomAlert || '-'),
        escapeCsv(b.groomingAlert || '-'),
        escapeCsv(b.feedingTaxiAlert || '-'),
        '', // column 30 blank
        '', // column 31 blank
        '', // column 32 blank
        escapeCsv(b.depositMonth || ''),
        escapeCsv(b.finalMonth || ''),
        escapeCsv(b.invoiceNo || ''),
        escapeCsv(b.depositReceiptNo || ''),
        escapeCsv(b.finalReceiptNo || ''),
        escapeCsv(b.calendarEventId || ''),
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + 
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pet-loft-master-bookings-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import / Restore directly from official Google Sheet CSV
  const importMasterBookingCsv = (csvText: string): { success: boolean; count: number; error?: string } => {
    if(cloudMode)return {success:false,count:0,error:'Cloud records are read directly from Google Sheets. Manual replacement imports are disabled.'};
    try {
      const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        return { success: false, count: 0, error: 'CSV file is empty or missing data rows.' };
      }

      const parseCsvLine = (text: string): string[] => {
        const result: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          if (char === '"') {
            if (inQuotes && text[i + 1] === '"') {
              cur += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            result.push(cur.trim());
            cur = '';
          } else {
            cur += char;
          }
        }
        result.push(cur.trim());
        return result;
      };

      const dmyToIso = (d?: string): string => {
        if (!d) return '';
        const trimmed = d.trim();
        const parts = trimmed.split('/');
        if (parts.length === 3) {
          const [day, month, year] = parts;
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        return trimmed;
      };

      const importedBookings: Booking[] = [];
      for (let i = 1; i < lines.length; i++) {
        const r = parseCsvLine(lines[i]);
        if (r.length < 5 || !r[0]) continue;

        const bDate = dmyToIso(r[0]);
        const status = r[1] || 'Booked';
        const service = (r[2] || 'Grooming') as Booking['primaryService'];
        const inDate = dmyToIso(r[3]);
        const outDate = dmyToIso(r[4]);
        const contact = r[5] || '';
        const name = r[6] || '';
        const petName = r[7] === '-' ? '' : r[7] || '';
        const breed = r[8] || '';
        const weight = r[9] || '';
        const room = r[10] || '';
        const vaxDate = r[11] || '';
        const staff = r[12] || 'Allyson';
        const charact = r[13] || '';
        const notes = r[14] || '';
        const totalAmount = parseFloat(r[15]) || 0;
        const depositReq = parseFloat(r[16]) || 0;
        const depositPaid = parseFloat(r[17]) || 0;
        const depDate = dmyToIso(r[18]);
        const depMeth = r[19] || '';
        const finalPaid = parseFloat(r[20]) || 0;
        const finalDate = dmyToIso(r[21]);
        const finalMeth = r[22] || '';
        const totalPaid = parseFloat(r[23]) || 0;
        const balanceDue = parseFloat(r[24]) || 0;
        const payStat = (r[25] || 'Outstanding') as PaymentStatus;
        const servMonth = r[26] || '';
        const roomAlert = r[27] || '-';
        const groomAlert = r[28] || '-';
        const feedAlert = r[29] || '-';
        const depMonth = r[33] || '';
        const finMonth = r[34] || '';
        const invoiceNo = r[35] || '';
        const depRecNo = r[36] || '';
        const finRecNo = r[37] || '';
        const calId = r[38] || '';

        let species: BookingPet['species'] = 'Dog';
        const breedLower = breed.toLowerCase();
        if (breedLower.includes('cat') || breedLower.includes('domestic') || breedLower.includes('british')) {
          species = 'Cat';
        } else if (breedLower.includes('chicken') || breedLower.includes('bird')) {
          species = 'Bird';
        }

        let wb: BookingPet['weightBracket'] = '< 5kg';
        if (weight.includes('12')) wb = '6 - 12 kg';
        else if (weight.includes('20')) wb = '13 - 20 kg';
        else if (weight.includes('30') && !weight.includes('>')) wb = '21 - 30 kg';
        else if (weight.includes('>')) wb = '> 30 kg';

        const bookingId = `book-${String(i).padStart(3, '0')}`;
        const ref = invoiceNo ? `MPL-${invoiceNo.replace('INV-', '')}` : `MPL-2026-${String(i).padStart(3, '0')}`;

        importedBookings.push({
          id: bookingId,
          bookingReference: ref,
          bookingDate: bDate,
          primaryService: service,
          checkInDate: inDate,
          checkOutDate: outDate || undefined,
          customerName: name,
          customerContact: contact,
          countryCode: '+60',
          numberOfPets: 1,
          pets: [
            {
              petName: petName,
              species: species,
              breed: breed,
              weightBracket: wb,
              assignedRoom: room || undefined,
              vaxExpiryDate: vaxDate || undefined,
              characteristics: charact || undefined,
              allergiesNotes: notes || undefined,
            }
          ],
          status: status,
          operationalAlert: status,
          roomAlert: roomAlert,
          groomingAlert: groomAlert,
          feedingTaxiAlert: feedAlert,
          staffAssigned: staff,
          totalAmount: totalAmount,
          depositRequired: depositReq,
          depositPaid: depositPaid,
          depositDate: depDate || undefined,
          depositMethod: depMeth || undefined,
          finalPaid: finalPaid,
          finalDate: finalDate || undefined,
          finalMethod: finalMeth || undefined,
          totalPaid: totalPaid,
          balanceDue: balanceDue,
          paymentStatus: payStat,
          serviceMonth: servMonth,
          depositMonth: depMonth || undefined,
          finalMonth: finMonth || undefined,
          invoiceNo: invoiceNo || undefined,
          depositReceiptNo: depRecNo || undefined,
          finalReceiptNo: finRecNo || undefined,
          calendarEventId: calId || undefined,
          notes: `${service} booking for ${name}${breed ? ` (${breed})` : ''}`,
          lastModifiedBy: 'CSV Import (Google Sheet)',
          lastModifiedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
        });
      }

      if (importedBookings.length > 0) {
        setBookings(importedBookings);
        return { success: true, count: importedBookings.length };
      }
      return { success: false, count: 0, error: 'No valid booking rows found in CSV.' };
    } catch (err: any) {
      return { success: false, count: 0, error: err?.message || 'Failed to parse CSV file.' };
    }
  };

  const exportCustomersCsv = () => {
    const headers = [
      'Owner Name', 'Contact Number', 'Pet Name', 'Pet Breed', 'Unused Balance (RM)',
      'Reason / Notes', 'Store Credit (RM)', 'Instagram', 'Xiaohongshu', 'Client Since'
    ];

    const rows = customers.map(c => [
      `"${c.name}"`,
      `"${c.contact}"`,
      `"${c.petName || ''}"`,
      `"${c.petBreed || ''}"`,
      c.unusedBalance ?? c.storeCredit ?? 0,
      `"${c.unusedBalanceReason || c.notes || ''}"`,
      c.storeCredit,
      `"${c.igHandle || ''}"`,
      `"${c.xhsHandle || ''}"`,
      c.createdAt
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + 
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pet-loft-customers-directory-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const importAllData = (jsonData: string): boolean => {
    if(cloudMode||role!=='boss'||!isBossLoggedIn)return false;
    try {
      const parsed = JSON.parse(jsonData);
      if (parsed.bookings) setBookings(parsed.bookings.map(normalizePendingDeposit));
      if (parsed.customers) setCustomers(parsed.customers);
      if (parsed.rooms) setRooms(parsed.rooms);
      if (parsed.services) setServices(parsed.services);
      if (parsed.storeCredits) setStoreCredits(parsed.storeCredits);
      if (parsed.staffMembers) setStaffMembers(parsed.staffMembers);
      if (parsed.systemConfig) {
        delete parsed.systemConfig.googleSheetWebhookUrl;
        setSystemConfig(parsed.systemConfig);
      }
      return true;
    } catch {
      return false;
    }
  };

  return (
    <AppContext.Provider
      value={{
        dataMode:cloudMode?'cloud':'demo',dataStatus,dataError,sheetPrepared,refreshData,
        dismissDataError:()=>setDataError(null),checkSheetConnection,connectSheet,savePhysicalRooms,saveStaffAccount,lookupBooking,
        role,
        setRole,
        activeStaff,
        setActiveStaff,
        isStaffLoggedIn,
        isBossLoggedIn,
        loginStaff,
        loginBoss,
        saveCredentials,
        logout,
        bookings,
        customers,
        rooms,
        services,
        storeCredits,
        staffMembers,
        systemConfig,
        createCustomerBooking: async data=>{if(!cloudMode)return createCustomerBooking(data);return remote(async()=>{let receipt=data.depositReceiptUrl;if(receipt?.startsWith('data:'))receipt=await uploadReceipt(receipt);const result=await cloudCommand<Booking>('createCustomerBooking',{data:{...data,depositReceiptUrl:receipt}});applySnapshot(result);return result.result;});},
        createManualBooking: async data=>cloudMode?runCommand<Booking>('createManualBooking',{data}):createManualBooking(data),
        createCustomer: async data=>cloudMode?runCommand<Customer>('createCustomer',{data}):createCustomer(data),
        updateBooking: async(id,updates)=>{if(cloudMode)await runCommand('updateBooking',{id,updates});else updateBooking(id,updates);},
        deleteBooking: async id=>{if(cloudMode)await runCommand('deleteBooking',{id});else{requireShop();deleteBooking(id);}},
        verifyDeposit: async(id,approved,amount)=>{if(cloudMode)await runCommand('verifyDeposit',{id,approved,amount});else verifyDeposit(id,approved,amount);},
        settlePickupBalance: async(id,method,amount)=>{if(cloudMode)await runCommand('settlePickupBalance',{id,method,amount});else settlePickupBalance(id,method,amount);},
        assignRoomToPet: async(id,petIndex,roomNumber)=>{if(cloudMode)await runCommand('assignRoomToPet',{id,petIndex,roomNumber});else assignRoomToPet(id,petIndex,roomNumber);},
        addStoreCreditRecord: async data=>{if(cloudMode)await runCommand('addStoreCreditRecord',{data});else addStoreCreditRecord(data);},
        updateStoreCreditRecord: async(id,updates)=>{if(cloudMode)await runCommand('updateStoreCreditRecord',{id,updates});else updateStoreCreditRecord(id,updates);},
        applyStoreCreditToBooking: async(id,amount)=>cloudMode?runCommand<boolean>('applyStoreCreditToBooking',{id,amount}):applyStoreCreditToBooking(id,amount),
        updateCustomer: async(id,updates)=>{if(cloudMode)await runCommand('updateCustomer',{id,updates});else updateCustomer(id,updates);},
        updateSystemConfig: async updates=>{if(cloudMode)await saveRemoteConfig(updates);else updateSystemConfig(updates);},
        addStaffMember: async member=>{if(cloudMode)throw new Error('Use the account editor to set an individual username and password.');addStaffMember(member);},
        updateStaffMember: async(id,updates)=>{if(cloudMode)throw new Error('Use the individual account editor.');updateStaffMember(id,updates);},
        deleteStaffMember: async id=>{if(cloudMode){await remote(async()=>{const result=await cloudRequest<{staffMembers:StaffAccount[]}>('accounts/remove',{id});setStaffMembers(result.staffMembers);});}else deleteStaffMember(id);},
        addRoomAssignmentRule: async rule=>{if(cloudMode)await saveRemoteConfig({roomAssignmentRules:[...(configRef.current.roomAssignmentRules||[]),{...rule,id:'rule-'+crypto.randomUUID()}]});else addRoomAssignmentRule(rule);},
        updateRoomAssignmentRule: async(id,updates)=>{if(cloudMode)await saveRemoteConfig({roomAssignmentRules:(configRef.current.roomAssignmentRules||[]).map(r=>r.id===id?{...r,...updates}:r)});else updateRoomAssignmentRule(id,updates);},
        deleteRoomAssignmentRule: async id=>{if(cloudMode)await saveRemoteConfig({roomAssignmentRules:(configRef.current.roomAssignmentRules||[]).filter(r=>r.id!==id)});else deleteRoomAssignmentRule(id);},
        moveRoomAssignmentRule: async(index,direction)=>{if(cloudMode){const list=[...(configRef.current.roomAssignmentRules||[])];const next=index+(direction==='up'?-1:1);if(next<0||next>=list.length)return;[list[index],list[next]]=[list[next],list[index]];await saveRemoteConfig({roomAssignmentRules:list});}else moveRoomAssignmentRule(index,direction);},
        updateCustomerBoardingRoom: async room=>{if(cloudMode)await saveRemoteConfig({customerBoardingRooms:(configRef.current.customerBoardingRooms||[]).map(r=>r.id===room.id&&r.species===room.species?room:r)});else updateCustomerBoardingRoom(room);},
        addCustomerBoardingRoom: async room=>{if(cloudMode)await saveRemoteConfig({customerBoardingRooms:[...(configRef.current.customerBoardingRooms||[]),room]});else addCustomerBoardingRoom(room);},
        deleteCustomerBoardingRoom: async(id,species)=>{if(cloudMode)await saveRemoteConfig({customerBoardingRooms:(configRef.current.customerBoardingRooms||[]).filter(r=>!(r.id===id&&r.species===species))});else deleteCustomerBoardingRoom(id,species);},
        resetCustomerBoardingRooms: async()=>{if(cloudMode)await saveRemoteConfig({customerBoardingRooms:defaultCustomerBoardingRooms});else resetCustomerBoardingRooms();},
        getCalculatedTimeSlots,
        exportAllData,
        exportToExcelCsv,
        exportCustomersCsv,
        importAllData,
        importMasterBookingCsv,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
