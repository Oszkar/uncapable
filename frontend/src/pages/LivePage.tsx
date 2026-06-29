import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera as CameraIcon, Maximize, Pause, Radio, SlidersHorizontal } from "lucide-react";
import { getCameras, getEvents, socketUrl, streamUrl } from "../api";
import ActionFeed from "../components/ActionFeed";
import SequenceRail from "../components/SequenceRail";
import { StatusDot } from "../components/StatusDot";
import VideoOverlay from "../components/VideoOverlay";
import { useI18n } from "../i18n";
import type { Camera, FrameOutput, HydrationEvent } from "../types";

const CLOUD_CV_URL = "https://action-orc.pages.dev/";
const CLOUD_CV_CAMERA: Camera = {
  id: "cloud-cv",
  name: "Action ORC",
  location: "Cloudflare Pages · Production",
  source_type: "cloud",
  status: "live",
  fps: 0,
  latency_ms: 0,
  resolution: [1280, 720],
};

export default function LivePage() {
  const { t } = useI18n();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedId, setSelectedId] = useState("cam-local");
  const [frame, setFrame] = useState<FrameOutput>();
  const [webcamReady, setWebcamReady] = useState(false);
  const [webcamError, setWebcamError] = useState("");
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
    if (selectedId === "cam-local" || selectedId === "cloud-cv") return;
    const socket = new WebSocket(socketUrl(selectedId));
    socket.onmessage = (message) => setFrame(JSON.parse(message.data));
    return () => socket.close();
  }, [selectedId]);

  const cameraSources = useMemo(() => {
    const exists = cameras.some((camera) => camera.id === CLOUD_CV_CAMERA.id);
    return exists ? cameras : [...cameras, CLOUD_CV_CAMERA];
  }, [cameras]);
  const selected = cameraSources.find((camera) => camera.id === selectedId);
  const isLocalWebcam = selectedId === "cam-local";
  const isCloudCv = selectedId === "cloud-cv";
  const sourceLabel = isCloudCv ? "CLOUD CV" : isLocalWebcam ? "LOCAL WEBCAM" : "DEMO REPLAY";
  const streamLabel = isCloudCv
    ? "IFRAME · ACTION ORC"
    : selected
      ? `${selected.source_type.toUpperCase()} · ${selected.resolution[0]} × ${selected.resolution[1]}`
      : "MJPEG";
  const person = frame?.people[0];
  const state = person?.action.state ?? "idle";
  const confidence = person?.action.confidence ?? 0;
  const recentEvents = useMemo(
    () => events.filter((event) => event.camera_id === selectedId),
    [events, selectedId],
  );

  useEffect(() => {
    if (!isLocalWebcam) return;

    let stream: MediaStream | undefined;
    setWebcamReady(false);
    setWebcamError("");

    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: false })
      .then((mediaStream) => {
        stream = mediaStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mediaStream;
          localVideoRef.current.play().catch(console.error);
        }
        setWebcamReady(true);
      })
      .catch((error) => {
        console.error(error);
        setWebcamError("Camera permission is required for local preview");
      });

    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [isLocalWebcam]);

  return (
    <main className="live-layout">
      <aside className="camera-sidebar">
        <div className="panel-heading">{t("cameras")}<span>{cameraSources.length}</span></div>
        <div className="camera-list">
          {cameraSources.map((camera, index) => (
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
          {isLocalWebcam || isCloudCv ? <CameraIcon size={15} /> : <Radio size={15} />}
          <div><strong>{sourceLabel}</strong><span>{streamLabel}</span></div>
        </div>
      </aside>

      <section className="monitor-stage">
        <div className="monitor-header">
          <div>
            <span className="eyebrow">{selected?.id.toUpperCase()} / {selected?.location}</span>
            <h1>{selected?.name ?? "Camera"}</h1>
          </div>
          {!isCloudCv && (
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
          )}
        </div>
        <div className="video-shell">
          {isCloudCv ? (
            <iframe
              className="cloud-cv-source-frame"
              title="Action ORC Cloud CV"
              src={CLOUD_CV_URL}
              allow="camera; microphone; fullscreen; clipboard-read; clipboard-write"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : isLocalWebcam ? (
            <>
              <video ref={localVideoRef} autoPlay playsInline muted />
              {!webcamReady && (
                <div className="video-placeholder">
                  {webcamError || "Waiting for camera permission"}
                </div>
              )}
            </>
          ) : (
            <img src={streamUrl(selectedId)} alt={`Live view from ${selected?.name}`} />
          )}
          {!isCloudCv && (
            <>
              <VideoOverlay
                detection={person}
                sourceSize={frame?.frame_size ?? [960, 540]}
                toggles={toggles}
              />
              <div className="video-top-left">
                <span className="live-chip"><i /> LIVE</span>
                <span>{isLocalWebcam && webcamReady ? "BROWSER" : frame?.system.fps.toFixed(1) ?? "—"} FPS</span>
                <span>{frame?.system.latency_ms ?? "—"} MS</span>
              </div>
              {person && <div className="person-label">P00</div>}
              {confidence > 0.3 && (
                <div className={`action-state-label state-${state}`}>
                  <span>{t(state)}</span>
                  <strong>{Math.round(confidence * 100)}%</strong>
                </div>
              )}
              <SequenceRail state={state} confidence={confidence} />
              <div className="video-controls">
                <button title="Pause"><Pause size={15} /></button>
                <span>{sourceLabel} · {new Date().toLocaleTimeString([], { hour12: false })}</span>
                <button title="Fullscreen" onClick={() => document.querySelector(".video-shell")?.requestFullscreen()}>
                  <Maximize size={15} />
                </button>
              </div>
            </>
          )}
          {isCloudCv && (
            <div className="video-top-left">
              <span className="live-chip"><i /> LIVE</span>
              <span>CLOUD</span>
            </div>
          )}
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
