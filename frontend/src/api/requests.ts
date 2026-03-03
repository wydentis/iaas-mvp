import axios, { AxiosError } from "axios";
import { setCookie, getCookie } from "../utils/cookies";

// ── Axios client ──────────────────────────────────────────────────────────────
export const api = axios.create({
  baseURL: "https://serverdam.wydentis.xyz",
  headers: { "Content-Type": "application/json" },
});

// ── Internal helpers ──────────────────────────────────────────────────────────
function extractMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    return (err.response?.data as { error?: string })?.error ?? err.message;
  }
  return "Ошибка запроса";
}

function authHeaders() {
  const token = getCookie("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function storeTokens(auth: AuthResponse) {
  const expiresAt = new Date(auth.expires_in);
  const accessMaxAge = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
  setCookie("access_token", auth.access_token, accessMaxAge > 0 ? accessMaxAge : 900);
  setCookie("refresh_token", auth.refresh_token, 7 * 24 * 60 * 60);
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: string;
}

export interface UserInfo {
  username: string;
  name: string;
  surname: string;
  email: string;
  phone: string;
}

export interface UserBalance {
  amount: number;
}

// ── Auth requests ─────────────────────────────────────────────────────────────
export async function signIn(payload: {
  username?: string;
  email?: string;
  phone?: string;
  password: string;
}): Promise<AuthResponse> {
  try {
    const { data } = await api.post<AuthResponse>("/auth/signin", payload);
    storeTokens(data);
    return data;
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function signUp(payload: {
  username: string;
  name: string;
  surname: string;
  email: string;
  phone: string;
  password: string;
  password_confirm: string;
}): Promise<AuthResponse> {
  try {
    const { data } = await api.post<AuthResponse>("/auth/signup", payload);
    storeTokens(data);
    return data;
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

// ── User requests ─────────────────────────────────────────────────────────────
export async function getUserInfo(): Promise<UserInfo> {
  try {
    const { data } = await api.get<UserInfo>("/user/info", { headers: authHeaders() });
    return data;
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function updateUserInfo(payload: UserInfo): Promise<UserInfo> {
  try {
    const { data } = await api.put<UserInfo>("/user/info", payload, { headers: authHeaders() });
    return data;
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function updatePassword(payload: {
  password: string;
  password_confirm: string;
}): Promise<void> {
  try {
    await api.put("/user/pass", payload, { headers: authHeaders() });
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function getBalance(): Promise<UserBalance> {
  try {
    const { data } = await api.get<UserBalance>("/user/balance", { headers: authHeaders() });
    return data;
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}
