export type UserRole = 'boss' | 'staff' | 'customer';

export type ServiceType = 'Boarding' | 'Grooming' | 'Pet Sitting' | 'Day Care' | 'Pet Taxi';

export type SpeciesType = 'Dog' | 'Cat' | 'Rabbit' | 'Hamster' | 'Bird';

export type WeightBracket = '< 5kg' | '6 - 12 kg' | '13 - 20 kg' | '21 - 30 kg' | '> 30 kg';

export interface BookingPet {
  petName?: string;
  breed?: string;
  species: SpeciesType;
  weightBracket: WeightBracket;
  exactWeightKg?: number;
  preferredRoomType?: string; // Studio, Superior Room, Deluxe Room, Suite
  vaxExpiryDate?: string;
  birthDate?: string;
  characteristics?: string;
  allergiesNotes?: string;
  assignedRoom?: string;

  // Grooming details per pet
  groomingType?: 'Basic Grooming' | 'Shaved Down' | 'Full Grooming';
  coatType?: 'Short Coat' | 'Long Coat' | 'Double Coat';
  fullGroomingStyle?: 'Summer Cut' | 'Pants Cut' | 'Hand Cut';
  isSpecialBreed?: boolean; // Alaska or Standard Poodle < 30kg
  extraWeightCharge?: number;
  additionalServices?: string[];
}

export type PaymentStatus = 
  | 'Pending'
  | 'Outstanding'
  | 'Deposit Verification Pending'
  | 'Deposit Paid'
  | 'Paid'
  | 'Cancelled';

export interface BoardingBreakdown {
  arrangement?: 'single' | 'separate' | 'shared' | 'own_cage';
  roomType: string;
  roomPricePerNight: number;
  nights: number;
  petsPerRoom: number;
  extraPetsCount: number;
  extraPetPricePerNight: number;
  totalRoomCost: number;
  totalExtraPetsCost: number;
  roomsCount?: number;
  allocatedRooms?: Array<{
    roomId: string;
    title: string;
    basePrice: number;
    petsCount: number;
    extraPets: number;
    extraPetRate: number;
    extraCharge: number;
    costPerNight: number;
  }>;
}

export interface GroomingBreakdown {
  groomingType: string;
  coatOrStyle: string;
  basePrice: number;
  extraWeightRange?: string;
  extraWeightCharge: number;
  additionalServices: Array<{ name: string; price: number }>;
  totalAdditionalCost: number;
}

export interface PetSittingAddonItem {
  code: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  subtotal: number;
}

export interface PetSittingBreakdown {
  firstPetName?: string;
  firstPetWeightBracket: WeightBracket;
  firstPetBaseRate: number;
  extraPetsCount: number;
  extraPetsList: Array<{
    petName?: string;
    weightBracket: WeightBracket;
    extraPetFee: number;
    sizeCategory: '< 25kg' | '> 25kg';
  }>;
  totalPetsBaseCost: number;
  selectedAddons: PetSittingAddonItem[];
  totalAddonsCost: number;
  peakSurcharge: number;
  grandTotal: number;
  summaryText: string;
}

export interface Booking {
  creditLedgerMigrated?: boolean;
  id: string;
  bookingReference: string;
  bookingDate: string;
  primaryService: ServiceType;
  checkInDate: string;
  checkInTime?: string;
  checkOutDate?: string;
  customerName: string;
  customerContact: string;
  countryCode?: string;
  numberOfPets: number;
  pets: BookingPet[];
  
  status: string;
  operationalAlert: string;
  roomAlert?: string;
  groomingAlert?: string;
  feedingTaxiAlert?: string;
  staffAssigned?: string;

  // Service Breakdowns
  boardingBreakdown?: BoardingBreakdown;
  groomingBreakdown?: GroomingBreakdown;
  petSittingBreakdown?: PetSittingBreakdown;
  dayCareFrequency?: 'Daily' | 'Monthly';
  petTaxiKm?: number;

  // Financials
  totalAmount: number;
  depositRequired: number;
  depositPaid: number;
  depositDate?: string;
  depositMethod?: string;
  depositReceiptUrl?: string;

  finalPaid: number;
  finalDate?: string;
  finalMethod?: string;
  totalPaid: number;
  balanceDue: number;
  paymentStatus: PaymentStatus;

  // Documents
  invoiceNo?: string;
  depositReceiptNo?: string;
  finalReceiptNo?: string;
  notes?: string;

  // Google Sheet & Master Spreadsheet tracking
  serviceMonth?: string;
  depositMonth?: string;
  finalMonth?: string;
  calendarEventId?: string;

  // Audit trail
  lastModifiedBy?: string;
  lastModifiedAt?: string;
}

export interface Customer {
  pets?: BookingPet[];
  id: string;
  name: string;
  contact: string;
  countryCode?: string;
  email?: string;
  igHandle?: string;
  xhsHandle?: string;
  storeCredit: number;
  unusedBalance?: number;
  unusedBalanceReason?: string;
  petName?: string;
  petBreed?: string;
  vaxExpiryDate?: string;
  notes?: string;
  createdAt: string;

  // Audit trail
  lastModifiedBy?: string;
  lastModifiedAt?: string;
}

export interface Room {
  id: string;
  roomNumber: string;
  species: SpeciesType;
  category: string;
  categoryTitle?: string;
  active?: boolean;
  enabled?: boolean;
  basePrice: number;
  maxCapacity: number;
  description: string;
  status: 'available' | 'occupied' | 'cleaning';
}

export interface ServiceItem {
  code: string;
  name: string;
  category: 'Boarding' | 'Grooming' | 'Pet Sitting' | 'Day Care' | 'Pet Taxi' | 'Additional Service' | 'Surcharge';
  basePrice: number;
  unit: string;
  weightTier?: string;
  description?: string;
}

export interface StoreCreditRecord {
  id: string;
  topUpDate: string;
  contact: string;
  ownerName: string;
  cashIn: number;
  paymentMethod: string;
  bonusGift: number;
  totalCredit: number;
  remark: string;
  receiptNo?: string;
}

export interface StaffAccount {
  username?: string;
  canManageCredit?: boolean;
  id: string;
  name: string;
  role: 'Boss' | 'Staff';
  phone?: string;
  active: boolean;
}

export interface RoomAssignmentRule {
  id: string;
  species: SpeciesType;
  weightBracket: WeightBracket;
  preferredRooms: string[];
  maxPetsPerRoom: number;
}

export interface CustomerBoardingRoom {
  id: string; // 'Studio', 'Superior Room', 'Deluxe Room', 'Suite', or custom ID
  species: SpeciesType; // 'Dog' | 'Cat'
  title: string; // 'Studio Fence', 'Superior Room', 'Deluxe Room', 'Dog Suite'
  price: number; // 39, 65, 98, 188
  capacity: number; // 1, 2, 3, 4
  desc: string; // Description shown on customer portal
  extraPetPrice: number; // 0, 10, 20
  active?: boolean;
}

export interface CredentialHash {
  algorithm: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  digest: string;
}

export interface SystemConfig {
  shopName: string; // 'Pet Loft'
  legalShopName: string; // 'MELLOW PET LOFT CONCEPT STORE' (for official invoice & receipt)
  ssmNumber: string;
  address: string;
  phone: string;
  email: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  instagramUrl: string;
  xhsUrl: string;
  logoUrl?: string;

  receiptConfig?: ReceiptConfig;
  groomingPricing?: GroomingPricing;

  // Linked business-record database in cloud mode.
  directGoogleSheetUrl?: string;

  // Online Payment Gate (Open/Close toggle)
  onlinePaymentEnabled: boolean; // default false (closed)

  // Permissions
  staffCanManageCredit: boolean; // default false (view-only for staff)

  // Login Credentials (Configurable in Boss Settings)
  staffCredentials: {
    username: string;
    passwordHash?: CredentialHash;
    pin?: string; // Legacy import only; migrated before persistence.
  };
  bossCredentials: {
    username: string;
    passwordHash?: CredentialHash;
    password?: string; // Legacy import only; migrated before persistence.
  };

  // Operating Hours and Slot Engine
  operatingHours: {
    openTime: string;
    closeTime: string;
    bufferMinutes: number;
  };

  formFieldConfig: {
    petNameRequired: boolean;
    petBreedRequired: boolean;
    vaxDateRequired: boolean;
    birthDateRequired: boolean;
    notesRequired: boolean;
  };

  depositConfig: {
    minDepositAmount: number;
    percentageThreshold: number;
    percentageRate: number;
    peakSurcharge: number;
  };

  groomingCapacity: {
    activeDays: number[];
    maxDogsPerDay: number;
  };

  roomAssignmentRules: RoomAssignmentRule[];

  bookingStatuses: Array<{
    id: string;
    label: string;
    color: string;
  }>;

  // Shared room types used by customer pricing and operational kennels.
  customerBoardingRooms?: CustomerBoardingRoom[];
  smallPetsBoardingFee?: number; // Flat per-night lodging fee for rabbit, hamster, bird (own cage), default 10

  // Day Care & Pet Taxi Config
  dayCareConfig?: DayCareConfig;
  petTaxiConfig?: PetTaxiConfig;

  // Pet Sitting Pricing & Additional Services Config
  petSittingConfig?: PetSittingConfig;
}

export interface DayCareTier {
  weightBracket: WeightBracket;
  code: string;
  name: string;
  dailyRate: number;
  monthlyRate: number;
}

export interface DayCareConfig {
  tiers: DayCareTier[];
  note?: string;
}

export interface PetTaxiTier {
  weightBracket: string;
  code: string;
  name: string;
  basePrice: number;
}

export interface PetTaxiConfig {
  tiers: PetTaxiTier[];
  fuelChargePerKm: number; // default 2
  note?: string;
}

export interface PetSittingConfig {
  baseRates: {
    small: number; // PS01: Pet Sitting - S (< 10kg), default 35
    medium: number; // PS02: Pet Sitting - M (10 - 30kg), default 45
    largeXl: number; // PS03: Pet Sitting - L / XL (> 30kg), default 45
  };
  extraPetRates: {
    under25kg: number; // PS04: Extra Pet (< 25kg), default 10
    over25kg: number; // PS05: Extra Pet (> 25kg), default 20
  };
  addons: {
    walkPer10Min: number; // PS-W: Walk (every 10 min), default 15
    medFeedPerTime: number; // PS-MF: Med Feed (per time), default 10
    freshFoodPerTime: number; // PS-FF: Fresh Food Cooking (per time), default 10
    cageCleaningS: number; // PS-C01: Cage Cleaning - S, default 10
    cageCleaningM: number; // PS-C02: Cage Cleaning - M, default 20
    cageCleaningL: number; // PS-C03: Cage Cleaning - L, default 30
    cleanLivingRoom: number; // PS-C04: Cleaning - Living Room, default 25
    cleanBedroom: number; // PS-C05: Cleaning - Bedroom, default 10
    cleanKitchen: number; // PS-C06: Cleaning - Kitchen, default 15
    cleanCarpark: number; // PS-C07: Cleaning - Carpark Area, default 20
  };
  peakSurcharge: number; // S-PP: Peak Period Surcharge, default 30
}

export interface CustomerBookingInput {
    customerName: string;
    customerContact: string;
    countryCode?: string;
    primaryService: Booking['primaryService'];
    checkInDate: string;
    checkInTime?: string;
    checkOutDate?: string;
    numberOfPets: number;
    pets: BookingPet[];
    depositReceiptUrl?: string;
    notes?: string;
    totalAmountOverride?: number;
    boardingBreakdown?: Booking['boardingBreakdown'];
    groomingBreakdown?: Booking['groomingBreakdown'];
    petSittingBreakdown?: Booking['petSittingBreakdown'];
    dayCareFrequency?: 'Daily' | 'Monthly';
    petTaxiKm?: number;
}

export interface ManualBookingInput extends CustomerBookingInput {
  depositRequiredOverride?: number;
  staffAssigned?: string;
}

export interface ReceiptConfig {
  layout: 'standard' | 'compact';
  invoiceTitle: string; depositTitle: string; finalTitle: string;
  footer: string; showLogo: boolean; showBankDetails: boolean; showSignature: boolean;
  invoicePrefix: string; depositPrefix: string; finalPrefix: string;
}
export interface GroomingPricing {
  shortCoat: number[]; longCoat: number[]; doubleCoat: number[];
  shavedDown: number[]; summerCut: number[]; pantsCut: number[]; handCut: number[];
  alaska: number; poodle: number; catSmall: number; catLarge: number;
  extraWeight: number[];
  addons: { name: string; price: number }[];
}
