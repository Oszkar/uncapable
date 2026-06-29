import { useEffect, useState } from "react";
import { ArrowLeft, Check, Download, Save } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getEvent, mediaUrl, noteEvent, verifyEvent } from "../api";
import { useI18n } from "../i18n";
import type { HydrationEvent } from "../types";

export default function EventDetailPage() {
  const { eventId = "" } = useParams();
  const { t } = useI18n();
  const [event, setEvent] = useState<HydrationEvent>();
  const [note, setNote] = useState("");

  useEffect(() => {
    getEvent(eventId).then((data) => { setEvent(data); setNote(data.note); });
  }, [eventId]);

  if (!event) return <main className="page-content loading">Loading event…</main>;
  const duration = Math.max(0, (new Date(event.end_ts).getTime() - new Date(event.start_ts).getTime()) / 1000);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(event, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${event.event_id}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <main className="page-content detail-page">
      <Link className="back-link" to="/events"><ArrowLeft size={16} />{t("back")}</Link>
      <div className="page-title">
        <div><span className="eyebrow">EVENT / {event.event_id.slice(0, 8).toUpperCase()}</span><h1>{t("details")}</h1></div>
        <div className="detail-actions">
          <button className="secondary-button" onClick={exportJson}><Download size={15} />{t("exportJson")}</button>
          <button
            className={event.verified ? "verified-button" : "primary-button"}
            onClick={async () => setEvent(await verifyEvent(event.event_id, !event.verified))}
          >
            <Check size={15} />{event.verified ? t("verified") : t("verify")}
          </button>
        </div>
      </div>
      <div className="detail-grid">
        <section className="clip-panel">
          <div className="section-label">{t("clip")}<span>BUFFER −10S / +10S</span></div>
          <video controls poster={mediaUrl(event.event_id, "snapshot")} src={mediaUrl(event.event_id, "clip")} />
        </section>
        <aside className="metadata-panel">
          <div className="section-label">{t("metadata")}</div>
          <dl>
            <div><dt>{t("time")}</dt><dd>{new Date(event.start_ts).toLocaleString()}</dd></div>
            <div><dt>{t("camera")}</dt><dd>{event.camera_id.toUpperCase()}</dd></div>
            <div><dt>{t("person")}</dt><dd>P{String(event.track_id).padStart(2, "0")}</dd></div>
            <div><dt>{t("duration")}</dt><dd>{duration.toFixed(1)} SEC</dd></div>
            <div><dt>{t("confidence")}</dt><dd>{Math.round(event.confidence * 100)}%</dd></div>
            <div><dt>{t("source")}</dt><dd>RULE ENGINE / V1</dd></div>
          </dl>
          <div className="detail-sequence">
            {event.sequence.map((step, index) => (
              <div key={step}><span>{index + 1}</span><strong>{step.replace(/_/g, " ").toUpperCase()}</strong><Check size={14} /></div>
            ))}
          </div>
        </aside>
        <section className="snapshot-panel">
          <div className="section-label">{t("snapshot")}<span>COMPLETION FRAME</span></div>
          <img src={mediaUrl(event.event_id, "snapshot")} alt="Hydration event completion" />
        </section>
        <section className="notes-panel">
          <div className="section-label">{t("notes")}</div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add operational context…" />
          <button className="secondary-button" onClick={async () => setEvent(await noteEvent(event.event_id, note))}>
            <Save size={15} />{t("saveNote")}
          </button>
        </section>
      </div>
    </main>
  );
}
