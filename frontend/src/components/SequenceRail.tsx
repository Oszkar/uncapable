import { Check, Droplets, RotateCw, ScanLine } from "lucide-react";
import type { ActionState } from "../types";
import { useI18n } from "../i18n";

const order: ActionState[] = ["bottle_in_hand", "cap_opening", "drinking"];

export default function SequenceRail({
  state,
  confidence,
}: {
  state: ActionState;
  confidence: number;
}) {
  const { t } = useI18n();
  const activeIndex = state === "completed" ? 3 : order.indexOf(state);
  const steps = [
    { key: "lift" as const, Icon: ScanLine },
    { key: "cap" as const, Icon: RotateCw },
    { key: "drink" as const, Icon: Droplets },
  ];
  return (
    <div className="sequence-rail">
      <div className="rail-head">
        <span>HYDRATION SEQUENCE</span>
        <strong>{Math.round(confidence * 100)}%</strong>
      </div>
      <div className="rail-steps">
        {steps.map(({ key, Icon }, index) => {
          const done = activeIndex > index;
          const active = activeIndex === index;
          return (
            <div className={`rail-step ${done ? "done" : ""} ${active ? "active" : ""}`} key={key}>
              <span className="rail-icon">{done ? <Check size={13} /> : <Icon size={13} />}</span>
              <span>{t(key)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

