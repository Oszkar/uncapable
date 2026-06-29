from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class ActionState(str, Enum):
    IDLE = "idle"
    BOTTLE_IN_HAND = "bottle_in_hand"
    CAP_OPENING = "cap_opening"
    DRINKING = "drinking"
    COMPLETED = "completed"
    UNCERTAIN = "uncertain"


class CameraStatus(str, Enum):
    LIVE = "live"
    DELAYED = "delayed"
    OFFLINE = "offline"


class Camera(BaseModel):
    id: str
    name: str
    location: str
    source_type: str = "demo"
    source_url: str | None = None
    status: CameraStatus = CameraStatus.OFFLINE
    fps: float = 0
    latency_ms: int = 0
    resolution: tuple[int, int] = (960, 540)


class CameraCreate(BaseModel):
    id: str
    name: str
    location: str = ""
    source_type: str = Field(pattern="^(rtsp|webcam|mp4|demo)$")
    source_url: str | None = None


class DetectionSignals(BaseModel):
    hand_bottle_proximity: float = 0
    neck_hand_proximity: float = 0
    wrist_rotation: float = 0
    mouth_bottle_proximity: float = 0
    bottle_tilt: float = 0


class ActionOutput(BaseModel):
    state: ActionState
    confidence: float
    signals: DetectionSignals


class PersonOutput(BaseModel):
    track_id: int
    pose_keypoints: list[list[float]]
    hand_keypoints: dict[str, list[list[float]]]
    bottle_bbox: list[float] | None
    action: ActionOutput


class FrameOutput(BaseModel):
    ts: str
    camera_id: str
    frame_id: int
    frame_size: list[int]
    people: list[PersonOutput]
    system: dict[str, Any]


class EventRecord(BaseModel):
    event_id: str
    camera_id: str
    track_id: int
    start_ts: str
    end_ts: str
    sequence: list[str]
    confidence: float
    snapshot_path: str
    clip_path: str
    verified: bool = False
    note: str = ""


class VerifyRequest(BaseModel):
    verified: bool = True


class NoteRequest(BaseModel):
    note: str

