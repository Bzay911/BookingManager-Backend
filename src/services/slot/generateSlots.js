import formatTime from "./formatTime.js";
import roundUpToSlot from "./roundUpToSlot.js";

export default function generateSlots(openingTime, closingTime, serviceTime, targetDate) {
  const slots = [];
  const date = new Date(targetDate);
  const roundedServiceTime = roundUpToSlot(serviceTime);

  // Parse "09:00" into hours and minutes
  const [openHour, openMin] = openingTime.split(":").map(Number);
  const [closeHour, closeMin] = closingTime.split(":").map(Number);

  // Build actual Date objects for opening and closing on the given day
  const open = new Date(date);
  open.setHours(openHour, openMin, 0, 0);

  const close = new Date(date);
  close.setHours(closeHour, closeMin, 0, 0);

  // Walk forward from open, one slotSize at a time
  let current = new Date(open);

  while (current < close) {
    const slotStart = new Date(current);
    const slotEnd = new Date(current.getTime() + roundedServiceTime * 60 * 1000);

    // Only add slot if it fully fits before closing time
    if (slotEnd <= close) {
      slots.push({
        start: slotStart,
        end: slotEnd,
        label: `${formatTime(slotStart)} - ${formatTime(slotEnd)}`,
      });
    }

    // Move forward by one slot
    current = new Date(current.getTime() + roundedServiceTime * 60 * 1000);
  }

  return slots;
}