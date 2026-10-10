import { 
  Customer, 
  Room, 
  ServiceItem, 
  StoreCreditRecord, 
  StaffAccount, 
  SystemConfig, 
  Booking,
  CustomerBoardingRoom,
  PetSittingConfig,
  DayCareConfig,
  PetTaxiConfig
} from '../types';

export const defaultDayCareConfig: DayCareConfig = {
  tiers: [
    { weightBracket: '< 5kg', code: 'DCD01', name: 'Small (< 5kg)', dailyRate: 25, monthlyRate: 450 },
    { weightBracket: '6 - 12 kg', code: 'DCD02', name: 'Medium (6 - 12kg)', dailyRate: 30, monthlyRate: 550 },
    { weightBracket: '13 - 20 kg', code: 'DCD03', name: 'Large (13 - 20kg)', dailyRate: 40, monthlyRate: 720 },
    { weightBracket: '21 - 30 kg', code: 'DCD04', name: 'Extra Large (21 - 30kg)', dailyRate: 50, monthlyRate: 900 },
    { weightBracket: '> 30 kg', code: 'DCD05', name: 'Giant / XXL (> 30kg)', dailyRate: 60, monthlyRate: 1080 },
  ],
  note: 'Day Care available for full-day care. Daily rate includes supervision, scheduled playtime, and fresh water.'
};

export const defaultPetTaxiConfig: PetTaxiConfig = {
  tiers: [
    { weightBracket: '< 10kg', code: 'T01', name: 'Pet Taxi Pick Up / Drop Off - Small (< 10kg)', basePrice: 20 },
    { weightBracket: '10 - 30kg', code: 'T02', name: 'Pet Taxi Pick Up / Drop Off - Medium (10 - 30kg)', basePrice: 30 },
    { weightBracket: '> 30kg', code: 'T03', name: 'Pet Taxi Pick Up / Drop Off - Large (> 30kg)', basePrice: 40 },
  ],
  fuelChargePerKm: 2,
  note: 'Fuel charge calculated per KM per trip based on travel mileage.'
};

export const defaultPetSittingConfig: PetSittingConfig = {
  baseRates: {
    small: 35, // PS01: Pet Sitting - S (< 10kg)
    medium: 45, // PS02: Pet Sitting - M (10 - 30kg)
    largeXl: 45, // PS03: Pet Sitting - L / XL (> 30kg)
  },
  extraPetRates: {
    under25kg: 10, // PS04: Pet Sitting - Extra Pet (< 25kg)
    over25kg: 20, // PS05: Pet Sitting - Extra Pet (> 25kg)
  },
  addons: {
    walkPer10Min: 15, // PS-W: Pet Sitting - Walk (Every 10 min)
    medFeedPerTime: 10, // PS-MF: Pet Sitting - Med Feed (Per Time)
    freshFoodPerTime: 10, // PS-FF: Pet Sitting - Fresh Food Cooking (Per Time)
    cageCleaningS: 10, // PS-C01: Pet Sitting - Cage Cleaning - S (Per Cage)
    cageCleaningM: 20, // PS-C02: Pet Sitting - Cage Cleaning - M (Per Cage)
    cageCleaningL: 30, // PS-C03: Pet Sitting - Cage Cleaning - L (Per Cage)
    cleanLivingRoom: 25, // PS-C04: Pet Sitting - Cleaning - Living Room (Per Visit)
    cleanBedroom: 10, // PS-C05: Pet Sitting - Cleaning - Bedroom (Per Visit)
    cleanKitchen: 15, // PS-C06: Pet Sitting - Cleaning - Kitchen (Per Visit)
    cleanCarpark: 20, // PS-C07: Pet Sitting - Cleaning - Carpark Area (Per Visit)
  },
  peakSurcharge: 30, // S-PP: Peak Period Surcharge (Per Order)
};

export const initialSystemConfig: SystemConfig = {
  shopName: 'Pet Loft',
  legalShopName: 'MELLOW PET LOFT CONCEPT STORE',
  ssmNumber: '202603177978 (PG0590131-W)',
  address: '22, Jalan Pulai Mutiara 4/12, Taman Pulai Mutiara, 81300 Johor Bahru, Johor',
  phone: '+60 17-732 9954',
  email: 'petloft25@gmail.com',
  bankName: 'Maybank',
  accountName: 'Pet Loft Concept Store',
  accountNumber: '5516 0506 6646',
  instagramUrl: 'https://instagram.com/petloft',
  xhsUrl: 'https://www.xiaohongshu.com',

  // Original shop spreadsheet shortcut; opening it does not change its contents.
  directGoogleSheetUrl: 'https://docs.google.com/spreadsheets/d/1ca_oXG1Gi3OClGypvm52CiBELiY9YVxbBGebwLOXKe8/edit?usp=sharing',

  // Online Payment Closed by default
  onlinePaymentEnabled: false,

  // Staff credit management permission (default false = view only for staff)
  staffCanManageCredit: false,

  // Default credentials
  staffCredentials: {
    username: 'staff',
    passwordHash: { algorithm: 'PBKDF2-SHA256', iterations: 600000, salt: 'a0c1f75c04c362faa5db7876845de958', digest: 'e840fd1919cd7dffc05d0a88a5de6f1eb692b5a392026a54606bc303848c2bb8' },
  },
  bossCredentials: {
    username: 'admin',
    passwordHash: { algorithm: 'PBKDF2-SHA256', iterations: 600000, salt: '39c5342ce11c54ff48ed7a4c6b342812', digest: 'aed9edc0e0783a186b68976f1b3150e76f729190aaffd59ee7624c0321694e65' },
  },

  operatingHours: {
    openTime: '10:00',
    closeTime: '19:00',
    bufferMinutes: 30,
  },

  formFieldConfig: {
    petNameRequired: false,
    petBreedRequired: false,
    vaxDateRequired: false,
    birthDateRequired: false,
    notesRequired: false,
  },

  depositConfig: {
    minDepositAmount: 30,
    percentageThreshold: 150,
    percentageRate: 0.3,
    peakSurcharge: 30,
  },

  groomingCapacity: {
    activeDays: [1, 2, 3, 4, 5, 6],
    maxDogsPerDay: 4,
  },

  roomAssignmentRules: [
    { id: 'rule-1', species: 'Dog', weightBracket: '< 5kg', preferredRooms: ['D-01', 'D-02'], maxPetsPerRoom: 2 },
    { id: 'rule-2', species: 'Dog', weightBracket: '6 - 12 kg', preferredRooms: ['D-02', 'D-03'], maxPetsPerRoom: 2 },
    { id: 'rule-3', species: 'Dog', weightBracket: '13 - 20 kg', preferredRooms: ['D-03', 'D-04'], maxPetsPerRoom: 2 },
    { id: 'rule-4', species: 'Dog', weightBracket: '21 - 30 kg', preferredRooms: ['D-03', 'D-04'], maxPetsPerRoom: 1 },
    { id: 'rule-5', species: 'Dog', weightBracket: '> 30 kg', preferredRooms: ['D-04'], maxPetsPerRoom: 1 },
    { id: 'rule-6', species: 'Cat', weightBracket: '< 5kg', preferredRooms: ['C-01', 'C-02', 'C-03'], maxPetsPerRoom: 3 },
    { id: 'rule-7', species: 'Cat', weightBracket: '6 - 12 kg', preferredRooms: ['C-02', 'C-03'], maxPetsPerRoom: 2 },
    { id: 'rule-8', species: 'Cat', weightBracket: '13 - 20 kg', preferredRooms: ['C-03'], maxPetsPerRoom: 1 },
  ],

  bookingStatuses: [
    { id: 'deposit_pending', label: 'Deposit Verification Pending', color: 'bg-amber-100 text-amber-800 border-amber-300' },
    { id: 'booked', label: 'Booked / Confirmed', color: 'bg-blue-100 text-blue-800 border-blue-300' },
    { id: 'waiting_onboard', label: 'Waiting for Onboard', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
    { id: 'onboarding', label: 'Onboarding / Checked-In', color: 'bg-purple-100 text-purple-800 border-purple-300' },
    { id: 'grooming', label: 'Grooming In-Progress', color: 'bg-pink-100 text-pink-800 border-pink-300' },
    { id: 'ready_pickup', label: 'Ready for Pick-Up', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    { id: 'completed', label: 'Completed', color: 'bg-slate-100 text-slate-800 border-slate-300' },
    { id: 'cancelled', label: 'Cancelled', color: 'bg-rose-100 text-rose-800 border-rose-300' },
  ],

  customerBoardingRooms: [
    // Dog Boarding Rooms
    { 
      id: 'Studio', 
      species: 'Dog', 
      title: 'Studio Fence', 
      price: 39, 
      capacity: 1, 
      desc: 'Fit 1 dog • 1 dog per room only', 
      extraPetPrice: 0,
      active: true 
    },
    { 
      id: 'Superior Room', 
      species: 'Dog', 
      title: 'Superior Room', 
      price: 65, 
      capacity: 2, 
      desc: 'Medium Cage • Fit up to 2 dogs • +RM10/dog start from 2nd dog', 
      extraPetPrice: 10,
      active: true 
    },
    { 
      id: 'Deluxe Room', 
      species: 'Dog', 
      title: 'Deluxe Room', 
      price: 98, 
      capacity: 3, 
      desc: 'Biggest Cage • Fit up to 3 dogs • +RM20/dog start from 2nd dog', 
      extraPetPrice: 20,
      active: true 
    },
    { 
      id: 'Suite', 
      species: 'Dog', 
      title: 'Dog Suite', 
      price: 188, 
      capacity: 4, 
      desc: 'Spacious Suite • Fit up to 4 dogs • +RM20/dog start from 2nd dog', 
      extraPetPrice: 20,
      active: true 
    },
    // Cat Boarding Rooms
    { 
      id: 'Studio', 
      species: 'Cat', 
      title: 'Cat Studio', 
      price: 28, 
      capacity: 2, 
      desc: 'Fit up to 2 cats • +RM5/cat start from 2nd cat', 
      extraPetPrice: 5,
      active: true 
    },
    { 
      id: 'Superior Room', 
      species: 'Cat', 
      title: 'Superior Room', 
      price: 38, 
      capacity: 4, 
      desc: 'Fit up to 4 cats • +RM5/cat start from 2nd cat', 
      extraPetPrice: 5,
      active: true 
    },
    { 
      id: 'Deluxe Room', 
      species: 'Cat', 
      title: 'Deluxe Room', 
      price: 48, 
      capacity: 4, 
      desc: 'Fit up to 4 cats • +RM5/cat start from 2nd cat', 
      extraPetPrice: 5,
      active: true 
    },
    { 
      id: 'Suite', 
      species: 'Cat', 
      title: 'Cat Master Suite', 
      price: 68, 
      capacity: 5, 
      desc: 'Fit up to 5 cats • +RM5/cat start from 2nd cat', 
      extraPetPrice: 5,
      active: true 
    },
  ],
  smallPetsBoardingFee: 10,
  dayCareConfig: defaultDayCareConfig,
  petTaxiConfig: defaultPetTaxiConfig,
  petSittingConfig: defaultPetSittingConfig,
};

export const defaultCustomerBoardingRooms: CustomerBoardingRoom[] = initialSystemConfig.customerBoardingRooms || [];

export const initialStaff: StaffAccount[] = [
  { id: 'staff-1', name: 'Allyson', role: 'Boss', phone: '+60 17-732 9954', active: true },
  { id: 'staff-2', name: 'Anson', role: 'Boss', phone: '+60 17-732 9954', active: true },
  { id: 'staff-3', name: 'Staff Team A', role: 'Staff', phone: '+60 12-345 6789', active: true },
];

export const initialRooms: Room[] = [
  // Dog Rooms
  { id: 'r-d01', roomNumber: 'D-01', species: 'Dog', category: 'Studio', basePrice: 39, maxCapacity: 1, description: 'Dog Fence Studio', status: 'available' },
  { id: 'r-d02', roomNumber: 'D-02', species: 'Dog', category: 'Superior Room', basePrice: 65, maxCapacity: 2, description: 'Medium Cage (Up to 2 dogs)', status: 'available' },
  { id: 'r-d03', roomNumber: 'D-03', species: 'Dog', category: 'Deluxe Room', basePrice: 98, maxCapacity: 3, description: 'Biggest Cage (Up to 3 dogs)', status: 'available' },
  { id: 'r-d04', roomNumber: 'D-04', species: 'Dog', category: 'Suite', basePrice: 188, maxCapacity: 4, description: 'Spacious Dog Suite Room', status: 'available' },
  { id: 'r-d05', roomNumber: 'D-05', species: 'Dog', category: 'Superior Room', basePrice: 65, maxCapacity: 2, description: 'Medium Cage B', status: 'available' },
  { id: 'r-d06', roomNumber: 'D-06', species: 'Dog', category: 'Superior Room', basePrice: 65, maxCapacity: 2, description: 'Medium Cage C', status: 'available' },
  { id: 'r-d07', roomNumber: 'D-07', species: 'Dog', category: 'Deluxe Room', basePrice: 98, maxCapacity: 3, description: 'Deluxe Cage B', status: 'available' },
  { id: 'r-d08', roomNumber: 'D-08', species: 'Dog', category: 'Suite', basePrice: 188, maxCapacity: 4, description: 'Dog Suite VIP', status: 'available' },
  // Cat Rooms
  { id: 'r-c01', roomNumber: 'C-01', species: 'Cat', category: 'Studio', basePrice: 28, maxCapacity: 2, description: 'Cat 6 Room (Up to 2 small cats)', status: 'available' },
  { id: 'r-c02', roomNumber: 'C-02', species: 'Cat', category: 'Superior Room', basePrice: 38, maxCapacity: 4, description: 'Cat 3 Room (Up to 4 small cats / 3 normal)', status: 'available' },
  { id: 'r-c03', roomNumber: 'C-03', species: 'Cat', category: 'Deluxe Room', basePrice: 48, maxCapacity: 4, description: 'Cat 1 Room (Up to 4 cats)', status: 'available' },
  { id: 'r-c04', roomNumber: 'C-04', species: 'Cat', category: 'Studio', basePrice: 28, maxCapacity: 2, description: 'Cat Studio B', status: 'available' },
  { id: 'r-c05', roomNumber: 'C-05', species: 'Cat', category: 'Studio', basePrice: 28, maxCapacity: 2, description: 'Cat Studio C', status: 'available' },
  { id: 'r-c06', roomNumber: 'C-06', species: 'Cat', category: 'Superior Room', basePrice: 38, maxCapacity: 3, description: 'Cat Superior B', status: 'available' },
  { id: 'r-c07', roomNumber: 'C-07', species: 'Cat', category: 'Superior Room', basePrice: 38, maxCapacity: 3, description: 'Cat Superior C', status: 'available' },
  { id: 'r-c08', roomNumber: 'C-08', species: 'Cat', category: 'Deluxe Room', basePrice: 48, maxCapacity: 4, description: 'Cat Deluxe B', status: 'available' },
  { id: 'r-c09', roomNumber: 'C-09', species: 'Cat', category: 'Deluxe Room', basePrice: 48, maxCapacity: 4, description: 'Cat Deluxe C', status: 'available' },
  { id: 'r-c10', roomNumber: 'C-10', species: 'Cat', category: 'Suite', basePrice: 68, maxCapacity: 5, description: 'Cat Master Suite', status: 'available' },
];

// Customer, pet, booking and credit records start empty and are added by the shop.
export const initialCustomers: Customer[] = [];
export const initialStoreCreditRecords: StoreCreditRecord[] = [];

export const initialServices: ServiceItem[] = [
  // Boarding
  { code: 'D01', name: 'Dog - Studio Fence', category: 'Boarding', basePrice: 39, unit: 'Per Night' },
  { code: 'D02', name: 'Dog - Superior Room (Medium Cage)', category: 'Boarding', basePrice: 65, unit: 'Per Night' },
  { code: 'D03', name: 'Dog - Deluxe Room (Biggest Cage)', category: 'Boarding', basePrice: 98, unit: 'Per Night' },
  { code: 'D04', name: 'Dog - Suite Room', category: 'Boarding', basePrice: 188, unit: 'Per Night' },
  { code: 'D05', name: 'Extra Dog Stay (Studio & Superior)', category: 'Boarding', basePrice: 10, unit: 'Per Night' },
  { code: 'D06', name: 'Extra Dog Stay (Deluxe & Suite)', category: 'Boarding', basePrice: 20, unit: 'Per Night' },
  { code: 'C01', name: 'Cat - Studio Room (Up to 2 cats)', category: 'Boarding', basePrice: 28, unit: 'Per Night' },
  { code: 'C02', name: 'Cat - Superior Room (Up to 4 cats)', category: 'Boarding', basePrice: 38, unit: 'Per Night' },
  { code: 'C03', name: 'Cat - Deluxe Room (Up to 4 cats)', category: 'Boarding', basePrice: 48, unit: 'Per Night' },
  { code: 'C04', name: 'Cat Boarding (Extra Cat)', category: 'Boarding', basePrice: 5, unit: 'Per Night' },

  // Dog Grooming - Basic Short Coat
  { code: 'BGS01', name: 'Basic Grooming - Short Coat (< 5kg)', category: 'Grooming', basePrice: 38, unit: 'Per Dog', weightTier: '0 - 5 kg' },
  { code: 'BGS02', name: 'Basic Grooming - Short Coat (6 - 12 kg)', category: 'Grooming', basePrice: 48, unit: 'Per Dog', weightTier: '6 - 12 kg' },
  { code: 'BGS03', name: 'Basic Grooming - Short Coat (13 - 20 kg)', category: 'Grooming', basePrice: 58, unit: 'Per Dog', weightTier: '13 - 20 kg' },
  { code: 'BGS04', name: 'Basic Grooming - Short Coat (21 - 30 kg)', category: 'Grooming', basePrice: 68, unit: 'Per Dog', weightTier: '21 - 30 kg' },
  { code: 'BGS05', name: 'Basic Grooming - Short Coat (> 30.1 kg)', category: 'Grooming', basePrice: 78, unit: 'Per Dog', weightTier: '> 30.1 kg' },

  // Dog Grooming - Basic Long Coat
  { code: 'BGL01', name: 'Basic Grooming - Long Coat (< 5kg)', category: 'Grooming', basePrice: 48, unit: 'Per Dog', weightTier: '0 - 5 kg' },
  { code: 'BGL02', name: 'Basic Grooming - Long Coat (6 - 12 kg)', category: 'Grooming', basePrice: 58, unit: 'Per Dog', weightTier: '6 - 12 kg' },
  { code: 'BGL03', name: 'Basic Grooming - Long Coat (13 - 20 kg)', category: 'Grooming', basePrice: 68, unit: 'Per Dog', weightTier: '13 - 20 kg' },
  { code: 'BGL04', name: 'Basic Grooming - Long Coat (21 - 30 kg)', category: 'Grooming', basePrice: 78, unit: 'Per Dog', weightTier: '21 - 30 kg' },
  { code: 'BGL05', name: 'Basic Grooming - Long Coat (> 30.1 kg)', category: 'Grooming', basePrice: 88, unit: 'Per Dog', weightTier: '> 30.1 kg' },

  // Dog Grooming - Double Coat
  { code: 'BGD01', name: 'Basic Grooming - Double Coat (< 5kg)', category: 'Grooming', basePrice: 58, unit: 'Per Dog', weightTier: '0 - 5 kg' },
  { code: 'BGD02', name: 'Basic Grooming - Double Coat (6 - 12 kg)', category: 'Grooming', basePrice: 68, unit: 'Per Dog', weightTier: '6 - 12 kg' },
  { code: 'BGD03', name: 'Basic Grooming - Double Coat (13 - 20 kg)', category: 'Grooming', basePrice: 88, unit: 'Per Dog', weightTier: '13 - 20 kg' },
  { code: 'BGD04', name: 'Basic Grooming - Double Coat (21 - 30 kg)', category: 'Grooming', basePrice: 98, unit: 'Per Dog', weightTier: '21 - 30 kg' },
  { code: 'BGD05', name: 'Basic Grooming - Double Coat (> 30.1 kg)', category: 'Grooming', basePrice: 108, unit: 'Per Dog', weightTier: '> 30.1 kg' },
  { code: 'BGD06', name: 'Double Coat - Alaska (< 30kg)', category: 'Grooming', basePrice: 150, unit: 'Per Dog' },
  { code: 'BGD07', name: 'Double Coat - Standard Poodle (< 30kg)', category: 'Grooming', basePrice: 120, unit: 'Per Dog' },

  // Shave Down Grooming
  { code: 'BSD01', name: 'Shave Down Grooming - S (0 - 5kg)', category: 'Grooming', basePrice: 88, unit: 'Per Visit' },
  { code: 'BSD02', name: 'Shave Down Grooming - M (6 - 12kg)', category: 'Grooming', basePrice: 98, unit: 'Per Visit' },
  { code: 'BSD03', name: 'Shave Down Grooming - L (13 - 20kg)', category: 'Grooming', basePrice: 108, unit: 'Per Visit' },
  { code: 'BSD04', name: 'Shave Down Grooming - XL (21 - 30kg)', category: 'Grooming', basePrice: 118, unit: 'Per Visit' },
  { code: 'BSD05', name: 'Shave Down Grooming - XXL (> 30.1kg)', category: 'Grooming', basePrice: 128, unit: 'Per Visit' },

  // Full Grooming Styles
  { code: 'SC01', name: 'Summer Cut (0 - 5kg)', category: 'Grooming', basePrice: 108, unit: 'Per Visit' },
  { code: 'SC02', name: 'Summer Cut (6 - 12kg)', category: 'Grooming', basePrice: 118, unit: 'Per Visit' },
  { code: 'SC03', name: 'Summer Cut (13 - 20kg)', category: 'Grooming', basePrice: 128, unit: 'Per Visit' },
  { code: 'SC04', name: 'Summer Cut (21 - 30kg)', category: 'Grooming', basePrice: 138, unit: 'Per Visit' },
  { code: 'SC05', name: 'Summer Cut (> 30.1kg)', category: 'Grooming', basePrice: 148, unit: 'Per Visit' },

  { code: 'PC01', name: 'Pants Cut (0 - 5kg)', category: 'Grooming', basePrice: 140, unit: 'Per Visit' },
  { code: 'PC02', name: 'Pants Cut (6 - 12kg)', category: 'Grooming', basePrice: 160, unit: 'Per Visit' },
  { code: 'PC03', name: 'Pants Cut (13 - 20kg)', category: 'Grooming', basePrice: 180, unit: 'Per Visit' },
  { code: 'PC04', name: 'Pants Cut (21 - 30kg)', category: 'Grooming', basePrice: 200, unit: 'Per Visit' },
  { code: 'PC05', name: 'Pants Cut (> 30.1kg)', category: 'Grooming', basePrice: 250, unit: 'Per Visit' },

  { code: 'HC01', name: 'Hand Cut (Scissors Cut) (0 - 5kg)', category: 'Grooming', basePrice: 190, unit: 'Per Visit' },
  { code: 'HC02', name: 'Hand Cut (Scissors Cut) (6 - 12kg)', category: 'Grooming', basePrice: 210, unit: 'Per Visit' },
  { code: 'HC03', name: 'Hand Cut (Scissors Cut) (13 - 20kg)', category: 'Grooming', basePrice: 240, unit: 'Per Visit' },
  { code: 'HC04', name: 'Hand Cut (Scissors Cut) (21 - 30kg)', category: 'Grooming', basePrice: 270, unit: 'Per Visit' },
  { code: 'HC05', name: 'Hand Cut (Scissors Cut) (> 30.1kg)', category: 'Grooming', basePrice: 300, unit: 'Per Visit' },

  // Cat Grooming
  { code: 'BGC01', name: 'Basic Grooming - Cat Short Hair', category: 'Grooming', basePrice: 50, unit: 'Per Cat' },
  { code: 'BGC02', name: 'Basic Grooming - Cat Double Coated Short Hair', category: 'Grooming', basePrice: 75, unit: 'Per Cat' },
  { code: 'BGC03', name: 'Basic Grooming - Cat Long Hair (< 2kg)', category: 'Grooming', basePrice: 68, unit: 'Per Cat' },
  { code: 'BGC04', name: 'Basic Grooming - Cat Long Hair (2.1 - 5kg)', category: 'Grooming', basePrice: 78, unit: 'Per Cat' },
  { code: 'BGC05', name: 'Basic Grooming - Cat Long Hair (> 5.1kg)', category: 'Grooming', basePrice: 88, unit: 'Per Cat' },
  { code: 'A-CD', name: 'Cat Deep Degreasing Treatment', category: 'Additional Service', basePrice: 20, unit: 'Base Price' },

  // Additional Grooming Treatments
  { code: 'A-NTF', name: 'Nails Trimming & Filing', category: 'Additional Service', basePrice: 15, unit: 'Per Visit' },
  { code: 'A-EC', name: 'Ear Cleaning', category: 'Additional Service', basePrice: 15, unit: 'Per Visit' },
  { code: 'A-UT', name: 'Underpad Trimming', category: 'Additional Service', basePrice: 15, unit: 'Per Visit' },
  { code: 'A-ST', name: 'Sanitary Area / Under Tail / Tummy Trimming', category: 'Additional Service', basePrice: 15, unit: 'Per Visit' },
  { code: 'A-TFSS', name: 'Tick & Flea Solution (Small Breed)', category: 'Additional Service', basePrice: 10, unit: 'Per Visit' },
  { code: 'A-TFSML', name: 'Tick & Flea Solution (Med & Large Breed)', category: 'Additional Service', basePrice: 20, unit: 'Per Visit' },
  { code: 'A-DR', name: 'Deshedding / Inner Coat Removal', category: 'Additional Service', basePrice: 30, unit: 'Base Price' },
  { code: 'A-TRF', name: 'Trim to Round Feet', category: 'Additional Service', basePrice: 15, unit: 'Base Price' },
  { code: 'A-TRH', name: 'Trim to Round Head', category: 'Additional Service', basePrice: 15, unit: 'Base Price' },
  { code: 'A-FTS', name: 'Medicinal / Flea & Tick Shampoo', category: 'Additional Service', basePrice: 15, unit: 'Base Price' },
  { code: 'A-UM', name: 'Unmatting Service', category: 'Additional Service', basePrice: 10, unit: 'Base Price' },

  // Pet Sitting Base Rates & Extra Pets
  { code: 'PS01', name: 'Pet Sitting - S', category: 'Pet Sitting', basePrice: 35, unit: 'Per Pet', weightTier: '< 10' },
  { code: 'PS02', name: 'Pet Sitting - M', category: 'Pet Sitting', basePrice: 45, unit: 'Per Pet', weightTier: '10 - 30' },
  { code: 'PS03', name: 'Pet Sitting - L / XL', category: 'Pet Sitting', basePrice: 45, unit: 'Per Pet', weightTier: '> 30' },
  { code: 'PS04', name: 'Pet Sitting - Extra Pet', category: 'Pet Sitting', basePrice: 10, unit: 'Per Pet (Max. 3)', weightTier: '< 25' },
  { code: 'PS05', name: 'Pet Sitting - Extra Pet', category: 'Pet Sitting', basePrice: 20, unit: 'Per Pet (Max. 3)', weightTier: '> 25' },

  // Pet Sitting Additional Services
  { code: 'PS-W', name: 'Pet Sitting - Walk', category: 'Pet Sitting', basePrice: 15, unit: 'Every 10 min' },
  { code: 'PS-MF', name: 'Pet Sitting - Med Feed', category: 'Pet Sitting', basePrice: 10, unit: 'Per Time' },
  { code: 'PS-FF', name: 'Pet Sitting - Fresh Food Cooking', category: 'Pet Sitting', basePrice: 10, unit: 'Per Time' },
  { code: 'PS-C01', name: 'Pet Sitting - Cage Cleaning - S', category: 'Pet Sitting', basePrice: 10, unit: 'Per Cage' },
  { code: 'PS-C02', name: 'Pet Sitting - Cage Cleaning - M', category: 'Pet Sitting', basePrice: 20, unit: 'Per Cage' },
  { code: 'PS-C03', name: 'Pet Sitting - Cage Cleaning - L', category: 'Pet Sitting', basePrice: 30, unit: 'Per Cage' },
  { code: 'PS-C04', name: 'Pet Sitting - Cleaning - Living Room', category: 'Pet Sitting', basePrice: 25, unit: 'Per Visit' },
  { code: 'PS-C05', name: 'Pet Sitting - Cleaning - Bedroom', category: 'Pet Sitting', basePrice: 10, unit: 'Per Visit' },
  { code: 'PS-C06', name: 'Pet Sitting - Cleaning - Kitchen', category: 'Pet Sitting', basePrice: 15, unit: 'Per Visit' },
  { code: 'PS-C07', name: 'Pet Sitting - Cleaning - Carpark Area', category: 'Pet Sitting', basePrice: 20, unit: 'Per Visit' },

  // Pet Taxi & Day Care
  { code: 'T01', name: 'Pet Taxi Pick Up / Drop Off - Small (< 10kg)', category: 'Pet Taxi', basePrice: 20, unit: 'Per Pet' },
  { code: 'T02', name: 'Pet Taxi Pick Up / Drop Off - Medium (10 - 30kg)', category: 'Pet Taxi', basePrice: 30, unit: 'Per Pet' },
  { code: 'T03', name: 'Pet Taxi Pick Up / Drop Off - Large (> 30kg)', category: 'Pet Taxi', basePrice: 40, unit: 'Per Pet' },
  { code: 'FC', name: 'Fuel Charge - Per KM Per Trip', category: 'Pet Taxi', basePrice: 2, unit: 'Per KM' },

  { code: 'DCD01', name: 'Day Care - S (< 5kg)', category: 'Day Care', basePrice: 25, unit: 'Per Day' },
  { code: 'DCD02', name: 'Day Care - M (6 - 12kg)', category: 'Day Care', basePrice: 30, unit: 'Per Day' },
  { code: 'DCD03', name: 'Day Care - L (13 - 20kg)', category: 'Day Care', basePrice: 40, unit: 'Per Day' },
  { code: 'DCD04', name: 'Day Care - XL (21 - 30kg)', category: 'Day Care', basePrice: 50, unit: 'Per Day' },
  { code: 'DCD05', name: 'Day Care - XXL (> 30kg)', category: 'Day Care', basePrice: 60, unit: 'Per Day' },
  { code: 'CDF', name: 'Cat Dry Food Add-on', category: 'Boarding', basePrice: 5, unit: 'Per Day' },
  { code: 'S-PP', name: 'Peak Period Surcharge', category: 'Surcharge', basePrice: 30, unit: 'Per Order' },
];

export const initialBookings: Booking[] = [];
