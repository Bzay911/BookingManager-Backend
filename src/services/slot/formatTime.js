export default function formatTime(date) {
  return date.toLocaleTimeString("en-AU", {
    hour:   "numeric",
    minute: "2-digit",
    hour12: true,
  });
}