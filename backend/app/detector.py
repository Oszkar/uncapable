from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import Protocol

from .models import ActionOutput, ActionState, DetectionSignals


class SignalExtractor(Protocol):
    """Swap point for MediaPipe/YOLO or a learned temporal classifier."""

    def extract(self, frame, frame_index: int) -> DetectionSignals: ...


@dataclass
class HydrationStateMachine:
    state: ActionState = ActionState.IDLE
    state_frames: int = 0
    history: deque[ActionState] = field(default_factory=lambda: deque(maxlen=90))
    sequence_started_at: str | None = None

    thresholds = {
        "bottle_in_hand": 4,
        "cap_opening": 5,
        "drinking": 6,
        "completed": 8,
    }

    def update(self, signals: DetectionSignals, ts: str) -> ActionOutput:
        target, confidence = self._classify(signals)
        self.history.append(target)

        if target == self.state:
            self.state_frames += 1
        elif self._valid_transition(self.state, target):
            self.state = target
            self.state_frames = 1
            if target == ActionState.BOTTLE_IN_HAND:
                self.sequence_started_at = ts
        elif target == ActionState.IDLE and self.state not in (
            ActionState.DRINKING,
            ActionState.COMPLETED,
        ):
            self.state = ActionState.IDLE
            self.state_frames = 1

        required = self.thresholds.get(self.state.value, 1)
        stable_confidence = min(1.0, confidence * (0.7 + 0.3 * min(1, self.state_frames / required)))
        return ActionOutput(
            state=self.state,
            confidence=round(stable_confidence, 3),
            signals=signals,
        )

    def reset_after_completion(self) -> None:
        self.state = ActionState.IDLE
        self.state_frames = 0
        self.sequence_started_at = None
        self.history.clear()

    def _classify(self, s: DetectionSignals) -> tuple[ActionState, float]:
        hand_score = 0.75 * s.hand_bottle_proximity + 0.25 * s.neck_hand_proximity
        cap_score = (
            0.42 * s.neck_hand_proximity
            + 0.38 * s.wrist_rotation
            + 0.20 * s.hand_bottle_proximity
        )
        drink_score = (
            0.48 * s.mouth_bottle_proximity
            + 0.34 * s.bottle_tilt
            + 0.18 * s.hand_bottle_proximity
        )

        if drink_score >= 0.67:
            return ActionState.DRINKING, drink_score
        if cap_score >= 0.62 and s.wrist_rotation >= 0.48:
            return ActionState.CAP_OPENING, cap_score
        if hand_score >= 0.58:
            return ActionState.BOTTLE_IN_HAND, hand_score
        if max(hand_score, cap_score, drink_score) >= 0.38:
            return ActionState.UNCERTAIN, max(hand_score, cap_score, drink_score)
        return ActionState.IDLE, 1 - max(hand_score, cap_score, drink_score)

    @staticmethod
    def _valid_transition(current: ActionState, target: ActionState) -> bool:
        allowed = {
            ActionState.IDLE: {ActionState.BOTTLE_IN_HAND},
            ActionState.UNCERTAIN: {ActionState.BOTTLE_IN_HAND, ActionState.IDLE},
            ActionState.BOTTLE_IN_HAND: {ActionState.CAP_OPENING},
            ActionState.CAP_OPENING: {ActionState.DRINKING},
            ActionState.DRINKING: {ActionState.COMPLETED},
            ActionState.COMPLETED: {ActionState.IDLE},
        }
        return target in allowed.get(current, set())

