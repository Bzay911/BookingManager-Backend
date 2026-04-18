import formatTime from "./formatTime.js";
import roundUpToSlot from "./roundUpToSlot.js";

// This function filters the slots so any slots that clashes with existing bookings are removed
// Also won't return any slots that are in the past

export default function filterAvailableSlots(slots, bookings, fromTime) {
  console.log('bookings to block:', bookings);
  const blockedWindows = bookings.map((booking) => {
    const bookedSlotSize = roundUpToSlot(booking.service.durationMinutes);
    const blockStart     = new Date(booking.scheduledAt);
    const blockEnd       = new Date(blockStart.getTime() + bookedSlotSize * 60 * 1000);
    console.log(`Blocked window: ${formatTime(blockStart)} - ${formatTime(blockEnd)}`);
    return { blockStart, blockEnd };
  });

  return slots.filter((slot) => {
    // Remove slots that have already started
    // if its for today we are passing the whole date without stripping the time, so that we can remove past slots. 
    // For future dates, fromTime will be the start of the day, so it won't remove any slots.
    if (slot.start < fromTime) return false;

    // Remove slots that conflict with any existing booking
    const hasConflict = blockedWindows.some(({ blockStart, blockEnd }) => {
      return slot.start < blockEnd && slot.end > blockStart;
    });

    return !hasConflict;
  });
};