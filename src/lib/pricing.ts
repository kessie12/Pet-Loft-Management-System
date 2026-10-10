import type { BookingPet, CustomerBookingInput, GroomingPricing, ReceiptConfig, SystemConfig, BoardingBreakdown, GroomingBreakdown, PetSittingBreakdown } from '../types';
import { defaultDayCareConfig, defaultPetSittingConfig, defaultPetTaxiConfig } from '../data/seedData';
export const WEIGHTS = ['< 5kg','6 - 12 kg','13 - 20 kg','21 - 30 kg','> 30 kg'];
export const EXTRA_WEIGHTS = ['30.1 - 34 kg','34.1 - 39 kg','39.1 - 40 kg','40.1 - 43 kg','43.1 - 46 kg'];
export const defaultGroomingPricing: GroomingPricing = {
  shortCoat:[38,48,58,68,78],longCoat:[48,58,68,78,88],doubleCoat:[58,68,88,98,108],
  shavedDown:[88,98,108,118,128],summerCut:[108,118,128,138,148],pantsCut:[140,160,180,200,250],handCut:[190,210,240,270,300],
  alaska:150,poodle:120,catSmall:50,catLarge:78,extraWeight:[15,25,35,45,48],
  addons:[
    {name:'Nails Trimming & Filing',price:15},{name:'Ear Cleaning',price:15},{name:'Underpad Trimming',price:15},
    {name:'Sanitary Area / Under Tail / Tummy Trimming',price:15},{name:'Tick & Flea Solution (Small Breed)',price:10},
    {name:'Tick & Flea Solution (Medium & Large Breed)',price:20},{name:'Deshedding / Inner Coat Removal',price:30},
    {name:'Trim to Round Feet',price:15},{name:'Trim to Round Head',price:15},
    {name:'Conditional / Medical / Flea & Tick Shampoo',price:15},{name:'Unmatting',price:10},{name:'Hand Cut (Full Grooming)',price:20},
  ],
};
export const defaultReceiptConfig: ReceiptConfig = {
  layout:'standard',invoiceTitle:'OFFICIAL INVOICE',depositTitle:'BOOKING DEPOSIT RECEIPT',finalTitle:'PAYMENT RECEIPT',
  footer:'Thank you for choosing Mellow Pet Loft Concept Store!',showLogo:true,showBankDetails:true,showSignature:true,
  invoicePrefix:'INV',depositPrefix:'R01',finalPrefix:'R02',
};
const money = (n: number) => Math.round(n * 100) / 100;
const validAmount = (n: number) => { if (!Number.isFinite(n) || n < 0) throw new Error('Invalid configured price.'); return n; };
export const quoteGroomingPet = (pet: BookingPet, config: GroomingPricing, extraRange?: string) => {
  const i = WEIGHTS.indexOf(pet.weightBracket);
  if (i < 0 || !['Dog','Cat'].includes(pet.species)) throw new Error('Choose a valid grooming species and weight.');
  if (pet.species === 'Cat') return { base: i >= 2 ? config.catLarge : config.catSmall, extra:0, addons:[], total:i >= 2 ? config.catLarge : config.catSmall };
  const style = pet.fullGroomingStyle || 'Summer Cut';
  if (pet.groomingType && !['Basic Grooming','Full Grooming','Shaved Down'].includes(pet.groomingType)) throw new Error('Choose a valid grooming service.');
  if (!['Summer Cut','Pants Cut','Hand Cut'].includes(style)) throw new Error('Choose a valid grooming style.');
  const coat = pet.coatType || 'Short Coat';
  let base = config.shortCoat[i];
  if (/alaska|standard poodle/i.test(pet.breed || "") && i !== 4) {
    base = /alaska/i.test(pet.breed || '') ? config.alaska : config.poodle;
  } else if (pet.groomingType === 'Shaved Down') base = config.shavedDown[i];
  else if (pet.groomingType === 'Full Grooming') base = (style === 'Pants Cut' ? config.pantsCut : style === 'Hand Cut' ? config.handCut : config.summerCut)[i];
  else base = (coat === 'Double Coat' ? config.doubleCoat : coat === 'Long Coat' ? config.longCoat : config.shortCoat)[i];
  const index = EXTRA_WEIGHTS.indexOf(extraRange || '');
  if (extraRange && extraRange !== 'NA' && index < 0) throw new Error('Invalid extra-weight range.');
  const extra = i === 4 && index >= 0 ? config.extraWeight[index] : 0;
  const addons = [...new Set(pet.additionalServices || [])].map(name => {
    const item = config.addons.find(a => a.name === name);
    if (!item) throw new Error('A selected grooming add-on is no longer available.');
    return item;
  });
  return { base:validAmount(base),extra:validAmount(extra),addons,total:money(base+extra+addons.reduce((sum,a)=>sum+validAmount(a.price),0)) };
};
export const quoteBooking = (data: CustomerBookingInput, config: SystemConfig): {
  total: number; boardingBreakdown?: BoardingBreakdown; groomingBreakdown?: GroomingBreakdown; petSittingBreakdown?: PetSittingBreakdown;
} => {
  const pets = data.pets;
  if (!pets.length || pets.length > 30 || pets.length !== data.numberOfPets) throw new Error('Register each pet.');
  if (data.primaryService === 'Boarding') {
    const nights = (Date.parse(data.checkOutDate || '') - Date.parse(data.checkInDate)) / 86400000;
    if (!Number.isInteger(nights) || nights < 1 || nights > 365) throw new Error('Select a valid boarding stay up to 365 nights.');
    const managed = pets.filter(p => p.species === 'Dog' || p.species === 'Cat');
    const ownCage = pets.length - managed.length;
    const arrangement = data.boardingBreakdown?.arrangement || 'separate';
    let offset = 0;
    const groups = data.boardingBreakdown?.allocatedRooms?.length ? data.boardingBreakdown.allocatedRooms.map(a=>({roomId:a.roomId,petsCount:a.petsCount})) : arrangement === 'shared' && managed.length ? [{roomId:managed[0].preferredRoomType || '',petsCount:managed.length}] : managed.map(p=>({roomId:p.preferredRoomType || '',petsCount:1}));
    const allocatedRooms = groups.map(group=>{
      if (!Number.isInteger(group.petsCount) || group.petsCount < 1) throw new Error('Invalid room allocation.');
      const registered = managed.slice(offset,offset+group.petsCount); offset+=group.petsCount;
      const type = config.customerBoardingRooms?.find(t=>t.id===group.roomId && t.species===registered[0]?.species && t.active!==false);
      if (!type || group.petsCount > type.capacity || registered.length !== group.petsCount || registered.some(p=>p.species!==type.species)) throw new Error('Choose an enabled room type with enough capacity.');
      const extraPets = Math.max(0,group.petsCount-1); const extraCharge=extraPets*validAmount(type.extraPetPrice);
      return { roomId:type.id,title:type.title,basePrice:validAmount(type.price),petsCount:group.petsCount,extraPets,extraPetRate:type.extraPetPrice,extraCharge,costPerNight:money(type.price+extraCharge) };
    });
    if (offset!==managed.length) throw new Error('Allocate every dog and cat to a room.');
    const totalRoomCost=money(nights*(allocatedRooms.reduce((sum,a)=>sum+a.basePrice,0)+ownCage*validAmount(config.smallPetsBoardingFee??10)));
    const totalExtraPetsCost=money(nights*allocatedRooms.reduce((sum,a)=>sum+a.extraCharge,0));
    return {total:money(totalRoomCost+totalExtraPetsCost),boardingBreakdown:{arrangement,roomType:allocatedRooms.map(a=>a.title).join(' + ') || 'Own Cage',roomPricePerNight:allocatedRooms[0]?.basePrice || config.smallPetsBoardingFee || 10,nights,petsPerRoom:allocatedRooms[0]?.petsCount||1,extraPetsCount:allocatedRooms.reduce((sum,a)=>sum+a.extraPets,0),extraPetPricePerNight:allocatedRooms[0]?.extraPetRate||0,totalRoomCost,totalExtraPetsCost,roomsCount:allocatedRooms.length,allocatedRooms}};
  }
  if (data.primaryService === 'Grooming') {
    const quotes = pets.map(p=>quoteGroomingPet(p,config.groomingPricing || defaultGroomingPricing,data.groomingBreakdown?.extraWeightRange));
    const total = money(quotes.reduce((sum,q)=>sum+q.total,0)); const first=quotes[0];
    return {total,groomingBreakdown:{groomingType:pets[0].groomingType || 'Basic Grooming',coatOrStyle:pets[0].fullGroomingStyle || pets[0].coatType || '',basePrice:first.base,extraWeightRange:data.groomingBreakdown?.extraWeightRange,extraWeightCharge:first.extra,additionalServices:first.addons,totalAdditionalCost:first.addons.reduce((sum,a)=>sum+a.price,0)}};
  }
  if (data.primaryService==='Day Care') {
    const tiers=(config.dayCareConfig||defaultDayCareConfig).tiers;
    return {total:money(pets.reduce((sum,p)=>{const tier=tiers.find(t=>t.weightBracket===p.weightBracket);if(!tier)throw new Error('Day-care tier unavailable.');return sum+validAmount(data.dayCareFrequency==='Monthly'?tier.monthlyRate:tier.dailyRate);},0))};
  }
  if (data.primaryService==='Pet Taxi') {
    const taxi=config.petTaxiConfig||defaultPetTaxiConfig; const km=data.petTaxiKm || 0;
    if (!Number.isFinite(km)||km<0||km>1000) throw new Error('Enter a distance from 0 to 1,000 km.');
    return {total:money(pets.reduce((sum,p)=>{const i=WEIGHTS.indexOf(p.weightBracket);const label=i===4?'> 30kg':i>=2?'10 - 30kg':'< 10kg';const tier=taxi.tiers.find(t=>t.weightBracket===label);if(!tier)throw new Error('Taxi tier unavailable.');return sum+validAmount(tier.basePrice)+km*validAmount(taxi.fuelChargePerKm);},0))};
  }
  if (data.primaryService==='Pet Sitting') {
    const sitting=config.petSittingConfig||defaultPetSittingConfig;
    const sorted=[...pets].sort((a,b)=>WEIGHTS.indexOf(b.weightBracket)-WEIGHTS.indexOf(a.weightBracket));
    const first=sorted[0];const rank=WEIGHTS.indexOf(first.weightBracket); const base=rank===4?sitting.baseRates.largeXl:rank>=2?sitting.baseRates.medium:sitting.baseRates.small;
    const extraPetsList=sorted.slice(1).map(p=>({petName:p.petName,weightBracket:p.weightBracket,extraPetFee:WEIGHTS.indexOf(p.weightBracket)>=3?sitting.extraPetRates.over25kg:sitting.extraPetRates.under25kg,sizeCategory:(WEIGHTS.indexOf(p.weightBracket)>=3?'> 25kg':'< 25kg') as '> 25kg'|'< 25kg'}));
    const codes: Record<string, keyof typeof sitting.addons>={'PS-W':'walkPer10Min','PS-MF':'medFeedPerTime','PS-FF':'freshFoodPerTime','PS-C01':'cageCleaningS','PS-C02':'cageCleaningM','PS-C03':'cageCleaningL','PS-C04':'cleanLivingRoom','PS-C05':'cleanBedroom','PS-C06':'cleanKitchen','PS-C07':'cleanCarpark'};
    const selectedAddons=(data.petSittingBreakdown?.selectedAddons||[]).map(a=>{if(!codes[a.code]||!Number.isInteger(a.quantity)||a.quantity<1||a.quantity>100)throw new Error('Invalid pet-sitting add-on.');const price=validAmount(sitting.addons[codes[a.code]]);return {...a,price,subtotal:money(price*a.quantity)};});
    const totalPetsBaseCost=money(validAmount(base)+extraPetsList.reduce((sum,p)=>sum+validAmount(p.extraPetFee),0));const totalAddonsCost=money(selectedAddons.reduce((sum,a)=>sum+a.subtotal,0));const peakSurcharge=data.petSittingBreakdown?.peakSurcharge?validAmount(sitting.peakSurcharge):0;const grandTotal=money(totalPetsBaseCost+totalAddonsCost+peakSurcharge);
    return {total:grandTotal,petSittingBreakdown:{firstPetName:first.petName,firstPetWeightBracket:first.weightBracket,firstPetBaseRate:base,extraPetsCount:extraPetsList.length,extraPetsList,totalPetsBaseCost,selectedAddons,totalAddonsCost,peakSurcharge,grandTotal,summaryText:`Pet sitting: RM ${grandTotal.toFixed(2)}`}};
  }
  throw new Error('Select a supported service.');
};

export const quoteDeposit = (total:number, config:SystemConfig['depositConfig']) => money(Math.min(total,total>=config.percentageThreshold?total*config.percentageRate:config.minDepositAmount));
