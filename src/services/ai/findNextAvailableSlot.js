import generateSlots from "../slot/generateSlots.js";
import filterAvailableSlots from "../slot/filterAvailableSlots.js";

export function findNextAvailableSlot(bookings, openingTime, closingTime, slotSize, date) {
  const allSlots         = generateSlots(openingTime, closingTime, slotSize, date);
  const availableSlots   = filterAvailableSlots(allSlots, bookings, new Date());

  return availableSlots.length > 0 ? availableSlots[0] : null;
}
