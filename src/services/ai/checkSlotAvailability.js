export default function checkSlotAvailable(bookings, proposedStart, slotSize) {
  const proposedEnd = new Date(proposedStart.getTime() + slotSize * 60 * 1000);

  return !bookings.some((booking) => {
    const bookedSlotSize = roundUpToSlot(booking.service.durationMinutes);
    const blockStart     = new Date(booking.scheduledAt);
    const blockEnd       = new Date(blockStart.getTime() + bookedSlotSize * 60 * 1000);

    return proposedStart < blockEnd && proposedEnd > blockStart;
  });
};