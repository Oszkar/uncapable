import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Filter, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { getCameras, getEvents, mediaUrl } from "../api";
import { StatusDot } from "../components/StatusDot";
import { useI18n } from "../i18n";
import type { Camera, HydrationEvent } from "../types";

export default function EventsPage() {
  const { t } = useI18n();
  const [events, setEvents] = useState<HydrationEvent[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [camera, setCamera] = useState("");
  const [status, setStatus] = useState("");
  const [minimum, setMinimum] = useState(0);

  useEffect(() => {
    getEvents().then(setEvents);
    getCameras().then(setCameras);
  }, []);

  const filtered = useMemo(
    () => events.filter((event) =>
      (!camera || event.camera_id === camera) &&
      (!status || String(event.verified) === status) &&
      event.confidence * 100 >= minimum,
    ),
    [events, camera, status, minimum],
  );

  return (
    <main className="page-content">
      <div className="page-title">
        <div><span className="eyebrow">HYDRATION / EVENT HISTORY</span><h1>{t("events")}</h1></div>
        <div className="result-count"><strong>{filtered.length}</strong><span>DETECTIONS</span></div>
      </div>
      <section className="filter-bar">
        <div className="filter-title"><Filter size={16} />{t("filters")}</div>
        <label><span>{t("date")}</span><input type="date" /></label>
        <label><span>{t("camera")}</span>
          <select value={camera} onChange={(e) => setCamera(e.target.value)}>
            <option value="">{t("all")}</option>
            {cameras.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label><span>{t("status")}</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t("all")}</option>
            <option value="false">{t("unverified")}</option>
            <option value="true">{t("verified")}</option>
          </select>
        </label>
        <label className="confidence-filter"><span>{t("confidence")} ≥ {minimum}%</span>
          <input type="range" min="0" max="100" value={minimum} onChange={(e) => setMinimum(+e.target.value)} />
        </label>
        <button className="icon-button" title="Search"><Search size={17} /></button>
      </section>

      <section className="events-table">
        <div className="table-row table-head">
          <span>{t("snapshot")}</span><span>{t("time")}</span><span>{t("camera")}</span>
          <span>{t("sequence")}</span><span>{t("confidence")}</span><span>{t("status")}</span><span />
        </div>
        {filtered.map((event) => {
          const cameraInfo = cameras.find((item) => item.id === event.camera_id);
          return (
            <Link className="table-row event-row" to={`/events/${event.event_id}`} key={event.event_id}>
              <img src={mediaUrl(event.event_id, "snapshot")} alt="" />
              <span className="time-cell"><strong>{new Date(event.end_ts).toLocaleTimeString([], { hour12: false })}</strong><small>{new Date(event.end_ts).toLocaleDateString()}</small></span>
              <span className="camera-cell"><StatusDot status="live" /><strong>{cameraInfo?.name ?? event.camera_id}</strong><small>{event.camera_id}</small></span>
              <span className="sequence-cell"><i>LIFT</i><b /><i>CAP</i><b /><i>DRINK</i></span>
              <span className="confidence-cell"><strong>{Math.round(event.confidence * 100)}%</strong><i><b style={{ width: `${event.confidence * 100}%` }} /></i></span>
              <span className={event.verified ? "status-verified" : "status-pending"}>
                {event.verified && <Check size={13} />}{event.verified ? t("verified") : t("unverified")}
              </span>
              <ChevronRight size={18} />
            </Link>
          );
        })}
        {filtered.length === 0 && <div className="table-empty">{t("noEvents")}</div>}
      </section>
    </main>
  );
}

