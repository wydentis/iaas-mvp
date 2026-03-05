import axios, { AxiosError } from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { setCookie, getCookie, removeCookie } from "../utils/cookies";

// ── Axios client ──────────────────────────────────────────────────────────────
// In dev, Vite proxies /auth /user /vps /nodes → backend (no CORS needed).
// In production, requests go directly to the backend origin.
const BASE_URL = "/api";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

export function buildWsUrl(path: string) {
  if (!path.startsWith("/")) path = "/" + path;
  const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProto}//${window.location.host}${BASE_URL}${path}`;
}

// ── Request interceptor: inject Authorization header ─────────────────────────
api.interceptors.request.use((config) => {
  const token = getCookie("access_token");
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

// ── Token refresh interceptor ─────────────────────────────────────────────────
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    const refreshToken = getCookie("refresh_token");
    if (!refreshToken) {
      removeCookie("access_token");
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve) => {
        refreshQueue.push(resolve);
      }).then((newToken) => {
        original.headers["Authorization"] = `Bearer ${newToken}`;
        return api(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post<AuthResponse>(`${BASE_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      });
      storeTokens(data);
      refreshQueue.forEach((cb) => cb(data.access_token));
      refreshQueue = [];
      original.headers["Authorization"] = `Bearer ${data.access_token}`;
      return api(original);
    } catch {
      refreshQueue = [];
      removeCookie("access_token");
      removeCookie("refresh_token");
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  }
);

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
  role?: "user" | "admin";
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

// ── Container types ───────────────────────────────────────────────────────────
export type ContainerStatus = "UNKNOWN" | "PENDING" | "RUNNING" | "STOPPED" | "ERROR";

export interface Container {
  container_id: string;
  node_id: string;
  user_id: string;
  name: string;
  image: string;
  cpu: number;
  ram: number;
  disk: number;
  status: ContainerStatus;
  ip_address: string;
  created_at: string;
  updated_at: string;
}

export interface CreateContainerPayload {
  name: string;
  node_id: string;
  image: string;
  cpu: number;
  ram: number;
  disk: number;
  start_script: string;
}

export interface UpdateContainerSpecsPayload {
  cpu: number;
  ram: number;
  disk: number;
}

export interface Node {
  node_id: string;
  name: string;
  ip_address: string;
  status: string;
  cpu_cores: number;
  ram: number;
  disk_space: number;
  total_vcpu: number;
  total_ram_mb: number;
  total_disk_gb: number;
  cpu_price: number;
  ram_price: number;
  disk_price: number;
  // Dynamic fields from ListNodesWithResources
  used_cpu: number;
  used_ram_mb: number;
  used_disk_gb: number;
  dyn_cpu_price: number;
  dyn_ram_price: number;
  dyn_disk_price: number;
  public_ips_free: number;
}

export interface PublicIP {
  id: string;
  node_id: string;
  ip_address: string;
  container_id: string | null;
  price_monthly: number;
  created_at: string;
}

export interface PortMapping {
  id: string;
  container_id: string;
  host_port: number;
  container_port: number;
  protocol: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePortMappingPayload {
  container_port: number;
  host_port?: number;
  protocol: string;
}

export interface UpdatePortMappingPayload {
  container_port?: number;
  host_port?: number;
  protocol?: string;
}

// ── Container requests ────────────────────────────────────────────────────────
export async function listContainers(): Promise<Container[]> {
  try {
    const { data } = await api.get<Container[]>("/vps", { headers: authHeaders() });
    return data ?? [];
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function createContainer(payload: CreateContainerPayload): Promise<Container> {
  try {
    const { data } = await api.post<Container>("/vps", payload, { headers: authHeaders() });
    return data;
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function deleteContainer(id: string): Promise<void> {
  try {
    await api.delete(`/vps/${id}`, { headers: authHeaders() });
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function setContainerStatus(id: string, status: ContainerStatus): Promise<void> {
  try {
    await api.put(`/vps/${id}/status`, { status }, { headers: authHeaders() });
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function getContainer(id: string): Promise<Container> {
  try {
    const { data } = await api.get<Container>(`/vps/${id}`, { headers: authHeaders() });
    return data;
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function updateContainerInfo(id: string, name: string): Promise<void> {
  try {
    await api.put(`/vps/${id}/info`, { name }, { headers: authHeaders() });
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function updateContainerSpecs(id: string, payload: UpdateContainerSpecsPayload): Promise<void> {
  try {
    await api.put(`/vps/${id}/specs`, payload, { headers: authHeaders() });
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function runCommand(id: string, command: string): Promise<string> {
  try {
    const { data } = await api.post<{ output: string }>(`/vps/${id}/command`, { command }, { headers: authHeaders() });
    return data.output;
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function getPortMappings(id: string): Promise<PortMapping[]> {
  try {
    const { data } = await api.get<PortMapping[]>(`/vps/${id}/ports`, { headers: authHeaders() });
    return data ?? [];
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function createPortMapping(id: string, payload: CreatePortMappingPayload): Promise<PortMapping> {
  try {
    const { data } = await api.post<PortMapping>(`/vps/${id}/ports`, payload, { headers: authHeaders() });
    return data;
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function deletePortMapping(id: string, mappingId: string): Promise<void> {
  try {
    await api.delete(`/vps/${id}/ports/${mappingId}`, { headers: authHeaders() });
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function updatePortMapping(id: string, mappingId: string, payload: UpdatePortMappingPayload): Promise<PortMapping> {
  try {
    const { data } = await api.put<PortMapping>(`/vps/${id}/ports/${mappingId}`, payload, { headers: authHeaders() });
    return data;
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

// ── Node requests ─────────────────────────────────────────────────────────────
export async function listPublicNodes(): Promise<Node[]> {
  try {
    const { data } = await api.get<Node[]>("/nodes");
    return data ?? [];
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

// ── Balance ───────────────────────────────────────────────────────────────────
export async function changeBalance(amount: number): Promise<void> {
  try {
    await api.put("/user/balance", { amount }, { headers: authHeaders() });
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

// ── Private networks ───────────────────────────────────────────────────────────
export async function listNetworks(): Promise<Network[]> {
  try {
    const { data } = await api.get<Network[]>("/networks", { headers: authHeaders() });
    return data ?? [];
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function getNetwork(id: string): Promise<Network> {
  try {
    const { data } = await api.get<Network>(`/networks/${id}`, { headers: authHeaders() });
    return data;
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function createNetwork(payload: { name: string; description?: string; subnet?: string }): Promise<Network> {
  try {
    const { data } = await api.post<Network>("/networks", payload, { headers: authHeaders() });
    return data;
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function updateNetwork(id: string, payload: { name: string; description?: string }): Promise<Network> {
  try {
    const { data } = await api.put<Network>(`/networks/${id}`, payload, { headers: authHeaders() });
    return data;
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function deleteNetwork(id: string): Promise<void> {
  try {
    await api.delete(`/networks/${id}`, { headers: authHeaders() });
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function listNetworkContainers(id: string): Promise<NetworkAttachment[]> {
  try {
    const { data } = await api.get<NetworkAttachment[]>(`/networks/${id}/containers`, { headers: authHeaders() });
    return data ?? [];
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function listContainerNetworks(id: string): Promise<Network[]> {
  try {
    const { data } = await api.get<Network[]>(`/vps/${id}/networks`, { headers: authHeaders() });
    return data ?? [];
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function attachContainerToNetwork(id: string, payload: { container_id: string; ip_address?: string }): Promise<NetworkAttachment> {
  try {
    const { data } = await api.post<NetworkAttachment>(`/networks/${id}/containers`, payload, { headers: authHeaders() });
    return data;
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function detachContainerFromNetwork(id: string, containerId: string): Promise<void> {
  try {
    await api.delete(`/networks/${id}/containers/${containerId}`, { headers: authHeaders() });
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

// ── Admin types ───────────────────────────────────────────────────────────────
export interface AdminUser {
  user_id: string;
  username: string;
  name: string;
  surname: string;
  email: string;
  phone: string;
  balance: number;
  role: "user" | "admin";
  created_at: string;
  updated_at: string;
}

export interface CreateNodePayload {
  name: string;
  ip_address: string;
  status: string;
  cpu_cores: number;
  ram: number;
  disk_space: number;
}

export interface Network {
  network_id: string;
  user_id: string;
  name: string;
  description?: string;
  subnet: string;
  gateway: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface NetworkAttachment {
  id: string;
  network_id: string;
  container_id: string;
  ip_address: string;
  created_at: string;
}

export interface HardwareRecommendation {
  basic_minimum: { cpu_cores: number; ram_gb: number; disk_size_gb: number; reasoning: string };
  optimal: { cpu_cores: number; ram_gb: number; disk_size_gb: number; reasoning: string };
  luxury_maximum: { cpu_cores: number; ram_gb: number; disk_size_gb: number; reasoning: string };
}

export interface Snapshot {
  snapshot_id: string;
  user_id: string;
  name: string;
  description: string;
  image: string;
  cpu: number;
  ram: number;
  disk: number;
  start_script: string;
  is_public: boolean;
  created_at: string;
}

// ── Snapshots / Marketplace ───────────────────────────────────────────────────
export async function listPublicSnapshots(): Promise<Snapshot[]> {
  try {
    const { data } = await api.get<Snapshot[]>("/snapshots");
    return data;
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function getSnapshot(id: string): Promise<Snapshot> {
  try {
    const { data } = await api.get<Snapshot>(`/snapshots/${id}`);
    return data;
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function listMySnapshots(): Promise<Snapshot[]> {
  try {
    const { data } = await api.get<Snapshot[]>("/snapshots/my", { headers: authHeaders() });
    return data;
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function createSnapshot(payload: { container_id: string; name: string; description: string; is_public: boolean }): Promise<Snapshot> {
  try {
    const { data } = await api.post<Snapshot>("/snapshots", payload, { headers: authHeaders() });
    return data;
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function deleteSnapshot(id: string): Promise<void> {
  try {
    await api.delete(`/snapshots/${id}`, { headers: authHeaders() });
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

// ── Admin requests ────────────────────────────────────────────────────────────
export async function adminListUsers(): Promise<AdminUser[]> {
  try {
    const { data } = await api.get<AdminUser[]>("/admin/users", { headers: authHeaders() });
    return data ?? [];
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function adminListContainers(): Promise<Container[]> {
  try {
    const { data } = await api.get<Container[]>("/admin/containers", { headers: authHeaders() });
    return data ?? [];
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function adminListNodes(): Promise<Node[]> {
  try {
    const { data } = await api.get<Node[]>("/admin/nodes", { headers: authHeaders() });
    return data ?? [];
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function adminCreateNode(payload: CreateNodePayload): Promise<Node> {
  try {
    const { data } = await api.post<Node>("/admin/nodes", payload, { headers: authHeaders() });
    return data;
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function adminUpdateNode(id: string, payload: CreateNodePayload): Promise<Node> {
  try {
    const { data } = await api.put<Node>(`/admin/nodes/${id}`, payload, { headers: authHeaders() });
    return data;
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function adminDeleteNode(id: string): Promise<void> {
  try {
    await api.delete(`/admin/nodes/${id}`, { headers: authHeaders() });
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function adminFindUser(query: { email?: string; username?: string; phone?: string }): Promise<AdminUser | null> {
  try {
    const params = new URLSearchParams();
    if (query.email) params.append("email", query.email);
    if (query.username) params.append("username", query.username);
    if (query.phone) params.append("phone", query.phone);
    const { data } = await api.get<AdminUser | null>(`/admin/user?${params.toString()}`, { headers: authHeaders() });
    return data ?? null;
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function adminUpdateUserRole(userId: string, role: "user" | "admin"): Promise<void> {
  try {
    await api.put(`/admin/users/${userId}/role`, { role }, { headers: authHeaders() });
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function adminDeleteUser(userId: string): Promise<void> {
  try {
    await api.delete(`/admin/users/${userId}`, { headers: authHeaders() });
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function adminGetUserContainers(userId: string): Promise<Container[]> {
  try {
    const { data } = await api.get<Container[]>(`/admin/users/${userId}/containers`, { headers: authHeaders() });
    return data ?? [];
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function adminDeleteContainer(containerId: string): Promise<void> {
  try {
    await api.delete(`/admin/containers/${containerId}`, { headers: authHeaders() });
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

// ── AI services ────────────────────────────────────────────────────────────────
export async function getHardwareRecommendation(text: string): Promise<HardwareRecommendation> {
  try {
    const { data } = await api.post<HardwareRecommendation>("/ai/hardware-recommendation", { text }, { headers: authHeaders() });
    return data;
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export function createTerminalSocket(containerId: string, refreshMs = 1000): WebSocket {
  const token = getCookie("access_token") ?? "";
  const url = buildWsUrl(`/vps/${containerId}/terminal?token=${encodeURIComponent(token)}&refresh_ms=${refreshMs}`);
  return new WebSocket(url);
}

export function createMetricsSocket(containerId: string, refreshMs = 1000): WebSocket {
  const token = getCookie("access_token") ?? "";
  const url = buildWsUrl(`/vps/${containerId}/metrics?token=${encodeURIComponent(token)}&refresh_ms=${refreshMs}`);
  return new WebSocket(url);
}

export function createAiChatSocket(): WebSocket {
  const token = getCookie("access_token") ?? "";
  const url = buildWsUrl(`/ai/chat?token=${encodeURIComponent(token)}&refresh_ms=${5000}`);
  return new WebSocket(url);
}

export async function clearChatHistory(): Promise<void> {
  try {
    await api.delete("/ai/chat", { headers: authHeaders() });
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

// ── Public IP endpoints ──────────────────────────────────────────────────────

export async function listFreePublicIPs(nodeId: string): Promise<PublicIP[]> {
  try {
    const { data } = await api.get<PublicIP[]>(`/nodes/${nodeId}/public-ips`);
    return data ?? [];
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function assignPublicIP(containerId: string, ipId: string): Promise<PublicIP> {
  try {
    const { data } = await api.post<PublicIP>(`/vps/${containerId}/public-ip`, { ip_id: ipId }, { headers: authHeaders() });
    return data;
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function releasePublicIP(containerId: string): Promise<void> {
  try {
    await api.delete(`/vps/${containerId}/public-ip`, { headers: authHeaders() });
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function getContainerPublicIP(containerId: string): Promise<PublicIP | null> {
  try {
    const { data } = await api.get<PublicIP | null>(`/vps/${containerId}/public-ip`, { headers: authHeaders() });
    return data;
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}
