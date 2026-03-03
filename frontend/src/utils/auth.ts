import { getCookie } from "./cookies";

function isTokenValid(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return typeof payload.exp === "number" && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

/** Returns where to send the user when they click "Go to Dashboard". */
export function getAuthDestination(): "/dashboard" | "/signup" {
  const refresh = getCookie("refresh_token");
  if (refresh && isTokenValid(refresh)) return "/dashboard";
  return "/signup";
}
