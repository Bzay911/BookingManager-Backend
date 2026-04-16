// this function is for rounding up the durationMinutes to the nearest 30 minutes

export default function roundUpToSlot(durationMinutes){
    return Math.ceil(durationMinutes / 30) * 30;
};