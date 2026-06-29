import {
  Activity,
  CalendarClock,
  CheckCircle2,
  Factory,
  Languages,
} from "lucide-react";
import { NavLink, Route, Routes } from "react-router-dom";
import { useI18n } from "./i18n";
import EventDetailPage from "./pages/EventDetailPage";
import EventsPage from "./pages/EventsPage";
import LivePage from "./pages/LivePage";

export default function App() {
  const { language, setLanguage, t } = useI18n();
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Factory size={20} /></div>
          <div>
            <strong>FACTORY ACTION CONSOLE</strong>
            <span>HYDRATION / PHASE 01</span>
          </div>
        </div>
        <nav className="main-nav" aria-label="Primary">
          <NavLink to="/" end><Activity size={17} />{t("live")}</NavLink>
          <NavLink to="/events"><CalendarClock size={17} />{t("events")}</NavLink>
        </nav>
        <div className="topbar-tools">
          <div className="system-ok"><CheckCircle2 size={14} />{t("allSystems")}</div>
          <div className="language-control" aria-label="Language">
            <Languages size={15} />
            {(["EN", "JP"] as const).map((lang) => (
              <button
                className={language === lang ? "active" : ""}
                key={lang}
                onClick={() => setLanguage(lang)}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<LivePage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/:eventId" element={<EventDetailPage />} />
      </Routes>
    </div>
  );
}

