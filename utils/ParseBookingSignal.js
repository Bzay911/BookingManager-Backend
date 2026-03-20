function parseBookingSignal(replyMessage) {
  // we are generating in this format as we have mention in the context prompt
  const match = replyMessage.match(
    /CONFIRM_BOOKING:serviceId=(\d+),scheduledAt=([^\n]+)/
  );
  if (!match) return null;
 
  return {
    serviceId: parseInt(match[1]),
    scheduledAt: new Date(match[2].trim()),
  };
}
 
export default parseBookingSignal;
