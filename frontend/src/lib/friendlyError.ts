export function friendlyErrorMessage(
  reason: unknown,
  fallback = "Something went wrong. Please try again.",
) {
  const message = reason instanceof Error ? reason.message : String(reason ?? "");
  const normalized = message.toLowerCase();

  if (normalized.includes("enter a valid email address")) {
    return "Please enter a valid email address.";
  }

  if (
    normalized.includes("already booked")
    || normalized.includes("already held")
    || normalized.includes("held by another customer")
    || normalized.includes("is reserved")
    || normalized.includes("seat is unavailable")
    || normalized.includes("seats are unavailable")
  ) {
    return "One or more selected seats are no longer available. Please choose different seats.";
  }

  if (
    normalized.includes("show not found")
    || normalized.includes("show date has ended")
    || normalized.includes("show is no longer available")
  ) {
    return "This show is no longer available for booking.";
  }

  if (
    normalized.includes("failed to fetch")
    || normalized.includes("network")
    || normalized.includes("transport")
    || normalized.includes("resource temporarily unavailable")
  ) {
    return "We couldn't reach the service. Check your connection and try again.";
  }

  if (
    normalized.includes("not authenticated")
    || normalized.includes("unauthorized")
    || normalized.includes("admin access")
    || normalized.includes("permission")
  ) {
    return "Your admin session has expired. Sign in again and retry.";
  }

  if (normalized.includes("ticket not found")) {
    return "No ticket matches that booking ID. Check the code and try again.";
  }

  if (normalized.includes("ticket is cancelled") || normalized.includes("ticket is canceled")) {
    return "This ticket was cancelled and cannot be checked in.";
  }

  if (normalized.includes("already been used") || normalized.includes("already checked")) {
    return "This ticket has already been checked in.";
  }

  return fallback;
}
