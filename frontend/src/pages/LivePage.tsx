import { useCallback, useEffect, useMemo, useState } from "react";
import { Maximize, Pause, Radio, SlidersHorizontal } from "lucide-react";
import { getCameras, getEvents, socketUrl, streamUrl } from "../api";
import ActionFeed from "../components/ActionFeed";
import SequenceRail from "../components/SequenceRail";
import { StatusDot } from "../components/StatusDot";
import VideoOverlay from "../components/VideoOverlay";
import { useI18n } from "../i18n";
import type { Camera, FrameOutput, HydrationEvent } from "../types";

export default function LivePage() {
  const { t } = useI18n();
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedId, setSelectedId] = useState("cam-001");
  const [frame, setFrame] = useState<FrameOutput>();
  const [events, setEvents] = useState<HydrationEvent[]>([]);
  const [toggles, setToggles] = useState({ bottle: true, pose: true, hands: true });

  const refreshEvents = useCallback(() => {
    getEvents().then(setEvents).catch(console.error);
  }, []);

  useEffect(() => {
    getCameras().then(setCameras).catch(console.error);
    refreshEvents();
    const interval = window.setInterval(() => {
      getCameras().then(setCameras).catch(console.error);
      refreshEvents();
    }, 4000);
    return () => clearInterval(interval);
  }, [refreshEvents]);

  useEffect(() => {
    setFrame(undefined);
    const socket = new WebSocket(socketUrl(selectedId));
    socket.onmessage = (message) => setFrame(JSON.parse(message.data));
    return () => socket.close();
  }, [selectedId]);

  const selected = cameras.find((camera) => camera.id === selectedId);
  const person = frame?.people[0];
  const state = person?.action.state ?? "idle";
  const confidence = person?.action.confidence ?? 0;
  const recentEvents = useMemo(
    () => events.filter((event) => event.camera_id === selectedId),
    [events, selectedId],
  );

  return (
    <main className="live-layout">
      <aside className="camera-sidebar">
        <div className="panel-heading">{t("cameras")}<span>{cameras.length}</span></div>
        <div className="camera-list">
          {cameras.map((camera, index) => (
            <button
              key={camera.id}
              className={`camera-item ${selectedId === camera.id ? "selected" : ""}`}
              onClick={() => camera.status !== "offline" && setSelectedId(camera.id)}
            >
              <span className="camera-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="camera-info">
                <strong>{camera.name}</strong>
                <small>{camera.location}</small>
                <span className="camera-metrics">
                  <StatusDot status={camera.status} />
                  {camera.status.toUpperCase()}
                  <i />
                  {camera.fps.toFixed(1)} FPS
                  <i />
                  {camera.latency_ms} MS
                </span>
              </span>
            </button>
          ))}
        </div>
        <div className="source-note">
          <Radio size={15} />
          <div><strong>DEMO REPLAY</strong><span>MJPEG · 960 × 540</span></div>
        </div>
      </aside>

      <section className="monitor-stage">
        <div className="monitor-header">
          <div>
            <span className="eyebrow">{selected?.id.toUpperCase()} / {selected?.location}</span>
            <h1>{selected?.name ?? "Camera"}</h1>
          </div>
          <div className="monitor-tools">
            {(["bottle", "pose", "hands"] as const).map((key) => (
              <label key={key} className="overlay-toggle">
                <input
                  type="checkbox"
                  checked={toggles[key]}
                  onChange={() => setToggles((old) => ({ ...old, [key]: !old[key] }))}
                />
                <span />
                {t(key)}
              </label>
            ))}
            <button className="icon-button" title="Overlay settings"><SlidersHorizontal size={17} /></button>
          </div>
        </div>
        <div className="video-shell">
          <img src={streamUrl(selectedId)} alt={`Live view from ${selected?.name}`} />
          <VideoOverlay
            detection={person}
            sourceSize={frame?.frame_size ?? [960, 540]}
            toggles={toggles}
          />
          <div className="video-top-left">
            <span className="live-chip"><i /> LIVE</span>
            <span>{frame?.system.fps.toFixed(1) ?? "—"} FPS</span>
            <span>{frame?.system.latency_ms ?? "—"} MS</span>
          </div>
          <div className="person-label">P00</div>
          {confidence > 0.3 && (
            <div className={`action-state-label state-${state}`}>
              <span>{t(state)}</span>
              <strong>{Math.round(confidence * 100)}%</strong>
            </div>
          )}
          <SequenceRail state={state} confidence={confidence} />
          <div className="video-controls">
            <button title="Pause"><Pause size={15} /></button>
            <span>FAKE LIVE · {new Date().toLocaleTimeString([], { hour12: false })}</span>
            <button title="Fullscreen" onClick={() => document.querySelector(".video-shell")?.requestFullscreen()}>
              <Maximize size={15} />
            </button>
          </div>
        </div>
        <Timeline events={recentEvents} />
      </section>

      <ActionFeed
        liveState={state}
        confidence={confidence}
        events={recentEvents}
        onVerified={refreshEvents}
      />
    </main>
  );
}

function Timeline({ events }: { events: HydrationEvent[] }) {
  const { t } = useI18n();
  const now = Date.now();
  return (
    <div className="timeline-panel">
      <div className="timeline-head"><span>{t("timeline")}</span><strong>{events.length} EVENTS</strong></div>
      <div className="timeline-track">
        {Array.from({ length: 11 }).map((_, i) => (
          <span className="timeline-tick" style={{ left: `${i * 10}%` }} key={i}>
            {i % 2 === 0 ? `${10 - i}m` : ""}
          </span>
        ))}
        {events.map((event) => {
          const age = Math.min(600000, Math.max(0, now - new Date(event.end_ts).getTime()));
          return (
            <a
              href={`/events/${event.event_id}`}
              key={event.event_id}
              className="timeline-marker"
              style={{ left: `${100 - (age / 600000) * 100}%` }}
              title={new Date(event.end_ts).toLocaleTimeString()}
            />
          );
        })}
      </div>
    </div>
  );
}

