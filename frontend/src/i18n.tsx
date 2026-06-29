import { createContext, useContext, useMemo, useState } from "react";

const translations = {
  EN: {
    live: "Live monitoring",
    events: "Events",
    cameras: "CAMERAS",
    liveFeed: "LIVE ACTION FEED",
    timeline: "10 MINUTE EVENT WINDOW",
    verify: "Verify",
    verified: "Verified",
    review: "Review event",
    allSystems: "System nominal",
    bottle: "Bottle",
    pose: "Pose",
    hands: "Hands",
    lift: "LIFT",
    cap: "CAP",
    drink: "DRINK",
    idle: "Monitoring",
    bottle_in_hand: "Bottle lifted",
    cap_opening: "Cap opening",
    drinking: "Drinking detected",
    completed: "Hydration complete",
    uncertain: "Action uncertain",
    filters: "Event filters",
    date: "Date range",
    camera: "Camera",
    status: "Review status",
    confidence: "Confidence",
    sequence: "Sequence",
    snapshot: "Snapshot",
    time: "Time",
    all: "All",
    unverified: "Unverified",
    details: "Event detail",
    back: "Back to events",
    metadata: "Detection metadata",
    notes: "Supervisor note",
    saveNote: "Save note",
    exportJson: "Export JSON",
    clip: "Replay clip",
    person: "Person ID",
    duration: "Duration",
    source: "Source",
    noEvents: "Waiting for a completed hydration sequence",
  },
  JP: {
    live: "ライブ監視",
    events: "イベント",
    cameras: "カメラ",
    liveFeed: "ライブアクション",
    timeline: "直近10分のイベント",
    verify: "確認する",
    verified: "確認済み",
    review: "イベントを確認",
    allSystems: "システム正常",
    bottle: "ボトル",
    pose: "姿勢",
    hands: "手",
    lift: "持上げ",
    cap: "開栓",
    drink: "飲水",
    idle: "監視中",
    bottle_in_hand: "ボトル持上げ",
    cap_opening: "開栓動作",
    drinking: "飲水を検出",
    completed: "水分補給完了",
    uncertain: "動作不明",
    filters: "イベント絞り込み",
    date: "期間",
    camera: "カメラ",
    status: "確認状態",
    confidence: "信頼度",
    sequence: "シーケンス",
    snapshot: "スナップショット",
    time: "時刻",
    all: "すべて",
    unverified: "未確認",
    details: "イベント詳細",
    back: "イベント一覧へ",
    metadata: "検出メタデータ",
    notes: "管理者メモ",
    saveNote: "メモを保存",
    exportJson: "JSON出力",
    clip: "クリップ再生",
    person: "人物ID",
    duration: "時間",
    source: "ソース",
    noEvents: "水分補給シーケンスの完了を待機中",
  },
} as const;

type Language = keyof typeof translations;
type Key = keyof typeof translations.EN;

const I18nContext = createContext({
  language: "EN" as Language,
  setLanguage: (_: Language) => {},
  t: (key: Key) => translations.EN[key] as string,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("EN");
  const value = useMemo(
    () => ({ language, setLanguage, t: (key: Key) => translations[language][key] }),
    [language],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);

