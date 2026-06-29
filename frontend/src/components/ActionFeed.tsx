import { Check, ChevronRight, Droplets, RotateCw, ScanLine } from "lucide-react";
import { Link } from "react-router-dom";
import { mediaUrl, verifyEvent } from "../api";
import { useI18n } from "../i18n";
import type { ActionState, HydrationEvent } from "../types";

const stateIcons = {
  idle: ScanLine,
  uncertain: ScanLine,
  bottle_in_hand: ScanLine,
  cap_opening: RotateCw,
  drinking: Droplets,
  completed: Check,
};

export default function ActionFeed({
  liveState,
  confidence,
  events,
  onVerified,
}: {
  liveState: ActionState;
  confidence: number;
  events: HydrationEvent[];
  onVerified: () => void;
}) {
  const { t } = useI18n();
  const Icon = stateIcons[liveState];
  return (
    <aside className="action-panel">
      <div className="panel-heading">
        <span>{t("liveFeed")}</span>
        <span className="pulse-label"><i /> LIVE</span>
      </div>
      <div className={`live-action state-${liveState}`}>
        <div className="action-icon"><Icon size={18} /></div>
        <div>
          <strong>{t(liveState)}</strong>
          <span>PERSON 00 · {Math.round(confidence * 100)}%</span>
        </div>
        <time>{new Date().toLocaleTimeString([], { hour12: false })}</time>
      </div>
      <div className="feed-list">
        {events.length === 0 && <div className="empty-feed">{t("noEvents")}</div>}
        {events.slice(0, 5).map((event) => (
          <article className="event-card" key={event.event_id}>
            <img src={mediaUrl(event.event_id, "snapshot")} alt="" />
            <div className="event-card-body">
              <div className="event-card-title">
                <strong>{t("completed")}</strong>
                <span>{Math.round(event.confidence * 100)}%</span>
              </div>
              <span>{event.camera_id.toUpperCase()} · P{String(event.track_id).padStart(2, "0")}</span>
              <time>{new Date(event.end_ts).toLocaleTimeString([], { hour12: false })}</time>
              <div className="event-actions">
                {event.verified ? (
                  <span className="verified-label"><Check size={13} />{t("verified")}</span>
                ) : (
                  <button onClick={async () => { await verifyEvent(event.event_id); onVerified(); }}>
                    <Check size={14} />{t("verify")}
                  </button>
                )}
                <Link to={`/events/${event.event_id}`} aria-label={t("review")}><ChevronRight size={17} /></Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}

