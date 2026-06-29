import type { Camera, HydrationEvent } from "./types";

export const API = import.meta.env.VITE_API_URL || "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export const getCameras = () => request<Camera[]>("/api/cameras");
export const getEvents = (query = "") =>
  request<HydrationEvent[]>(`/api/events${query}`);
export const getEvent = (id: string) =>
  request<HydrationEvent>(`/api/events/${id}`);
export const verifyEvent = (id: string, verified = true) =>
  request<HydrationEvent>(`/api/events/${id}/verify`, {
    method: "POST",
    body: JSON.stringify({ verified }),
  });
export const noteEvent = (id: string, note: string) =>
  request<HydrationEvent>(`/api/events/${id}/note`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });

export const mediaUrl = (id: string, type: "snapshot" | "clip") =>
  `${API}/api/events/${id}/${type}`;
export const streamUrl = (cameraId: string) =>
  `${API}/api/cameras/${cameraId}/mjpeg`;

export function socketUrl(cameraId: string) {
  const explicit = import.meta.env.VITE_WS_URL;
  if (explicit) return `${explicit}/ws/cameras/${cameraId}`;
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/ws/cameras/${cameraId}`;
}

