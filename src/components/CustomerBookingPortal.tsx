import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { defaultGroomingPricing, quoteGroomingPet, quoteDeposit } from '../lib/pricing';
import { validateReceiptFile, validateReceiptDataUrl } from '../lib/systemRules';
import { 
  BookingPet, 
  ServiceType, 
  WeightBracket, 
  SpeciesType, 
  CustomerBoardingRoom, 
  PetSittingBreakdown, 
  PetSittingAddonItem 
} from '../types';
import { 
  defaultCustomerBoardingRooms, 
  defaultPetSittingConfig,
  defaultDayCareConfig,
  defaultPetTaxiConfig 
} from '../data/seedData';
import { 
  PawPrint, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ExternalLink, 
  Phone, 
  DollarSign, 
  Building2, 
  QrCode,
  Clock,
  Home,
  MessageCircle,
  Scissors,
  Car,
  HeartHandshake,
  Check,
  Plus,
  Minus,
  X, 
  Calendar
} from 'lucide-react';

const DdMmYyyyDateInput: React.FC<{
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, placeholder = 'DD/MM/YYYY', className }) => {
  const hiddenDateRef = React.useRef<HTMLInputElement>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9/]/g, '');
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) {
      onChange(digits);
    } else if (digits.length <= 4) {
      onChange(`${digits.slice(0, 2)}/${digits.slice(2)}`);
    } else {
      onChange(`${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`);
    }
  };

  const handleNativePicker = (e: React.ChangeEvent<HTMLInputElement>) => {
    const iso = e.target.value; // YYYY-MM-DD
    if (!iso) return;
    const parts = iso.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      onChange(`${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`);
    }
  };

  return (
    <div className="relative flex items-center">
      <input
        type="text"
        maxLength={10}
        value={value || ''}
        onChange={handleTextChange}
        placeholder={placeholder}
        className={
          className ||
          'w-full pl-3 pr-9 py-2 text-sm rounded-xl border border-slate-300 focus:border-amber-600 focus:outline-hidden bg-white font-medium text-slate-800'
        }
      />
      <button
        type="button"
        onClick={() => {
          if (hiddenDateRef.current) {
            if (typeof (hiddenDateRef.current as any).showPicker === 'function') {
              (hiddenDateRef.current as any).showPicker();
            } else {
              hiddenDateRef.current.click();
            }
          }
        }}
        className="absolute right-2 p-1 text-slate-400 hover:text-amber-700 transition-colors cursor-pointer rounded"
        title="Select date from calendar"
      >
        <Calendar className="w-4 h-4" />
      </button>
      <input
        ref={hiddenDateRef}
        type="date"
        tabIndex={-1}
        onChange={handleNativePicker}
        className="sr-only pointer-events-none"
      />
    </div>
  );
};

const COUNTRY_CODES = [
  { code: '+60', label: '🇲🇾 Malaysia (+60)' },
  { code: '+65', label: '🇸🇬 Singapore (+65)' },
  { code: '+62', label: '🇮🇩 Indonesia (+62)' },
  { code: '+66', label: '🇹🇭 Thailand (+66)' },
  { code: '+61', label: '🇦🇺 Australia (+61)' },
  { code: '+44', label: '🇬🇧 UK (+44)' },
  { code: '+1', label: '🇺🇸 US / Canada (+1)' },
];

export const CustomerBookingPortal: React.FC = () => {
  const { systemConfig, createCustomerBooking, getCalculatedTimeSlots } = useApp();
  const groomingPricing=systemConfig.groomingPricing||defaultGroomingPricing;
  const DOG_ADDITIONAL_SERVICES=groomingPricing.addons;

  // Step 0: Primary Pet Species (Dog, Cat, Rabbit, Hamster, Bird)
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesType>('Dog');

  // Step 1: Number of Pets
  const [numberOfPets, setNumberOfPets] = useState<number>(1);

  // Step 2: Pets Information (Room type selection removed from Step 2)
  const [pets, setPets] = useState<BookingPet[]>([
    {
      species: 'Dog',
      weightBracket: '< 5kg',
      petName: '',
      breed: '',
      vaxExpiryDate: '',
      birthDate: '',
      characteristics: '',
      allergiesNotes: '',
    },
  ]);

  // Step 3: Owner Details
  const [ownerName, setOwnerName] = useState('');
  const [countryCode, setCountryCode] = useState('+60');
  const [whatsappNumber, setWhatsappNumber] = useState('');

  // Step 4: Service & Scheduled Time
  const [primaryService, setPrimaryService] = useState<ServiceType>('Boarding');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');

  // Boarding Details
  const [boardingRoomType, setBoardingRoomType] = useState<string>('Superior Room');
  const [petsPerRoom, setPetsPerRoom] = useState<number>(1);
  const [housingArrangement, setHousingArrangement] = useState<'separate' | 'shared'>('separate');
  const [allocatedRoomsList, setAllocatedRoomsList] = useState<Array<{ id: string; roomTypeId: string; petsCount: number }>>([
    { id: 'Superior-init', roomTypeId: 'Superior Room', petsCount: 1 }
  ]);

  // Dynamic room options for the currently selected species from systemConfig (Boss Settings) with fallback to default presets
  const activeRoomOptionsForSpecies = useMemo<CustomerBoardingRoom[]>(() => {
    const allRooms = (systemConfig.customerBoardingRooms && systemConfig.customerBoardingRooms.length > 0)
      ? systemConfig.customerBoardingRooms
      : defaultCustomerBoardingRooms;
    const filtered = allRooms.filter((r) => r.species === selectedSpecies && r.active !== false);
    if (filtered.length > 0) return filtered;
    return defaultCustomerBoardingRooms.filter((r) => r.species === selectedSpecies);
  }, [systemConfig.customerBoardingRooms, selectedSpecies]);

  // Grooming Details
  const [dogGroomingCategory, setDogGroomingCategory] = useState<'Basic Grooming' | 'Shaved Down' | 'Full Grooming'>('Basic Grooming');
  const [dogCoatType, setDogCoatType] = useState<'Short Coat' | 'Long Coat' | 'Double Coat'>('Short Coat');
  const [dogFullStyle, setDogFullStyle] = useState<'Summer Cut' | 'Pants Cut' | 'Hand Cut'>('Summer Cut');
  const [dogExtraWeightBracket, setDogExtraWeightBracket] = useState<string>('NA');
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  // Day Care Details
  const [dayCarePlan, setDayCarePlan] = useState<'Daily' | 'Monthly'>('Daily');

  // Pet Taxi Details
  const [taxiKm, setTaxiKm] = useState<number>(5);

  // Pet Sitting Details (Base, Extra Pets, Additional Services & Peak Surcharge)
  const [sittingWalkMinutes, setSittingWalkMinutes] = useState<number>(0);
  const [sittingMedsCount, setSittingMedsCount] = useState<number>(0);
  const [sittingFoodCount, setSittingFoodCount] = useState<number>(0);
  const [sittingCageCleanS, setSittingCageCleanS] = useState<number>(0);
  const [sittingCageCleanM, setSittingCageCleanM] = useState<number>(0);
  const [sittingCageCleanL, setSittingCageCleanL] = useState<number>(0);
  const [sittingCleanLivingRoom, setSittingCleanLivingRoom] = useState<boolean>(false);
  const [sittingCleanBedrooms, setSittingCleanBedrooms] = useState<number>(0);
  const [sittingCleanKitchen, setSittingCleanKitchen] = useState<boolean>(false);
  const [sittingCleanCarpark, setSittingCleanCarpark] = useState<boolean>(false);
  const [sittingPeakPeriod, setSittingPeakPeriod] = useState<boolean>(false);

  // Payment Proof
  const [receiptFile, setReceiptFile] = useState<string | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string>('');

  // Submission result state
  const [submittedBooking, setSubmittedBooking] = useState<{
    reference: string;
    totalAmount: number;
    depositRequired: number;
    balanceDue: number;
    status: string;
    paymentStatus: string;
    checkInTime?: string;
  } | null>(null);

  const [formError, setFormError] = useState<string | null>(null);

  const cleanStorePhone = systemConfig.phone.replace(/[^0-9]/g, '');
  const storeWhatsAppUrl = `https://wa.me/${cleanStorePhone}`;

  // Keep species synced across pets when primary species changes
  useEffect(() => {
    setPets((prev) =>
      prev.map((p) => ({
        ...p,
        species: selectedSpecies,
      }))
    );
    // If Rabbit, Hamster, or Bird, Grooming is not available; default to Boarding
    if (selectedSpecies !== 'Dog' && selectedSpecies !== 'Cat' && primaryService === 'Grooming') {
      setPrimaryService('Boarding');
    }
    // Update default boarding room type and allocations for the new species
    const firstRoom = activeRoomOptionsForSpecies[0];
    if (firstRoom) {
      setBoardingRoomType(firstRoom.id);
      if (numberOfPets === 1) {
        setAllocatedRoomsList([
          { id: `${firstRoom.id}-init`, roomTypeId: firstRoom.id, petsCount: 1 }
        ]);
      } else {
        ensureDefaultSharedAllocations(numberOfPets, firstRoom);
      }
    }
  }, [selectedSpecies, primaryService, activeRoomOptionsForSpecies]);

  // Special Breed auto-detection for Dog: Alaska & Standard Poodle (<30kg) -> Double Coat
  useEffect(() => {
    if (selectedSpecies === 'Dog') {
      const firstPetBreed = (pets[0]?.breed || '').toLowerCase();
      if (firstPetBreed.includes('alaska') || firstPetBreed.includes('standard poodle')) {
        setDogCoatType('Double Coat');
      }
    }
  }, [pets, selectedSpecies]);

  // Helper to ensure sensible default shared allocation for any species
  const ensureDefaultSharedAllocations = (forcedCount?: number, overrideFirstRoom?: CustomerBoardingRoom) => {
    const targetPets = forcedCount !== undefined ? forcedCount : numberOfPets;
    const roomOptions = activeRoomOptionsForSpecies.length > 0 
      ? activeRoomOptionsForSpecies 
      : (overrideFirstRoom ? [overrideFirstRoom] : []);

    const list: Array<{ id: string; roomTypeId: string; petsCount: number }> = [];
    if (selectedSpecies === 'Dog') {
      if (targetPets === 2) {
        list.push({ id: `Superior-${Date.now()}-1`, roomTypeId: 'Superior Room', petsCount: 2 });
      } else if (targetPets === 3) {
        list.push({ id: `Deluxe-${Date.now()}-1`, roomTypeId: 'Deluxe Room', petsCount: 3 });
      } else if (targetPets === 4) {
        list.push({ id: `Suite-${Date.now()}-1`, roomTypeId: 'Suite', petsCount: 4 });
      } else if (targetPets === 5) {
        list.push({ id: `Deluxe-${Date.now()}-1`, roomTypeId: 'Deluxe Room', petsCount: 3 });
        list.push({ id: `Superior-${Date.now()}-2`, roomTypeId: 'Superior Room', petsCount: 2 });
      } else {
        list.push({ id: `Superior-${Date.now()}-1`, roomTypeId: 'Superior Room', petsCount: targetPets });
      }
    } else if (selectedSpecies === 'Cat') {
      if (targetPets <= 2) {
        list.push({ id: `Studio-${Date.now()}-1`, roomTypeId: 'Studio', petsCount: targetPets });
      } else if (targetPets <= 4) {
        list.push({ id: `Superior-${Date.now()}-1`, roomTypeId: 'Superior Room', petsCount: targetPets });
      } else {
        list.push({ id: `Suite-${Date.now()}-1`, roomTypeId: 'Suite', petsCount: targetPets });
      }
    } else {
      // Small Pets: Rabbit, Hamster, Bird
      const primaryRoom = roomOptions[0] || { id: `${selectedSpecies} Standard Enclosure`, capacity: 2 };
      const cap = primaryRoom.capacity || 2;
      let remaining = targetPets;
      let idx = 1;
      while (remaining > 0) {
        const take = Math.min(cap, remaining);
        list.push({
          id: `${primaryRoom.id}-${Date.now()}-${idx}`,
          roomTypeId: primaryRoom.id,
          petsCount: take,
        });
        remaining -= take;
        idx++;
      }
    }
    setAllocatedRoomsList(list);
  };

  // Add another room instance (e.g. 2nd Studio Fence, 2nd Deluxe Room, 2nd Enclosure)
  const handleAddRoomInstance = (roomTypeId: string) => {
    const room = activeRoomOptionsForSpecies.find((r) => r.id === roomTypeId);
    if (!room) return;

    const currentTotal = allocatedRoomsList.reduce((sum, item) => sum + item.petsCount, 0);
    const remaining = Math.max(1, numberOfPets - currentTotal);
    const initialPets = Math.min(room.capacity, remaining);

    const newInstance = {
      id: `${roomTypeId}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      roomTypeId,
      petsCount: initialPets,
    };
    setAllocatedRoomsList((prev) => [...prev, newInstance]);
  };

  // Remove a specific room instance
  const handleRemoveRoomInstance = (instanceId: string) => {
    setAllocatedRoomsList((prev) => prev.filter((item) => item.id !== instanceId));
  };

  // Update pets count in a specific room instance
  const handleUpdateInstancePets = (instanceId: string, count: number) => {
    setAllocatedRoomsList((prev) =>
      prev.map((item) => {
        if (item.id === instanceId) {
          const room = activeRoomOptionsForSpecies.find((r) => r.id === item.roomTypeId);
          const maxCap = room?.capacity || 4;
          return { ...item, petsCount: Math.max(1, Math.min(maxCap, count)) };
        }
        return item;
      })
    );
  };

  // Toggle room type (if active, remove all rooms of this type; if inactive, add first room)
  const handleToggleRoomType = (roomTypeId: string) => {
    const existing = allocatedRoomsList.filter((item) => item.roomTypeId === roomTypeId);
    if (existing.length > 0) {
      setAllocatedRoomsList((prev) => prev.filter((item) => item.roomTypeId !== roomTypeId));
    } else {
      handleAddRoomInstance(roomTypeId);
    }
  };

  // Handle number of pets change
  const handlePetCountChange = (count: number) => {
    setNumberOfPets(count);
    const newPets = [...pets];
    while (newPets.length < count) {
      newPets.push({
        species: selectedSpecies,
        weightBracket: '< 5kg',
        petName: '',
        breed: '',
        vaxExpiryDate: '',
        birthDate: '',
        characteristics: '',
        allergiesNotes: '',
      });
    }
    setPets(newPets.slice(0, count));
    if (petsPerRoom > count) {
      setPetsPerRoom(count);
    }
    if (count > 1) {
      ensureDefaultSharedAllocations(count);
    } else {
      const firstRoom = activeRoomOptionsForSpecies[0];
      if (firstRoom) {
        setAllocatedRoomsList([
          { id: `${firstRoom.id}-init`, roomTypeId: firstRoom.id, petsCount: 1 }
        ]);
      }
    }
  };

  const updatePetField = (index: number, field: keyof BookingPet, value: any) => {
    setPets((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const [receiptError, setReceiptError] = useState('');
  const [receiptReading, setReceiptReading] = useState(false);
  const receiptReadVersion = useRef(0);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const version = ++receiptReadVersion.current;
    const file = e.target.files?.[0];
    setReceiptFile(''); setReceiptFileName(''); setReceiptError(''); setReceiptReading(false);
    if (!file) return;
    try { validateReceiptFile(file); }
    catch (error) {
      e.target.value = '';
      setReceiptError(error instanceof Error ? error.message : 'Unable to attach receipt.');
      return;
    }
    setReceiptReading(true);
    const reader = new FileReader();
    reader.onload = () => {
      if (version !== receiptReadVersion.current) return;
      try {
        const value = String(reader.result || '');
        validateReceiptDataUrl(value);
        setReceiptFile(value); setReceiptFileName(file.name);
      } catch (error) { setReceiptError(error instanceof Error ? error.message : 'Unable to attach receipt.'); }
      setReceiptReading(false);
    };
    reader.onerror = () => {
      if (version !== receiptReadVersion.current) return;
      setReceiptReading(false); setReceiptError('The receipt could not be read. Choose it again.');
    };
    reader.readAsDataURL(file);
  };

  // Available time slots based on service
  const availableTimeSlots = getCalculatedTimeSlots(primaryService);

  // ================= PRICING ENGINE =================
  const calculateDetailedServicePrice = () => {
    // 1. BOARDING PRICING ENGINE
    if (primaryService === 'Boarding') {
      let nights = 1;
      if (checkInDate && checkOutDate) {
        const start = new Date(checkInDate);
        const end = new Date(checkOutDate);
        const diff = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        nights = Math.max(1, diff);
      }

      // Small Pets (Rabbit, Hamster, Bird): Flat per-night fee per pet, owners bring own cage
      if (selectedSpecies !== 'Dog' && selectedSpecies !== 'Cat') {
        const ratePerNight = systemConfig.smallPetsBoardingFee ?? 10;
        const totalPerNight = ratePerNight * numberOfPets;
        const total = totalPerNight * nights;
        return {
          total,
          details: {
            title: `${selectedSpecies} Boarding (Own Cage)`,
            unitPrice: ratePerNight,
            nights,
            numberOfPets,
            totalPerNight,
            arrangement: 'own_cage',
            summaryText: `${selectedSpecies} Boarding (Own Cage) -- RM ${ratePerNight} × ${numberOfPets} pet${numberOfPets > 1 ? 's' : ''} × ${nights} night${nights > 1 ? 's' : ''} = RM ${total}`,
          },
        };
      }

      const roomOptions = activeRoomOptionsForSpecies;

      // 1 Pet Only
      if (numberOfPets === 1) {
        const room = roomOptions.find((r) => r.id === boardingRoomType) || roomOptions[0];
        const roomTotal = room.price * nights;
        return {
          total: roomTotal,
          details: {
            title: room.title,
            unitPrice: room.price,
            nights,
            petsPerRoom: 1,
            maxRoomCapacity: room.capacity,
            extraPetsCount: 0,
            extraPetRate: room.extraPetPrice,
            extraPetTotal: 0,
            roomTotal,
            roomsCount: 1,
            arrangement: 'single',
            summaryText: `Room Type: ${room.title} -- RM ${room.price} / night | Price: RM ${room.price} × ${nights} night(s) = RM ${roomTotal}`,
          },
        };
      }

      // Multiple Pets (numberOfPets > 1):
      // Mode A: 1 Pet Per Room (Separate Rooms)
      if (housingArrangement === 'separate') {
        const room = roomOptions.find((r) => r.id === boardingRoomType) || roomOptions[0];
        const totalPerNight = room.price * numberOfPets;
        const total = totalPerNight * nights;
        return {
          total,
          details: {
            title: `${room.title} (${numberOfPets} rooms, 1 pet/room)`,
            unitPrice: room.price,
            nights,
            petsPerRoom: 1,
            roomsCount: numberOfPets,
            extraPetsCount: 0,
            extraPetRate: 0,
            extraPetTotal: 0,
            roomTotal: total,
            arrangement: 'separate',
            summaryText: `${numberOfPets} × ${room.title} (1 ${selectedSpecies.toLowerCase()} per room) -- RM ${room.price} × ${numberOfPets} room(s) = RM ${totalPerNight} / night | Total: RM ${totalPerNight} × ${nights} night(s) = RM ${total}`,
          },
        };
      }

      // Mode B: Shared Room(s) / Multi-Room Allocation
      const activeAllocations = allocatedRoomsList.map((item, index) => {
        const room = roomOptions.find((r) => r.id === item.roomTypeId) || roomOptions[0];
        const extraPets = Math.max(0, item.petsCount - 1);
        const extraCharge = extraPets * room.extraPetPrice;
        const costPerNight = room.price + extraCharge;
        return {
          instanceId: item.id,
          roomId: room.id,
          title: room.title,
          basePrice: room.price,
          petsCount: item.petsCount,
          extraPets,
          extraPetRate: room.extraPetPrice,
          extraCharge,
          costPerNight,
          roomIndex: index + 1,
        };
      });

      // If empty allocations, compute fallback
      if (activeAllocations.length === 0) {
        const defaultRoom = roomOptions[0];
        const validPets = Math.min(numberOfPets, defaultRoom.capacity);
        const extraPets = Math.max(0, validPets - 1);
        const extraCharge = extraPets * defaultRoom.extraPetPrice;
        const costPerNight = defaultRoom.price + extraCharge;
        const total = costPerNight * nights;
        return {
          total,
          details: {
            title: defaultRoom.title,
            unitPrice: defaultRoom.price,
            nights,
            petsPerRoom: validPets,
            roomsCount: 1,
            extraPetsCount: extraPets,
            extraPetRate: defaultRoom.extraPetPrice,
            extraPetTotal: extraCharge * nights,
            roomTotal: defaultRoom.price * nights,
            arrangement: 'shared',
            summaryText: `1 × ${defaultRoom.title} (${validPets} pets) -- RM ${costPerNight} / night × ${nights} night(s) = RM ${total}`,
          },
        };
      }

      const totalPerNight = activeAllocations.reduce((sum, r) => sum + r.costPerNight, 0);
      const total = totalPerNight * nights;
      const totalExtraCharge = activeAllocations.reduce((sum, r) => sum + r.extraCharge, 0);
      const totalBasePrice = activeAllocations.reduce((sum, r) => sum + r.basePrice, 0);
      const totalExtraPetsCount = activeAllocations.reduce((sum, r) => sum + r.extraPets, 0);

      return {
        total,
        details: {
          title: activeAllocations.map((r) => `${r.title} (${r.petsCount} pets)`).join(' + '),
          unitPrice: totalBasePrice,
          nights,
          roomsCount: activeAllocations.length,
          allocatedRooms: activeAllocations,
          extraPetsCount: totalExtraPetsCount,
          extraPetRate: 0,
          extraPetTotal: totalExtraCharge * nights,
          roomTotal: totalBasePrice * nights,
          arrangement: 'shared',
          summaryText: activeAllocations
            .map(
              (r) =>
                `${r.title} (${r.petsCount} ${selectedSpecies.toLowerCase()}${r.petsCount > 1 ? 's' : ''}): RM ${r.basePrice}${
                  r.extraPets > 0 ? ` + Extra ${r.extraPets} × RM ${r.extraPetRate} = RM ${r.costPerNight}` : ''
                } / night`
            )
            .join(' | ') + ` | Total: RM ${totalPerNight} × ${nights} night(s) = RM ${total}`,
        },
      };
    }

    // 2. GROOMING PRICING ENGINE
    if (primaryService === 'Grooming') {
      const quotes = pets.map(p => quoteGroomingPet({...p,groomingType:dogGroomingCategory,coatType:dogCoatType,fullGroomingStyle:dogFullStyle,additionalServices:selectedAddons},groomingPricing,dogExtraWeightBracket));
      const total = Math.round(quotes.reduce((sum,q) => sum+q.total,0)*100)/100;
      return {total,details:{title:selectedSpecies==='Cat'?'Cat Basic Grooming':dogGroomingCategory,
        typeAndWeight:pets.map((p,i)=>`${p.petName||'Pet '+(i+1)} (${p.weightBracket}): RM ${quotes[i].base}`).join(' | '),
        extraWeightText:dogExtraWeightBracket,
        extraWeightCharge:quotes.reduce((sum,q)=>sum+q.extra,0),
        addonsCost:quotes.reduce((sum,q)=>sum+q.addons.reduce((cost,a)=>cost+a.price,0),0),addonsList:selectedAddons,totalGrooming:total}};
    }

    // 3. PET TAXI PRICING ENGINE
    if (primaryService === 'Pet Taxi') {
      const petWeight = pets[0]?.weightBracket || '< 5kg';
      const taxiConfig = systemConfig.petTaxiConfig || defaultPetTaxiConfig;
      let baseTaxiRate = 20;

      if (petWeight === '13 - 20 kg' || petWeight === '21 - 30 kg') {
        const mediumTier = taxiConfig.tiers.find(t => t.weightBracket === '10 - 30kg');
        baseTaxiRate = mediumTier ? mediumTier.basePrice : 30;
      } else if (petWeight === '> 30 kg') {
        const largeTier = taxiConfig.tiers.find(t => t.weightBracket === '> 30kg');
        baseTaxiRate = largeTier ? largeTier.basePrice : 40;
      } else {
        const smallTier = taxiConfig.tiers.find(t => t.weightBracket === '< 10kg');
        baseTaxiRate = smallTier ? smallTier.basePrice : 20;
      }

      const fuelRate = taxiConfig.fuelChargePerKm ?? 2;
      const fuelCharge = Math.max(0, taxiKm * fuelRate);
      const total = Math.round(pets.reduce((sum,p)=>{
        const label=p.weightBracket==='> 30 kg'?'> 30kg':['13 - 20 kg','21 - 30 kg'].includes(p.weightBracket)?'10 - 30kg':'< 10kg';
        return sum+(taxiConfig.tiers.find(t=>t.weightBracket===label)?.basePrice??0)+fuelCharge;
      },0)*100)/100;

      return {
        total,
        details: {
          title: 'Pet Taxi Service',
          baseTaxiRate,
          taxiKm,
          fuelCharge,
          total,
          summaryText: `${numberOfPets} pet(s), each priced by weight, plus ${taxiKm} km × RM ${fuelRate} per pet. Total RM ${total}`,
        },
      };
    }

    // 4. PET SITTING PRICING ENGINE (Biggest pet sets 1st Pet Base Rate, smaller/subsequent pets follow Extra Pet rates)
    if (primaryService === 'Pet Sitting') {
      const sittingConfig = systemConfig.petSittingConfig || defaultPetSittingConfig;

      const getWeightRank = (weightBracket: WeightBracket): number => {
        switch (weightBracket) {
          case '< 5kg': return 1;
          case '6 - 12 kg': return 2;
          case '13 - 20 kg': return 3;
          case '21 - 30 kg': return 4;
          case '> 30 kg': return 5;
          default: return 1;
        }
      };

      // 1. Sort registered pets descending by weight to find the biggest pet
      const sortedPets = [...pets].sort((a, b) => getWeightRank(b.weightBracket) - getWeightRank(a.weightBracket));
      const biggestPet = sortedPets[0] || { weightBracket: '< 5kg', petName: 'Pet #1' };

      // 2. Base Rate for the First Pet (Largest Pet)
      let firstPetBaseRate = sittingConfig.baseRates.small; // PS01: RM 35 (< 10kg)
      if (biggestPet.weightBracket === '13 - 20 kg' || biggestPet.weightBracket === '21 - 30 kg') {
        firstPetBaseRate = sittingConfig.baseRates.medium; // PS02: RM 45 (10 - 30kg)
      } else if (biggestPet.weightBracket === '> 30 kg') {
        firstPetBaseRate = sittingConfig.baseRates.largeXl; // PS03: RM 45 (> 30kg)
      }

      // 3. Extra Pets Pricing (Subsequent pets in same booking)
      const extraPetsList = sortedPets.slice(1).map((p) => {
        const isOver25 = p.weightBracket === '21 - 30 kg' || p.weightBracket === '> 30 kg';
        const extraPetFee = isOver25 ? sittingConfig.extraPetRates.over25kg : sittingConfig.extraPetRates.under25kg;
        return {
          petName: p.petName,
          weightBracket: p.weightBracket,
          extraPetFee,
          sizeCategory: (isOver25 ? '> 25kg' : '< 25kg') as '< 25kg' | '> 25kg',
        };
      });

      const totalExtraPetsCost = extraPetsList.reduce((sum, p) => sum + p.extraPetFee, 0);
      const totalPetsBaseCost = firstPetBaseRate + totalExtraPetsCost;

      // 4. Additional Services (Add-ons)
      const addonsList: PetSittingAddonItem[] = [];

      if (sittingWalkMinutes > 0) {
        const units = Math.ceil(sittingWalkMinutes / 10);
        const rate = sittingConfig.addons.walkPer10Min;
        const subtotal = units * rate;
        addonsList.push({
          code: 'PS-W',
          name: `Pet Sitting - Walk (${sittingWalkMinutes} mins)`,
          price: rate,
          quantity: units,
          unit: 'Every 10 min',
          subtotal,
        });
      }

      if (sittingMedsCount > 0) {
        const rate = sittingConfig.addons.medFeedPerTime;
        const subtotal = sittingMedsCount * rate;
        addonsList.push({
          code: 'PS-MF',
          name: 'Pet Sitting - Med Feed',
          price: rate,
          quantity: sittingMedsCount,
          unit: 'Per Time',
          subtotal,
        });
      }

      if (sittingFoodCount > 0) {
        const rate = sittingConfig.addons.freshFoodPerTime;
        const subtotal = sittingFoodCount * rate;
        addonsList.push({
          code: 'PS-FF',
          name: 'Pet Sitting - Fresh Food Cooking',
          price: rate,
          quantity: sittingFoodCount,
          unit: 'Per Time',
          subtotal,
        });
      }

      if (sittingCageCleanS > 0) {
        const rate = sittingConfig.addons.cageCleaningS;
        const subtotal = sittingCageCleanS * rate;
        addonsList.push({
          code: 'PS-C01',
          name: 'Pet Sitting - Cage Cleaning - S',
          price: rate,
          quantity: sittingCageCleanS,
          unit: 'Per Cage',
          subtotal,
        });
      }

      if (sittingCageCleanM > 0) {
        const rate = sittingConfig.addons.cageCleaningM;
        const subtotal = sittingCageCleanM * rate;
        addonsList.push({
          code: 'PS-C02',
          name: 'Pet Sitting - Cage Cleaning - M',
          price: rate,
          quantity: sittingCageCleanM,
          unit: 'Per Cage',
          subtotal,
        });
      }

      if (sittingCageCleanL > 0) {
        const rate = sittingConfig.addons.cageCleaningL;
        const subtotal = sittingCageCleanL * rate;
        addonsList.push({
          code: 'PS-C03',
          name: 'Pet Sitting - Cage Cleaning - L',
          price: rate,
          quantity: sittingCageCleanL,
          unit: 'Per Cage',
          subtotal,
        });
      }

      if (sittingCleanLivingRoom) {
        const rate = sittingConfig.addons.cleanLivingRoom;
        addonsList.push({
          code: 'PS-C04',
          name: 'Pet Sitting - Cleaning - Living Room',
          price: rate,
          quantity: 1,
          unit: 'Per Visit',
          subtotal: rate,
        });
      }

      if (sittingCleanBedrooms > 0) {
        const rate = sittingConfig.addons.cleanBedroom;
        const subtotal = sittingCleanBedrooms * rate;
        addonsList.push({
          code: 'PS-C05',
          name: 'Pet Sitting - Cleaning - Bedroom',
          price: rate,
          quantity: sittingCleanBedrooms,
          unit: 'Per Room',
          subtotal,
        });
      }

      if (sittingCleanKitchen) {
        const rate = sittingConfig.addons.cleanKitchen;
        addonsList.push({
          code: 'PS-C06',
          name: 'Pet Sitting - Cleaning - Kitchen',
          price: rate,
          quantity: 1,
          unit: 'Per Visit',
          subtotal: rate,
        });
      }

      if (sittingCleanCarpark) {
        const rate = sittingConfig.addons.cleanCarpark;
        addonsList.push({
          code: 'PS-C07',
          name: 'Pet Sitting - Cleaning - Carpark Area',
          price: rate,
          quantity: 1,
          unit: 'Per Visit',
          subtotal: rate,
        });
      }

      const totalAddonsCost = addonsList.reduce((sum, item) => sum + item.subtotal, 0);
      const peakSurcharge = sittingPeakPeriod ? sittingConfig.peakSurcharge : 0;
      const total = totalPetsBaseCost + totalAddonsCost + peakSurcharge;

      const summaryText = `1st Pet (${biggestPet.petName || 'Pet #1'} - ${biggestPet.weightBracket}): RM ${firstPetBaseRate}${
        extraPetsList.length > 0
          ? ` + Extra Pets (${extraPetsList.map((p) => `${p.petName || 'Pet'}: RM ${p.extraPetFee}`).join(', ')}): RM ${totalExtraPetsCost}`
          : ''
      }${
        totalAddonsCost > 0 ? ` + Add-ons: RM ${totalAddonsCost}` : ''
      }${
        peakSurcharge > 0 ? ` + Peak Period: RM ${peakSurcharge}` : ''
      } = Total RM ${total}`;

      const petSittingBreakdown: PetSittingBreakdown = {
        firstPetName: biggestPet.petName,
        firstPetWeightBracket: biggestPet.weightBracket,
        firstPetBaseRate,
        extraPetsCount: extraPetsList.length,
        extraPetsList,
        totalPetsBaseCost,
        selectedAddons: addonsList,
        totalAddonsCost,
        peakSurcharge,
        grandTotal: total,
        summaryText,
      };

      return {
        total,
        details: {
          title: 'Pet Sitting Service',
          firstPetBaseRate,
          totalPetsBaseCost,
          extraPetsList,
          addonsList,
          totalAddonsCost,
          peakSurcharge,
          total,
          summaryText,
          petSittingBreakdown,
        },
      };
    }

    // 5. DAY CARE PRICING ENGINE
    if (primaryService === 'Day Care') {
      const petWeight = pets[0]?.weightBracket || '< 5kg';
      const dcConfig = systemConfig.dayCareConfig || defaultDayCareConfig;
      const matchedTier = dcConfig.tiers.find(t => t.weightBracket === petWeight) || dcConfig.tiers[0];

      let rate = 25;
      if (dayCarePlan === 'Daily') {
        rate = matchedTier ? matchedTier.dailyRate : 25;
      } else {
        rate = matchedTier ? matchedTier.monthlyRate : 450;
      }

      const total = Math.round(pets.reduce((sum,p)=>{
        const tier=dcConfig.tiers.find(t=>t.weightBracket===p.weightBracket);
        return sum+(dayCarePlan==='Monthly'?tier?.monthlyRate??0:tier?.dailyRate??0);
      },0)*100)/100;
      return {
        total,
        details: {
          title: `Day Care (${dayCarePlan})`,
          rate,
          total,
          summaryText: `Day Care ${dayCarePlan}: ${numberOfPets} pet(s), each priced by weight. Total RM ${total}`,
        },
      };
    }

    return { total: 50, details: {} };
  };

  const calculatedService = calculateDetailedServicePrice();
  const estTotal = calculatedService.total;

  const estDeposit = quoteDeposit(estTotal,systemConfig.depositConfig);
  const estBalance = Math.max(0, estTotal - estDeposit);

  // Form Submission Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (receiptReading) { setFormError('Wait for the receipt to finish loading.'); return; }
    if (receiptError) { setFormError('Choose a valid receipt or clear the receipt selection before booking.'); return; }

    if (!ownerName.trim()) {
      setFormError('Please enter your full name.');
      return;
    }
    if (!whatsappNumber.trim()) {
      setFormError('Please enter your WhatsApp contact number.');
      return;
    }
    if (!checkInDate) {
      setFormError('Please select a service / check-in date.');
      return;
    }
    if (!checkInTime) {
      setFormError(
        primaryService === 'Boarding' || primaryService === 'Day Care'
          ? 'Please select your estimated drop-off / arrival time.'
          : 'Please select an appointment time slot.'
      );
      return;
    }
    if (primaryService === 'Boarding' && !checkOutDate) {
      setFormError('Please select a check-out date for boarding.');
      return;
    }

    const config = systemConfig.formFieldConfig;
    for (let i = 0; i < pets.length; i++) {
      const p = pets[i];
      if (config.petNameRequired && !p.petName?.trim()) {
        setFormError(`Pet #${i + 1}: Pet Name is required.`);
        return;
      }
      if (config.petBreedRequired && !p.breed?.trim()) {
        setFormError(`Pet #${i + 1}: Pet Breed is required.`);
        return;
      }
      if (config.vaxDateRequired && !p.vaxExpiryDate) {
        setFormError(`Pet #${i + 1}: Vaccination Expiry Date is required.`);
        return;
      }
      if (config.notesRequired && !p.allergiesNotes?.trim() && !p.characteristics?.trim()) {
        setFormError(`Pet #${i + 1}: Behavioral or allergy notes are required.`);
        return;
      }
    }

    // Validate multi-pet shared boarding allocation (Dogs and Cats only)
    if (primaryService === 'Boarding' && (selectedSpecies === 'Dog' || selectedSpecies === 'Cat') && numberOfPets > 1 && housingArrangement === 'shared') {
      const totalAllocated = allocatedRoomsList.reduce((a, b) => a + b.petsCount, 0);
      if (totalAllocated !== numberOfPets) {
        setFormError(`Please allocate all ${numberOfPets} pets to rooms (currently assigned: ${totalAllocated}).`);
        return;
      }
    }

    const fullPhone = `${countryCode} ${whatsappNumber.trim().replace(/^0+/, '')}`;

    // Map room preferences to pets for boarding
    const petsWithRoomPreference = pets.map((p, idx) => {
      let roomPref = boardingRoomType;
      if (primaryService === 'Boarding') {
        if (selectedSpecies !== 'Dog' && selectedSpecies !== 'Cat') {
          roomPref = 'Own Cage';
        } else if (housingArrangement === 'shared') {
          const alloc = (calculatedService.details as any).allocatedRooms;
          if (alloc && alloc.length > 0) {
            let petCounter = 0;
            for (const r of alloc) {
              if (idx < petCounter + r.petsCount) {
                roomPref = r.roomId;
                break;
              }
              petCounter += r.petsCount;
            }
          }
        }
      }
      return {
        ...p,
        preferredRoomType: primaryService === 'Boarding' ? roomPref : undefined,
        ...(primaryService==='Grooming'?{groomingType:dogGroomingCategory,coatType:dogCoatType,fullGroomingStyle:dogFullStyle,isSpecialBreed:/alaska|standard poodle/i.test(p.breed||'')&&p.weightBracket!=='> 30 kg',additionalServices:selectedAddons}:{}),
      };
    });

    try {
      const newBooking = await createCustomerBooking({
        customerName: ownerName,
        customerContact: fullPhone,
        countryCode,
        primaryService,
        checkInDate,
        checkInTime,
        checkOutDate: primaryService === 'Boarding' ? checkOutDate : undefined,
        numberOfPets,
        pets: petsWithRoomPreference,
        totalAmountOverride: estTotal,
        boardingBreakdown: primaryService === 'Boarding' && calculatedService.details ? {
          arrangement: primaryService === 'Boarding' ? (numberOfPets === 1 ? 'single' : housingArrangement) : undefined,
          roomType: (calculatedService.details as any).title || boardingRoomType,
          roomPricePerNight: (calculatedService.details as any).unitPrice || 65,
          nights: (calculatedService.details as any).nights || 1,
          petsPerRoom: (calculatedService.details as any).petsPerRoom || 1,
          extraPetsCount: (calculatedService.details as any).extraPetsCount || 0,
          extraPetPricePerNight: (calculatedService.details as any).extraPetRate || 0,
          totalRoomCost: (calculatedService.details as any).roomTotal || estTotal,
          totalExtraPetsCost: (calculatedService.details as any).extraPetTotal || 0,
          roomsCount: (calculatedService.details as any).roomsCount || 1,
          allocatedRooms: (calculatedService.details as any).allocatedRooms,
        } : undefined,
        groomingBreakdown: primaryService === 'Grooming' && calculatedService.details ? {
          groomingType: (calculatedService.details as any).title || dogGroomingCategory,
          coatOrStyle: dogCoatType,
          basePrice: estTotal,
          extraWeightRange: dogExtraWeightBracket,
          extraWeightCharge: (calculatedService.details as any).extraWeightCharge || 0,
          additionalServices: selectedAddons.map(name => ({
            name,
            price: DOG_ADDITIONAL_SERVICES.find(s => s.name === name)?.price || 15
          })),
          totalAdditionalCost: (calculatedService.details as any).addonsCost || 0,
        } : undefined,
        dayCareFrequency: primaryService === 'Day Care' ? dayCarePlan : undefined,
        petTaxiKm: primaryService === 'Pet Taxi' ? taxiKm : undefined,
        petSittingBreakdown: primaryService === 'Pet Sitting' && (calculatedService.details as any).petSittingBreakdown ? (calculatedService.details as any).petSittingBreakdown : undefined,
        depositReceiptUrl: receiptFile || undefined,
        notes: pets.map((p, idx) => `Pet #${idx+1} (${p.petName || 'Pet'}, ${p.species}): ${p.characteristics || ''} ${p.allergiesNotes || ''}`).join('; '),
      });

      setSubmittedBooking({
        reference: newBooking.bookingReference,
        totalAmount: newBooking.totalAmount,
        depositRequired: newBooking.depositRequired,
        balanceDue: newBooking.balanceDue,
        status: newBooking.status,
        paymentStatus: newBooking.paymentStatus,
        checkInTime: newBooking.checkInTime,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to create booking. Please contact the shop.');
    }
  };

  const getWhatsAppStoreLink = () => {
    if (!submittedBooking) return '#';
    const message = encodeURIComponent(
      `Hello ${systemConfig.shopName}! 🐾\n\nI have just submitted a booking on your system.\n\n` +
      `📋 Booking Ref: ${submittedBooking.reference}\n` +
      `👤 Owner: ${ownerName}\n` +
      `📞 Contact: ${countryCode} ${whatsappNumber}\n` +
      `🐾 Pet Species: ${selectedSpecies} (${numberOfPets} pet(s))\n` +
      `🐶 Service: ${primaryService}\n` +
      `📅 Check-in Date: ${checkInDate}\n` +
      `⏰ Scheduled Time / Arrival: ${submittedBooking.checkInTime || '-'}\n` +
      `${checkOutDate ? `🏁 Check-out Date: ${checkOutDate}\n` : ''}` +
      `💰 Total Estimate: RM ${submittedBooking.totalAmount}\n` +
      `💵 Deposit Status: ${submittedBooking.paymentStatus}\n\n` +
      `Please let me know how to confirm the booking or transfer the deposit. Thank you!`
    );
    return `https://wa.me/${cleanStorePhone}?text=${message}`;
  };

  if (submittedBooking) {
    return (
      <div className="max-w-2xl mx-auto my-8 p-6 sm:p-8 bg-white rounded-3xl border border-amber-200 shadow-xl text-center">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <span className="inline-block text-xs uppercase font-bold tracking-widest px-3 py-1 bg-amber-100 text-amber-900 rounded-full mb-2">
          Booking Submitted Successfully
        </span>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-1">
          Thank you, {ownerName}!
        </h2>
        <p className="text-sm text-slate-600 mb-6">
          Your booking request has been received by <span className="font-semibold">{systemConfig.shopName}</span>.
        </p>

        {/* Reference & Financial Breakdown Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left mb-6 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <span className="text-xs uppercase text-slate-500 font-bold tracking-wider">Booking Reference:</span>
            <span className="text-lg font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
              {submittedBooking.reference}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Service &amp; Species:</span>
            <span className="font-semibold text-slate-900">{primaryService} • {selectedSpecies}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Date &amp; Time:</span>
            <span className="font-semibold text-slate-900">{checkInDate} • {submittedBooking.checkInTime}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Total Calculated Amount:</span>
            <span className="font-semibold text-slate-900">RM {submittedBooking.totalAmount}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Deposit / Payment Status:</span>
            <span className="font-bold text-amber-800">{submittedBooking.paymentStatus}</span>
          </div>
        </div>

        {/* Next Step Notice */}
        <div className="bg-amber-50/80 border border-amber-200 text-amber-900 text-xs rounded-xl p-4 mb-6 text-left flex items-start gap-3">
          <MessageCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold mb-1">Next Step: WhatsApp Confirmation</p>
            <p>
              Please click the green button below to send your booking confirmation to our shop WhatsApp ({systemConfig.phone}) to reserve your slot and verify the booking!
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href={getWhatsAppStoreLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            <MessageCircle className="w-5 h-5" />
            Send Booking to Store WhatsApp
          </a>

          <button
            onClick={() => {
              setSubmittedBooking(null);
              setReceiptFile(null);
              setReceiptFileName('');
              setCheckInDate('');
              setCheckInTime('');
              setCheckOutDate('');
            }}
            className="px-5 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Submit Another Booking
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Shop Hero Card & Socials */}
      <div className="relative overflow-hidden bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-8">
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 text-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-4 h-4" /> Welcome to {systemConfig.shopName}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">
            Pet Boarding &amp; Grooming Booking
          </h1>
          <p className="text-amber-100/90 text-sm sm:text-base leading-relaxed mb-4">
            Directly submit your boarding, grooming, day care, sitting, or taxi appointment.
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-xs text-amber-200 font-medium mr-1">Connect with us on:</span>
            <a
              href={systemConfig.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold backdrop-blur-xs transition-colors"
            >
              <span>Instagram</span>
              <ExternalLink className="w-3 h-3 text-amber-300" />
            </a>
            <a
              href={systemConfig.xhsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold backdrop-blur-xs transition-colors"
            >
              <span>Xiaohongshu (小红书)</span>
              <ExternalLink className="w-3 h-3 text-amber-300" />
            </a>
          </div>
        </div>

        <PawPrint className="absolute -bottom-10 -right-10 w-64 h-64 text-white/5 pointer-events-none" />
      </div>

      {formError && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          <p className="text-sm font-bold">{formError}</p>
        </div>
      )}

      {/* Main Booking Form */}
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 0: Choose Pet Species (Dog / Cat / Rabbit / Hamster / Bird) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Before Step 1</span>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <PawPrint className="w-5 h-5 text-amber-600" />
                Select Your Pet Type
              </h2>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
              Required
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Choose which pet category you are booking for. Grooming services are available for Dogs &amp; Cats.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {(
              [
                { id: 'Dog', label: '🐶 Dog' },
                { id: 'Cat', label: '🐱 Cat' },
                { id: 'Rabbit', label: '🐰 Rabbit' },
                { id: 'Hamster', label: '🐹 Hamster' },
                { id: 'Bird', label: '🦜 Bird' },
              ] as Array<{ id: SpeciesType; label: string }>
            ).map((s) => (
              <button
                type="button"
                key={s.id}
                onClick={() => setSelectedSpecies(s.id)}
                className={`py-3.5 px-4 rounded-xl text-center font-bold text-sm border-2 transition-all cursor-pointer ${
                  selectedSpecies === s.id
                    ? 'border-amber-600 bg-amber-50 text-amber-900 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Step 1: Number of Pets */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Step 1</span>
              <h2 className="text-lg font-bold text-slate-900">
                How many {selectedSpecies.toLowerCase()}s are joining us?
              </h2>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
              Required
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((num) => (
              <button
                type="button"
                key={num}
                onClick={() => handlePetCountChange(num)}
                className={`py-3 px-4 rounded-xl text-center font-bold text-sm border-2 transition-all cursor-pointer ${
                  numberOfPets === num
                    ? 'border-amber-600 bg-amber-50 text-amber-900 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                }`}
              >
                {num} {num === 1 ? selectedSpecies : `${selectedSpecies}s`}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Pet Information (Room type selection is removed from here) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Step 2</span>
            <span className="text-xs text-slate-500">
              Pet weight is required; other pet details are optional
            </span>
          </div>

          {pets.map((pet, idx) => (
            <div key={idx} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs flex items-center justify-center font-bold">
                    #{idx + 1}
                  </span>
                  {selectedSpecies} Information
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {/* 1. Pet Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                    <span>Pet Name</span>
                    <span className="text-[10px] text-slate-400">
                      {systemConfig.formFieldConfig.petNameRequired ? 'Required' : 'Optional'}
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder="Pet name"
                    value={pet.petName || ''}
                    onChange={(e) => updatePetField(idx, 'petName', e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:border-amber-600 focus:outline-hidden bg-white font-medium text-slate-800"
                  />
                </div>

                {/* 2. Pet Breed */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                    <span>Breed</span>
                    <span className="text-[10px] text-slate-400">
                      {systemConfig.formFieldConfig.petBreedRequired ? 'Required' : 'Optional'}
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder={idx === 0 ? 'e.g. Poodle' : 'Breed'}
                    value={pet.breed || ''}
                    onChange={(e) => updatePetField(idx, 'breed', e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:border-amber-600 focus:outline-hidden bg-white font-medium text-slate-800"
                  />
                </div>

                {/* 3. Pet Weight Bracket */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                    <span>Weight Bracket *</span>
                    <span className="text-[10px] text-rose-600 font-semibold">Required</span>
                  </label>
                  <select
                    value={pet.weightBracket}
                    onChange={(e) => updatePetField(idx, 'weightBracket', e.target.value as WeightBracket)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:border-amber-600 focus:outline-hidden bg-white font-medium text-slate-800"
                  >
                    <option value="< 5kg">&lt; 5kg (Small / Toy)</option>
                    <option value="6 - 12 kg">6 - 12 kg (Medium-Small)</option>
                    <option value="13 - 20 kg">13 - 20 kg (Medium)</option>
                    <option value="21 - 30 kg">21 - 30 kg (Large)</option>
                    <option value="> 30 kg">&gt; 30 kg (Extra Large / Giant)</option>
                  </select>
                </div>

                {/* 4. Pet Birth Date (Strict DD/MM/YYYY) */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                    <span>Birth Date (DD/MM/YYYY)</span>
                    <span className="text-[10px] text-slate-400">Optional</span>
                  </label>
                  <DdMmYyyyDateInput
                    value={pet.birthDate || ''}
                    onChange={(val) => updatePetField(idx, 'birthDate', val)}
                    placeholder="DD/MM/YYYY"
                  />
                </div>

                {/* 5. Vaccine Expiry Date (Strict DD/MM/YYYY) */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                    <span>Vaccine Expiry Date (DD/MM/YYYY)</span>
                    <span className="text-[10px] text-slate-400">
                      {systemConfig.formFieldConfig.vaxDateRequired ? 'Required' : 'Optional'}
                    </span>
                  </label>
                  <DdMmYyyyDateInput
                    value={pet.vaxExpiryDate || ''}
                    onChange={(val) => updatePetField(idx, 'vaxExpiryDate', val)}
                    placeholder="DD/MM/YYYY"
                  />
                </div>

                {/* 6. Special Behavior, Allergies & Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                    <span>Behavior / Allergies / Notes</span>
                    <span className="text-[10px] text-slate-400">
                      {systemConfig.formFieldConfig.notesRequired ? 'Required' : 'Optional'}
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder={idx === 0 ? 'e.g. Timid, allergic to chicken' : 'Notes (optional)'}
                    value={pet.characteristics || ''}
                    onChange={(e) => updatePetField(idx, 'characteristics', e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:border-amber-600 focus:outline-hidden bg-white font-medium text-slate-800"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Step 3: Owner Contact Information */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Step 3</span>
              <h2 className="text-lg font-bold text-slate-900">Owner Contact Information</h2>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
              Required
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Owner Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="Enter your full name"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-amber-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                WhatsApp Phone Number *
              </label>
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-40 px-2.5 py-2.5 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50 focus:border-amber-600 focus:outline-hidden"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>

                <input
                  type="tel"
                  required
                  placeholder="e.g. 177329954"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  className="flex-1 px-3 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-amber-600 focus:outline-hidden font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Step 4: Service & Scheduled Time */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Step 4</span>
              <h2 className="text-lg font-bold text-slate-900">Service Selection &amp; Scheduled Time</h2>
            </div>
          </div>

          {/* WhatsApp Pre-booking Notice */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Important Notice:</strong> Please contact our shop on WhatsApp before booking to confirm slot availability.
              </span>
            </div>
            <a
              href={storeWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shrink-0 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp Us
            </a>
          </div>

          {/* Service Selection Buttons (Hide Grooming if not Dog or Cat) */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { id: 'Boarding', label: 'Boarding', icon: Home },
              ...(selectedSpecies === 'Dog' || selectedSpecies === 'Cat'
                ? [{ id: 'Grooming', label: 'Grooming', icon: Scissors }]
                : []),
              { id: 'Day Care', label: 'Day Care', icon: Clock },
              { id: 'Pet Sitting', label: 'Pet Sitting', icon: HeartHandshake },
              { id: 'Pet Taxi', label: 'Pet Taxi', icon: Car },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => {
                    setPrimaryService(s.id as ServiceType);
                    setCheckInTime('');
                  }}
                  className={`p-3 rounded-xl text-center border-2 transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                    primaryService === s.id
                      ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white font-medium'
                  }`}
                >
                  <Icon className="w-4 h-4 text-amber-600" />
                  <span className="text-xs">{s.label}</span>
                </button>
              );
            })}
          </div>

          {/* Dates & Drop-Off Time Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                {primaryService === 'Boarding' ? 'Check-In Date *' : 'Service Appointment Date *'}
              </label>
              <input
                type="date"
                required
                value={checkInDate}
                onChange={(e) => setCheckInDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-amber-600 focus:outline-hidden"
              />
            </div>

            {primaryService === 'Boarding' && (
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Check-Out Date * (For Boarding)
                </label>
                <input
                  type="date"
                  required
                  min={checkInDate || undefined}
                  value={checkOutDate}
                  onChange={(e) => setCheckOutDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-amber-600 focus:outline-hidden"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                <span>
                  {primaryService === 'Boarding' || primaryService === 'Day Care'
                    ? 'Drop-Off / Arrival Time *'
                    : 'Scheduled Time Slot *'}
                </span>
                <span className="text-[10px] text-rose-600 font-semibold">Required</span>
              </label>
              <select
                required
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 bg-white focus:border-amber-600 focus:outline-hidden font-semibold"
              >
                <option value="">
                  {primaryService === 'Boarding' || primaryService === 'Day Care'
                    ? '-- Select Arrival Time to Shop --'
                    : '-- Select Time Slot --'}
                </option>
                {availableTimeSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ================= SERVICE SUB-CONFIGURATIONS ================= */}

          {/* 1. BOARDING CONFIGURATION */}
          {primaryService === 'Boarding' && (
            <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-200 space-y-5 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Home className="w-4 h-4 text-amber-700" />
                  Boarding Room Selection &amp; Capacity
                </h3>
                <span className="text-[11px] font-semibold text-amber-900 bg-amber-100/80 px-2.5 py-1 rounded-full w-fit">
                  {selectedSpecies} Boarding • {numberOfPets} Pet{numberOfPets > 1 ? 's' : ''} • {(calculatedService.details as any).nights || 1} Night(s)
                </span>
              </div>

              {/* SMALL PETS (Rabbits, Hamsters, Birds): Owner Brings Own Cage, Per Night Fee */}
              {selectedSpecies !== 'Dog' && selectedSpecies !== 'Cat' ? (
                <div className="bg-white p-5 rounded-xl border border-amber-200 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-2xl shrink-0">
                      {selectedSpecies === 'Rabbit' ? '🐰' : selectedSpecies === 'Hamster' ? '🐹' : '🦜'}
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-slate-900 text-sm">
                        {selectedSpecies} Boarding — Owner Brings Own Cage / Habitat
                      </h4>
                      <p className="text-slate-600 text-xs leading-relaxed">
                        For {selectedSpecies.toLowerCase()}s, pet owners must bring their own cage / habitat, regular food, and water dispenser for your pet's comfort and health. No room choice is needed. Mellow Pet Loft provides daily scheduled feeding, fresh drinking water, hygienic care, and 24/7 air-conditioned supervision.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-amber-50/70 rounded-xl border border-amber-200 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Boarding Package:</span>
                      <strong className="text-slate-900 font-bold">Standard Own-Cage Boarding</strong>
                      <span className="text-slate-500 block text-[11px] mt-0.5">Fixed per-night lodging</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Fee Per Night:</span>
                      <strong className="text-amber-800 font-black text-sm">
                        RM {(calculatedService.details as any).unitPrice || 10} <span className="text-xs font-normal text-slate-500">/ pet / night</span>
                      </strong>
                      <span className="text-slate-500 block text-[11px] mt-0.5">
                        {numberOfPets > 1 ? `${numberOfPets} pets = RM ${((calculatedService.details as any).unitPrice || 10) * numberOfPets} / night` : 'Single pet rate'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Length of Stay:</span>
                      <strong className="text-slate-900 font-bold">
                        {(calculatedService.details as any).nights || 1} Night(s)
                      </strong>
                      <span className="text-slate-500 block text-[11px] mt-0.5">
                        Check-in to Check-out
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Multiple Pets Housing Arrangement Toggle */}
                  {numberOfPets > 1 && (
                <div className="bg-white p-4 rounded-xl border border-amber-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-slate-900 text-xs">
                      Housing Arrangement for {numberOfPets} {selectedSpecies}s:
                    </label>
                    <span className="text-[10px] font-medium text-slate-500">
                      Choose separate rooms or shared accommodation
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setHousingArrangement('separate')}
                      className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                        housingArrangement === 'separate'
                          ? 'border-amber-600 bg-amber-50/60 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>🛏️</span> 1 {selectedSpecies} Per Room / Enclosure (Separate)
                        </div>
                        <div className="text-[11px] text-slate-600 mt-1">
                          Each pet stays in their own private room/enclosure. Total of {numberOfPets} rooms allocated.
                        </div>
                      </div>
                      <div className="mt-2 text-[10px] font-semibold text-amber-800">
                        Price multiplies by number of rooms/enclosures (e.g. Base × {numberOfPets})
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setHousingArrangement('shared');
                        ensureDefaultSharedAllocations();
                      }}
                      className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                        housingArrangement === 'shared'
                          ? 'border-amber-600 bg-amber-50/60 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>🐾</span> Share Room(s) / Multi-Room Allocation
                        </div>
                        <div className="text-[11px] text-slate-600 mt-1">
                          Pets share enclosure(s) or allocate across different room types.
                        </div>
                      </div>
                      <div className="mt-2 text-[10px] font-semibold text-amber-800">
                        Base room rate + extra pet fee from 2nd pet
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* MODE 1: Single Pet OR 1 Pet Per Room Mode */}
              {(numberOfPets === 1 || housingArrangement === 'separate') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 text-xs">
                      {numberOfPets === 1
                        ? `Select Room Type for your ${selectedSpecies}:`
                        : `Select Room Type for each ${selectedSpecies} (1 pet per room × ${numberOfPets} rooms):`}
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {activeRoomOptionsForSpecies.map((room) => {
                      const isSelected = boardingRoomType === room.id;
                      const roomPerNightCost = room.price * numberOfPets;
                      return (
                        <button
                          type="button"
                          key={room.id}
                          onClick={() => setBoardingRoomType(room.id)}
                          className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between relative ${
                            isSelected
                              ? 'border-amber-600 bg-white ring-2 ring-amber-600/20 shadow-xs'
                              : 'border-slate-200 hover:border-slate-300 bg-white/80'
                          }`}
                        >
                          {isSelected && (
                            <span className="absolute top-2.5 right-2.5 bg-amber-600 text-white rounded-full p-0.5">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                          <div>
                            <div className="font-bold text-slate-900 pr-5">{room.title}</div>
                            <div className="text-[11px] text-slate-500 mt-1.5 leading-snug">{room.desc}</div>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-slate-100">
                            <div className="font-black text-amber-700 text-sm">
                              RM {room.price} <span className="text-[10px] font-normal text-slate-500">/ night per room</span>
                            </div>
                            {numberOfPets > 1 && (
                              <div className="text-[11px] font-bold text-amber-900 mt-1 bg-amber-50 px-2 py-0.5 rounded-md inline-block">
                                Total: {room.price} × {numberOfPets} = RM {roomPerNightCost} / night
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* MODE 2: Shared Room(s) / Multi-Room Allocation Mode */}
              {numberOfPets > 1 && housingArrangement === 'shared' && (
                <div className="space-y-4">
                  {/* Allocation Status Header */}
                  {(() => {
                    const totalAllocated = allocatedRoomsList.reduce((a, b) => a + b.petsCount, 0);
                    const remaining = numberOfPets - totalAllocated;
                    const isComplete = totalAllocated === numberOfPets;
                    const isOver = totalAllocated > numberOfPets;

                    return (
                      <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                        isComplete
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                          : isOver
                          ? 'bg-rose-50 border-rose-300 text-rose-900'
                          : 'bg-amber-100/70 border-amber-300 text-amber-900'
                      }`}>
                        <div className="flex items-center gap-2">
                          <span className="text-base">{isComplete ? '✅' : isOver ? '⚠️' : '🐾'}</span>
                          <div>
                            <span className="font-bold">
                              {isComplete
                                ? `All ${numberOfPets} ${selectedSpecies}s Successfully Allocated!`
                                : isOver
                                ? `Over-allocated by ${Math.abs(remaining)} ${selectedSpecies}(s)!`
                                : `Assign ${remaining} more ${selectedSpecies}${remaining > 1 ? 's' : ''} to room(s)`}
                            </span>
                            <div className="text-[11px] opacity-80">
                              Click room box(es) below. You can select multiple rooms and add multiple rooms of the same type (e.g. 2 Studios).
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
                            isComplete
                              ? 'bg-emerald-600 text-white'
                              : isOver
                              ? 'bg-rose-600 text-white'
                              : 'bg-amber-600 text-white'
                          }`}>
                            {totalAllocated} / {numberOfPets} {selectedSpecies}s Housed
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Room Cards Multi-Select Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {activeRoomOptionsForSpecies.map((room) => {
                      const instances = allocatedRoomsList.filter((item) => item.roomTypeId === room.id);
                      const isSelected = instances.length > 0;
                      const totalPetsInType = instances.reduce((sum, item) => sum + item.petsCount, 0);

                      return (
                        <div
                          key={room.id}
                          className={`p-3.5 rounded-xl border-2 transition-all flex flex-col justify-between relative ${
                            isSelected
                              ? 'border-amber-600 bg-white ring-2 ring-amber-600/20 shadow-xs'
                              : 'border-slate-200 hover:border-slate-300 bg-white/70'
                          }`}
                        >
                          <div>
                            {/* Card Header with Toggle Checkbox / Button */}
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <div>
                                <button
                                  type="button"
                                  onClick={() => handleToggleRoomType(room.id)}
                                  className="text-left font-bold text-slate-900 hover:text-amber-700 transition-colors cursor-pointer"
                                >
                                  {room.title}
                                </button>
                                {isSelected && (
                                  <div className="text-[10px] font-bold text-amber-800 mt-0.5">
                                    {instances.length} Room{instances.length > 1 ? 's' : ''} • {totalPetsInType} {selectedSpecies.toLowerCase()}{totalPetsInType > 1 ? 's' : ''}
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleToggleRoomType(room.id)}
                                className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-amber-600 border-amber-600 text-white'
                                    : 'border-slate-300 bg-slate-50 hover:border-slate-400'
                                }`}
                                title={isSelected ? 'Remove all rooms of this type' : 'Add this room type'}
                              >
                                {isSelected && <Check className="w-3.5 h-3.5" />}
                              </button>
                            </div>

                            {/* Room Description (Configured by Boss in Boss Settings) */}
                            <p className="text-[11px] text-slate-500 leading-snug mb-2">
                              {room.desc}
                            </p>

                            {/* Base Price */}
                            <div className="text-[11px] text-slate-600 font-medium">
                              Base: <strong className="text-slate-900">RM {room.price}</strong> / night per room
                            </div>
                          </div>

                          {/* Room Instances Configurator when Selected */}
                          {isSelected ? (
                            <div className="mt-3 pt-2.5 border-t border-amber-100 bg-amber-50/60 -mx-3.5 -mb-3.5 p-3 rounded-b-[10px] space-y-2.5">
                              {instances.map((instance, idx) => {
                                const extraPets = Math.max(0, instance.petsCount - 1);
                                const extraCharge = extraPets * room.extraPetPrice;
                                const instancePerNight = room.price + extraCharge;

                                return (
                                  <div
                                    key={instance.id}
                                    className="p-2.5 rounded-lg bg-white border border-amber-200/80 space-y-1.5"
                                  >
                                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-800">
                                      <span>
                                        {instances.length > 1 ? `Room #${idx + 1}:` : `${room.title}:`}
                                      </span>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-amber-800 font-black">
                                          {instance.petsCount} {selectedSpecies.toLowerCase()}{instance.petsCount > 1 ? 's' : ''}
                                        </span>
                                        {instances.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveRoomInstance(instance.id)}
                                            className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer rounded"
                                            title="Remove this room"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {/* Number of Pets in this Room Instance */}
                                    {room.capacity > 1 ? (
                                      <div className="flex gap-1">
                                        {Array.from({ length: room.capacity }).map((_, cIdx) => {
                                          const c = cIdx + 1;
                                          return (
                                            <button
                                              type="button"
                                              key={c}
                                              onClick={() => handleUpdateInstancePets(instance.id, c)}
                                              className={`flex-1 py-1 rounded-md font-black text-xs border transition-all cursor-pointer ${
                                                instance.petsCount === c
                                                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                                  : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                                              }`}
                                            >
                                              {c}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <div className="text-[10px] text-slate-500 font-medium">
                                        Fit 1 {selectedSpecies.toLowerCase()} per room only
                                      </div>
                                    )}

                                    {/* Price Subtotal for this Room Instance */}
                                    <div className="text-[11px] text-slate-700 pt-0.5">
                                      {extraPets > 0 ? (
                                        <div className="leading-tight">
                                          <span className="text-slate-500">RM {room.price} + Extra ({extraPets} × RM {room.extraPetPrice}) =</span>
                                          <span className="font-black text-amber-700 ml-1">RM {instancePerNight} / night</span>
                                        </div>
                                      ) : (
                                        <div className="font-black text-amber-700">
                                          RM {instancePerNight} / night
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Button to Add Another Room of this Type */}
                              <button
                                type="button"
                                onClick={() => handleAddRoomInstance(room.id)}
                                className="w-full py-1.5 px-2 rounded-lg text-[11px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors cursor-pointer text-center flex items-center justify-center gap-1 shadow-xs"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                + Add Another {room.title}
                              </button>
                            </div>
                          ) : (
                            <div className="mt-3 pt-2 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => handleAddRoomInstance(room.id)}
                                className="w-full py-1.5 px-2 rounded-lg text-[11px] font-semibold text-amber-800 bg-amber-50/80 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer text-center"
                              >
                                + Add {room.title}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
                </>
              )}

              {/* Conclusion / Result price breakdown */}
              <div className="bg-white p-4 rounded-xl border border-amber-300 space-y-3">
                <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center justify-between">
                  <span>Boarding Price Calculation Details:</span>
                  <span className="text-amber-800 lowercase normal-case text-xs">
                    {(calculatedService.details as any).nights || 1} night(s)
                  </span>
                </div>

                {/* Small Pets Breakdown (Rabbit, Hamster, Bird) */}
                {selectedSpecies !== 'Dog' && selectedSpecies !== 'Cat' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Boarding Package:</span>
                      <strong className="text-slate-900">Owner Brings Own Cage</strong>
                      <span className="text-slate-500 block text-[11px] mt-0.5">
                        {selectedSpecies} Daily Care &amp; Lodging
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[11px]">Price Per Night:</span>
                      <strong className="text-slate-900">
                        {numberOfPets > 1 ? (
                          <>
                            RM {(calculatedService.details as any).unitPrice || 10} × {numberOfPets} ={' '}
                            <span className="text-amber-800 font-black">
                              RM {((calculatedService.details as any).unitPrice || 10) * numberOfPets} / night
                            </span>
                          </>
                        ) : (
                          <span className="text-amber-800 font-black">
                            RM {(calculatedService.details as any).unitPrice || 10} / night
                          </span>
                        )}
                      </strong>
                      <span className="text-slate-500 block text-[11px] mt-0.5">
                        {numberOfPets} {selectedSpecies.toLowerCase()}{numberOfPets > 1 ? 's' : ''} staying
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[11px]">Total Boarding Charge:</span>
                      <strong className="text-amber-900 text-sm font-black">
                        RM {calculatedService.total}
                      </strong>
                      <span className="text-slate-500 block text-[11px] mt-0.5">
                        for {(calculatedService.details as any).nights || 1} night(s)
                      </span>
                    </div>
                  </div>
                )}

                {/* Single Pet OR 1 Pet Per Room Breakdown (Dogs & Cats) */}
                {(selectedSpecies === 'Dog' || selectedSpecies === 'Cat') && (numberOfPets === 1 || housingArrangement === 'separate') && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Room Type:</span>
                      <strong className="text-slate-900">
                        {numberOfPets === 1
                          ? (calculatedService.details as any).title || boardingRoomType
                          : `${boardingRoomType} (${numberOfPets} rooms, 1 ${selectedSpecies.toLowerCase()}/room)`}
                      </strong>
                      <span className="text-slate-500 block text-[11px] mt-0.5">
                        RM {(calculatedService.details as any).unitPrice || 0} / night per room
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[11px]">Price Per Night:</span>
                      <strong className="text-slate-900">
                        {numberOfPets > 1 ? (
                          <>
                            {(calculatedService.details as any).unitPrice || 0} × {numberOfPets} ={' '}
                            <span className="text-amber-800 font-black">
                              RM {((calculatedService.details as any).unitPrice || 0) * numberOfPets} / night
                            </span>
                          </>
                        ) : (
                          <span className="text-amber-800 font-black">
                            RM {(calculatedService.details as any).unitPrice || 0} / night
                          </span>
                        )}
                      </strong>
                      <span className="text-slate-500 block text-[11px] mt-0.5">
                        {numberOfPets > 1 ? `1 ${selectedSpecies.toLowerCase()} in each room` : 'Single pet occupancy'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[11px]">Total Boarding Charge:</span>
                      <strong className="text-amber-900 text-sm font-black">
                        RM {calculatedService.total}
                      </strong>
                      <span className="text-slate-500 block text-[11px] mt-0.5">
                        for {(calculatedService.details as any).nights || 1} night(s)
                      </span>
                    </div>
                  </div>
                )}

                {/* Shared / Multi-Room Breakdown (Dogs & Cats) */}
                {(selectedSpecies === 'Dog' || selectedSpecies === 'Cat') && numberOfPets > 1 && housingArrangement === 'shared' && (
                  <div className="space-y-2">
                    <div className="space-y-1.5">
                      {((calculatedService.details as any).allocatedRooms || []).map((r: any, idx: number) => (
                        <div
                          key={r.instanceId || idx}
                          className="flex flex-col sm:flex-row sm:items-center justify-between text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200 gap-1"
                        >
                          <div>
                            <strong className="text-slate-900">{r.title}</strong>{' '}
                            <span className="text-slate-600">
                              (Room #{idx + 1}, {r.petsCount} {selectedSpecies.toLowerCase()}{r.petsCount > 1 ? 's' : ''})
                            </span>
                          </div>
                          <div className="text-slate-700">
                            <span>Base: RM {r.basePrice}</span>
                            {r.extraPets > 0 && (
                              <span className="text-amber-700 font-semibold">
                                {' '}+ Extra ({r.extraPets} × RM {r.extraPetRate} = RM {r.extraCharge})
                              </span>
                            )}
                            <strong className="text-amber-900 ml-2">
                              = RM {r.costPerNight} / night
                            </strong>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-amber-50/80 p-3 rounded-xl border border-amber-200 text-xs font-bold text-slate-900 gap-1">
                      <div>
                        Total per night:{' '}
                        <span className="text-amber-800">
                          RM {((calculatedService.details as any).allocatedRooms || []).reduce((sum: number, r: any) => sum + r.costPerNight, 0)} / night
                        </span>
                      </div>
                      <div className="text-sm font-black text-amber-900">
                        Total for {(calculatedService.details as any).nights || 1} night(s): RM {calculatedService.total}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. GROOMING CONFIGURATION */}
          {primaryService === 'Grooming' && selectedSpecies === 'Dog' && (
            <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-200 space-y-5 text-xs">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Scissors className="w-4 h-4 text-amber-700" />
                Dog Grooming Package &amp; Coat Configuration
              </h3>

              {/* Grooming Package Choice */}
              <div>
                <label className="block font-bold text-slate-800 mb-2">Grooming Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'Basic Grooming', label: 'Basic Grooming' },
                    { id: 'Shaved Down', label: 'Shaved Down' },
                    { id: 'Full Grooming', label: 'Full Grooming' },
                  ].map((cat) => (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => setDogGroomingCategory(cat.id as any)}
                      className={`py-2.5 px-3 rounded-xl font-bold text-xs border text-center transition-all cursor-pointer ${
                        dogGroomingCategory === cat.id
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Coat Type (For Basic Grooming) */}
              {dogGroomingCategory === 'Basic Grooming' && (
                <div>
                  <label className="block font-bold text-slate-800 mb-2">Coat Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Short Coat', 'Long Coat', 'Double Coat'].map((coat) => (
                      <button
                        type="button"
                        key={coat}
                        onClick={() => setDogCoatType(coat as any)}
                        className={`py-2.5 px-3 rounded-xl font-bold text-xs border text-center transition-all cursor-pointer ${
                          dogCoatType === coat
                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        {coat}
                      </button>
                    ))}
                  </div>

                  {/* Special Breeds notice */}
                  {dogCoatType === 'Double Coat' && (
                    <div className="mt-2 text-[11px] text-amber-800 bg-amber-100/60 p-2.5 rounded-lg border border-amber-200">
                      💡 <strong>Special Double Coat Breeds (&lt;30kg):</strong> Alaska is RM {groomingPricing.alaska}; Standard Poodle is RM {groomingPricing.poodle}. (Auto-applied if entered in breed).
                    </div>
                  )}
                </div>
              )}

              {/* Full Grooming Style */}
              {dogGroomingCategory === 'Full Grooming' && (
                <div>
                  <label className="block font-bold text-slate-800 mb-2">Full Grooming Style</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'Summer Cut', label: 'Summer Cut (Body shave, keep head/tail)' },
                      { id: 'Pants Cut', label: 'Pants Cut (Keep 4 legs, head/tail)' },
                      { id: 'Hand Cut', label: 'Hand Cut (Full scissors cut)' },
                    ].map((style) => (
                      <button
                        type="button"
                        key={style.id}
                        onClick={() => setDogFullStyle(style.id as any)}
                        className={`p-2.5 rounded-xl font-bold text-xs border text-center transition-all cursor-pointer ${
                          dogFullStyle === style.id
                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        {style.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Extra Weight Charge (>30.1 kg) */}
              {pets[0]?.weightBracket === '> 30 kg' && (
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <label className="block font-bold text-slate-800">
                    Extra Weight Charge (Dogs above 30.1 kg)
                  </label>
                  <select
                    value={dogExtraWeightBracket}
                    onChange={(e) => setDogExtraWeightBracket(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold bg-white text-xs"
                  >
                    <option value="NA">NA (30.0 kg or below)</option>
                    <option value="30.1 - 34 kg">30.1 - 34 kg (+ RM 15)</option>
                    <option value="34.1 - 39 kg">34.1 - 39 kg (+ RM 25)</option>
                    <option value="39.1 - 40 kg">39.1 - 40 kg (+ RM 35)</option>
                    <option value="40.1 - 43 kg">40.1 - 43 kg (+ RM 45)</option>
                    <option value="43.1 - 46 kg">43.1 - 46 kg (+ RM 48)</option>
                  </select>
                </div>
              )}

              {/* Additional Services (Start From) */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <span>Additional Services (Optional • Prices start from)</span>
                  <span className="text-[11px] text-slate-400">Multiple selectable</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {DOG_ADDITIONAL_SERVICES.map((addon) => {
                    const isSelected = selectedAddons.includes(addon.name);
                    return (
                      <button
                        type="button"
                        key={addon.name}
                        onClick={() => {
                          setSelectedAddons((prev) =>
                            isSelected ? prev.filter((s) => s !== addon.name) : [...prev, addon.name]
                          );
                        }}
                        className={`p-2 rounded-lg text-left text-xs border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-amber-100/70 border-amber-600 text-amber-900 font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <span className="truncate mr-2">{addon.name}</span>
                        <span className="font-mono text-amber-800 shrink-0">RM {addon.price}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Grooming Conclusion / Result Display */}
              <div className="bg-white p-4 rounded-xl border border-amber-300 space-y-2">
                <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Grooming Price Details Summary:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">Grooming Type:</span>{' '}
                    <strong className="text-slate-900">
                      {(calculatedService.details as any).typeAndWeight || '-'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Extra Weight Charge:</span>{' '}
                    <strong className="text-slate-900">
                      {(calculatedService.details as any).extraWeightText || 'NA'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Additional Services:</span>{' '}
                    <strong className="text-slate-900">
                      RM {(calculatedService.details as any).addonsCost || 0} ({selectedAddons.length} selected)
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. PET TAXI CONFIGURATION */}
          {primaryService === 'Pet Taxi' && (
            <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-200 space-y-4 text-xs">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Car className="w-4 h-4 text-amber-700" />
                Pet Taxi Booking &amp; Distance
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Estimated Distance (Kilometers)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={taxiKm}
                    onChange={(e) => setTaxiKm(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Fuel charge is RM 2.00 per kilometer per trip.
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-amber-200 flex flex-col justify-between">
                  <div>
                    <div className="font-bold text-slate-900">Taxi Fee Breakdown:</div>
                    <div className="mt-1 text-slate-600">
                      Base pick-up fee: RM {(calculatedService.details as any).baseTaxiRate || 20}
                    </div>
                    <div className="text-slate-600">
                      Fuel charge per pet ({taxiKm} km × RM {systemConfig.petTaxiConfig?.fuelChargePerKm ?? 2}): RM {(calculatedService.details as any).fuelCharge || 0}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-100 font-black text-amber-800 text-sm">
                    Total Taxi: RM {calculatedService.total}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. PET SITTING CONFIGURATION */}
          {primaryService === 'Pet Sitting' && (
            <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-200 space-y-5 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <HeartHandshake className="w-4 h-4 text-amber-700" />
                  Pet Sitting Care &amp; Service Customization
                </h3>
                <span className="text-[11px] font-semibold text-amber-900 bg-amber-100/80 px-2.5 py-1 rounded-full w-fit">
                  {numberOfPets} Pet{numberOfPets > 1 ? 's' : ''} in Session
                </span>
              </div>

              {/* Multi-Pet & Biggest Pet Calculation Breakdown Card */}
              <div className="bg-white p-4 rounded-xl border border-amber-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span>🐕</span> Pet Care Session Fee (Determined by Largest Pet)
                  </span>
                  <span className="text-[10px] text-amber-800 bg-amber-50 font-semibold px-2 py-0.5 rounded-full border border-amber-200">
                    Transparent Formula
                  </span>
                </div>

                <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/70 text-[11px] text-amber-950 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1.5 border-b border-amber-200/60">
                    <div>
                      <strong className="text-slate-900">1st Pet (Largest Pet):</strong>{' '}
                      <span>
                        {(calculatedService.details as any).petSittingBreakdown?.firstPetName || 'Pet #1'}{' '}
                        ({(calculatedService.details as any).petSittingBreakdown?.firstPetWeightBracket || '< 5kg'})
                      </span>
                    </div>
                    <div className="font-bold text-amber-900">
                      Base Rate: RM {(calculatedService.details as any).firstPetBaseRate || 35}
                    </div>
                  </div>

                  {numberOfPets > 1 && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                        Additional Pets in this session:
                      </div>
                      <div className="space-y-1">
                        {((calculatedService.details as any).extraPetsList || []).map((p: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between bg-white/80 px-2.5 py-1.5 rounded-lg border border-amber-100 text-[11px]"
                          >
                            <div>
                              <span>🐾 Extra Pet #{idx + 1}:</span>{' '}
                              <strong>{p.petName || `Pet #${idx + 2}`}</strong>{' '}
                              <span className="text-slate-500">({p.weightBracket} • {p.sizeCategory})</span>
                            </div>
                            <span className="font-bold text-amber-900">+RM {p.extraPetFee}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 font-bold text-xs text-slate-900">
                    <span>Total Pet Care Base:</span>
                    <span className="text-amber-900 font-black">
                      RM {(calculatedService.details as any).totalPetsBaseCost || (calculatedService.details as any).firstPetBaseRate || 35}
                    </span>
                  </div>
                </div>
              </div>

              {/* Additional Services (Add-ons) */}
              <div className="space-y-3">
                <div className="font-bold text-slate-900 text-xs flex items-center justify-between">
                  <span>Additional Care &amp; Home Services (Optional):</span>
                  <span className="text-[10px] text-slate-500">Add walking, feeding, cleaning</span>
                </div>

                {/* 1. Dog Walk Service (PS-W: RM 15 / 10 mins) */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>🐾</span> Dog Walking Service (PS-W)
                      </div>
                      <div className="text-[11px] text-slate-500">RM 15.00 every 10 minutes</div>
                    </div>
                    {sittingWalkMinutes > 0 && (
                      <span className="font-bold text-amber-800 text-xs bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        +RM {Math.ceil(sittingWalkMinutes / 10) * 15}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[0, 10, 20, 30, 40, 60].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setSittingWalkMinutes(mins)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          sittingWalkMinutes === mins
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {mins === 0 ? 'No Walking' : `${mins} mins (+RM ${Math.ceil(mins / 10) * 15})`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Feeding & Medication Counters (PS-MF, PS-FF) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-1">
                        <span>💊</span> Medication Feeding (PS-MF)
                      </div>
                      <div className="text-[11px] text-slate-500">RM 10.00 per time</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSittingMedsCount((c) => Math.max(0, c - 1))}
                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-bold text-xs w-5 text-center">{sittingMedsCount}</span>
                      <button
                        type="button"
                        onClick={() => setSittingMedsCount((c) => c + 1)}
                        className="w-7 h-7 rounded-lg bg-amber-100 hover:bg-amber-200 flex items-center justify-center font-bold text-amber-900 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-1">
                        <span>🍳</span> Fresh Food Cooking (PS-FF)
                      </div>
                      <div className="text-[11px] text-slate-500">RM 10.00 per time</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSittingFoodCount((c) => Math.max(0, c - 1))}
                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-bold text-xs w-5 text-center">{sittingFoodCount}</span>
                      <button
                        type="button"
                        onClick={() => setSittingFoodCount((c) => c + 1)}
                        className="w-7 h-7 rounded-lg bg-amber-100 hover:bg-amber-200 flex items-center justify-center font-bold text-amber-900 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. Habitat & Cage Cleaning (PS-C01, PS-C02, PS-C03) */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>🧹</span> Cage &amp; Habitat Cleaning Services (PS-C01 to PS-C03)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-800 text-[11px]">Small Cage (&lt;10kg)</div>
                        <div className="text-[10px] text-slate-500">RM 10 / cage</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSittingCageCleanS((c) => Math.max(0, c - 1))}
                          className="w-6 h-6 rounded bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700 cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-bold text-xs w-4 text-center">{sittingCageCleanS}</span>
                        <button
                          type="button"
                          onClick={() => setSittingCageCleanS((c) => c + 1)}
                          className="w-6 h-6 rounded bg-amber-100 border border-amber-300 flex items-center justify-center font-bold text-amber-900 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-800 text-[11px]">Medium Cage (10-30kg)</div>
                        <div className="text-[10px] text-slate-500">RM 20 / cage</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSittingCageCleanM((c) => Math.max(0, c - 1))}
                          className="w-6 h-6 rounded bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700 cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-bold text-xs w-4 text-center">{sittingCageCleanM}</span>
                        <button
                          type="button"
                          onClick={() => setSittingCageCleanM((c) => c + 1)}
                          className="w-6 h-6 rounded bg-amber-100 border border-amber-300 flex items-center justify-center font-bold text-amber-900 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-800 text-[11px]">Large Cage (&gt;30kg)</div>
                        <div className="text-[10px] text-slate-500">RM 30 / cage</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSittingCageCleanL((c) => Math.max(0, c - 1))}
                          className="w-6 h-6 rounded bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700 cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-bold text-xs w-4 text-center">{sittingCageCleanL}</span>
                        <button
                          type="button"
                          onClick={() => setSittingCageCleanL((c) => c + 1)}
                          className="w-6 h-6 rounded bg-amber-100 border border-amber-300 flex items-center justify-center font-bold text-amber-900 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Home Area Cleaning Services (PS-C04 to PS-C07) */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>🏡</span> Home Area Cleaning Services (PS-C04 to PS-C07)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setSittingCleanLivingRoom(!sittingCleanLivingRoom)}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                        sittingCleanLivingRoom
                          ? 'bg-amber-100/70 border-amber-600 text-amber-900 font-bold'
                          : 'bg-slate-50/50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="font-bold text-[11px]">🛋️ Living Room</div>
                      <div className="text-[10px] text-amber-800 font-mono mt-0.5">+ RM 25 / visit</div>
                    </button>

                    <div className="p-2 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-[11px] text-slate-800">🛏️ Bedrooms</div>
                        <div className="text-[10px] text-slate-500">RM 10 / room</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSittingCleanBedrooms((c) => Math.max(0, c - 1))}
                          className="w-6 h-6 rounded bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700 cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-bold text-xs w-4 text-center">{sittingCleanBedrooms}</span>
                        <button
                          type="button"
                          onClick={() => setSittingCleanBedrooms((c) => c + 1)}
                          className="w-6 h-6 rounded bg-amber-100 border border-amber-300 flex items-center justify-center font-bold text-amber-900 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSittingCleanKitchen(!sittingCleanKitchen)}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                        sittingCleanKitchen
                          ? 'bg-amber-100/70 border-amber-600 text-amber-900 font-bold'
                          : 'bg-slate-50/50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="font-bold text-[11px]">🍳 Kitchen</div>
                      <div className="text-[10px] text-amber-800 font-mono mt-0.5">+ RM 15 / visit</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSittingCleanCarpark(!sittingCleanCarpark)}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                        sittingCleanCarpark
                          ? 'bg-amber-100/70 border-amber-600 text-amber-900 font-bold'
                          : 'bg-slate-50/50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="font-bold text-[11px]">🚗 Carpark Area</div>
                      <div className="text-[10px] text-amber-800 font-mono mt-0.5">+ RM 20 / visit</div>
                    </button>
                  </div>
                </div>

                {/* 5. Peak Period Surcharge Toggle (S-PP: RM 30) */}
                <div
                  onClick={() => setSittingPeakPeriod(!sittingPeakPeriod)}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    sittingPeakPeriod
                      ? 'bg-rose-50 border-rose-300 text-rose-950 font-bold'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">📅</span>
                    <div>
                      <div className="font-bold text-xs">Peak Period / Public Holiday Surcharge (S-PP)</div>
                      <div className="text-[11px] text-slate-500">Festive season and holiday peak fee: RM {(systemConfig.petSittingConfig?.peakSurcharge ?? 30).toFixed(2)} per order</div>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    sittingPeakPeriod ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {sittingPeakPeriod ? 'Active (+RM 30)' : 'No Surcharge'}
                  </span>
                </div>
              </div>

              {/* Itemized Sitting Bill Breakdown */}
              <div className="bg-white p-4 rounded-xl border border-amber-300 space-y-2">
                <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center justify-between">
                  <span>Pet Sitting Itemized Bill Summary:</span>
                  <span className="text-amber-800 font-black text-xs">Total: RM {calculatedService.total}</span>
                </div>
                <div className="text-slate-600 text-xs leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  {(calculatedService.details as any).summaryText || `Total RM ${calculatedService.total}`}
                </div>
              </div>
            </div>
          )}

          {/* 5. DAY CARE CONFIGURATION */}
          {primaryService === 'Day Care' && (
            <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-200 space-y-4 text-xs">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-700" />
                Day Care Plan Selection
              </h3>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDayCarePlan('Daily')}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold border transition-all cursor-pointer ${
                    dayCarePlan === 'Daily'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  Daily Day Care Pass
                </button>
                <button
                  type="button"
                  onClick={() => setDayCarePlan('Monthly')}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold border transition-all cursor-pointer ${
                    dayCarePlan === 'Monthly'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  Monthly Package Plan
                </button>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-amber-200">
                <div className="font-bold text-slate-900">Day Care Bill:</div>
                <div className="text-slate-600 mt-1">
                  {(calculatedService.details as any).summaryText || `Total RM ${calculatedService.total}`}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Step 5: Price Estimation & Deposit Breakdown */}
        <div className="bg-white rounded-2xl border-2 border-amber-300 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Step 5</span>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-600" />
                Price Estimation &amp; Deposit Breakdown
              </h2>
            </div>
          </div>

          {/* Pricing Estimation Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-amber-50/60 rounded-xl border border-amber-200">
            <div>
              <div className="text-xs text-slate-600 font-semibold">Total Calculated Price:</div>
              <div className="text-2xl font-black text-slate-900">RM {estTotal}</div>
            </div>
            <div>
              <div className="text-xs text-amber-800 font-bold uppercase">Estimated Deposit Required:</div>
              <div className="text-2xl font-black text-amber-700">RM {estDeposit}</div>
            </div>
            <div>
              <div className="text-xs text-slate-600 font-semibold">Outstanding Balance at Pick-Up:</div>
              <div className="text-2xl font-bold text-slate-800">RM {estBalance}</div>
            </div>
          </div>

          {/* Online Payment Gate Logic */}
          {systemConfig.onlinePaymentEnabled ? (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2 mb-3">
                  <Building2 className="w-4 h-4 text-amber-700" />
                  Transfer Online Deposit to Store Account
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1.5 bg-white p-3.5 rounded-lg border border-slate-200">
                    <div className="text-slate-500">Bank Name:</div>
                    <div className="font-bold text-slate-900 text-sm">{systemConfig.bankName}</div>
                    <div className="text-slate-500 pt-1">Account Name:</div>
                    <div className="font-bold text-slate-900">{systemConfig.accountName}</div>
                    <div className="text-slate-500 pt-1">Account Number:</div>
                    <div className="font-mono font-bold text-amber-800 text-base">{systemConfig.accountNumber}</div>
                  </div>

                  <div className="bg-white p-3.5 rounded-lg border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-slate-900 mb-1">
                        <QrCode className="w-4 h-4 text-amber-700" />
                        DuitNow QR
                      </div>
                      <p className="text-slate-600 leading-relaxed text-[11px]">
                        Scan our DuitNow QR or perform an instant bank transfer. Remaining balance is settled in-store!
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Upload Bank Transfer Proof / Screenshot:
                </label>
                <div className="border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-xl p-6 text-center transition-colors bg-white">
                  <input
                    type="file"
                    id="receipt-upload"
                    accept="image/png,image/jpeg,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label htmlFor="receipt-upload" className="cursor-pointer flex flex-col items-center">
                    <Upload className="w-8 h-8 text-amber-600 mb-2" />
                    <span className="text-sm font-semibold text-slate-800">
                      {receiptFileName ? receiptFileName : 'Click to select transfer slip / screenshot'}
                    </span>
                    <span className="text-xs text-slate-400 mt-1">PNG, JPG or PDF • Maximum 1 MB</span>
                  </label>

                  {receiptError && <p role="alert" className="mt-3 text-sm font-semibold text-rose-700">{receiptError}</p>}
                  {receiptReading && <p className="mt-3 text-xs text-slate-500">Reading receipt…</p>}
                  {(receiptFile || receiptError) && <button type="button" onClick={() => { receiptReadVersion.current++; setReceiptFile(''); setReceiptFileName(''); setReceiptError(''); setReceiptReading(false); }} className="mt-3 text-xs underline">Clear receipt</button>}
                  {receiptFile && (
                    <div className="mt-4 inline-block">
                      <div className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 inline-flex items-center gap-1.5 mb-2">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Receipt Attached!
                      </div>
                      {receiptFile.startsWith('data:application/pdf') ? (
                        <a href={receiptFile} target="_blank" rel="noopener noreferrer" className="block text-xs font-bold text-amber-800 underline">Open PDF proof</a>
                      ) : (
                        <img src={receiptFile} alt="Receipt Preview" className="max-h-40 mx-auto rounded-lg border border-slate-200 shadow-xs" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-xs text-slate-700 space-y-2">
              <div className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                No Upfront Online Payment Required
              </div>
              <p>
                You do not need to make any payment right now. After clicking submit, you will receive your booking reference code, and you can contact our shop via WhatsApp to confirm the deposit and lock in your slot.
              </p>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="text-center pt-2">
          <button
            type="submit"
            className="w-full sm:w-auto px-10 py-4 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-black text-base rounded-2xl shadow-lg hover:shadow-xl transition-all cursor-pointer transform hover:-translate-y-0.5"
          >
            Confirm &amp; Submit Pet Booking 🐾
          </button>
          <p className="text-xs text-slate-500 mt-2">
            By submitting, you agree to {systemConfig.shopName}&apos;s boarding &amp; grooming house rules.
          </p>
        </div>
      </form>
    </div>
  );
};
