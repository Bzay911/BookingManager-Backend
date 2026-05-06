import { reminderQueue } from "./queue.js";

export async function scheduleReminder(booking){
    const bookingTime = new Date(booking.scheduledAt).getTime();
    const reminderTime = bookingTime - 15 * 60 * 1000; // 15 minutes before
    const delay = reminderTime - Date.now();

    if(delay <= 0){
        console.log(`Booking ${booking.id} is too soon, skipping reminder.`);
        return;
    }

    await reminderQueue.add("send-reminder", 
        {
            bookingId: booking.id,
        },
    {
        delay,
        jobId: `reminder-${booking.id}`
    });

    console.log(`Scheduled reminder for booking ID ${booking.id} in ${Math.round(delay / 1000)} seconds.`);
}