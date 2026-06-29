from __future__ import annotations

import math
import os
import threading
import time
import uuid
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np

from .detector import HydrationStateMachine
from .models import (
    ActionState,
    Camera,
    CameraStatus,
    DetectionSignals,
    EventRecord,
    FrameOutput,
    PersonOutput,
)
from .storage import EventStore


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class DemoScene:
    """Deterministic visual demo with signals shaped like real model outputs."""

    def __init__(self, width: int = 960, height: int = 540, negative: bool = False):
        self.width = width
        self.height = height
        self.negative = negative

    def render(self, index: int) -> tuple[np.ndarray, DetectionSignals, dict]:
        cycle = index % 360
        frame = np.full((self.height, self.width, 3), (20, 23, 25), dtype=np.uint8)
        self._background(frame)

        body_x, body_y = 495, 245
        head = (body_x, 135)
        shoulder_l, shoulder_r = (440, 210), (550, 210)
        hip_l, hip_r = (460, 345), (535, 345)
        knee_l, knee_r = (455, 445), (545, 445)
        wrist_l = [415, 310]
        wrist_r = [570, 305]
        bottle_center = [650, 360]
        angle = 0.0

        phase = "idle"
        if 50 <= cycle < 125:
            phase = "bottle_in_hand"
            p = (cycle - 50) / 75
            bottle_center = [int(650 - 82 * p), int(360 - 42 * p)]
            wrist_r = [bottle_center[0] - 12, bottle_center[1]]
        elif 125 <= cycle < 205:
            phase = "cap_opening"
            bottle_center = [568, 318]
            wrist_r = [557, 318]
            wrist_l = [568 + int(math.sin(cycle * 0.55) * 9), 282]
        elif 205 <= cycle < 290:
            phase = "drinking"
            p = min(1, (cycle - 205) / 28)
            bottle_center = [int(568 - 35 * p), int(318 - 140 * p)]
            wrist_r = [bottle_center[0] + 5, bottle_center[1] + 25]
            angle = -58 * p
        elif 290 <= cycle < 318:
            phase = "completed"
            bottle_center = [530, 178]
            wrist_r = [535, 205]
            angle = -58

        if self.negative:
            phase = "uncertain" if 90 <= cycle < 200 else "idle"
            bottle_center = [650, 335]
            wrist_r = [570, 305]
            angle = 0

        pose = [
            [head[0] / self.width, head[1] / self.height, 0.98],
            [shoulder_l[0] / self.width, shoulder_l[1] / self.height, 0.97],
            [shoulder_r[0] / self.width, shoulder_r[1] / self.height, 0.97],
            [wrist_l[0] / self.width, wrist_l[1] / self.height, 0.95],
            [wrist_r[0] / self.width, wrist_r[1] / self.height, 0.96],
            [hip_l[0] / self.width, hip_l[1] / self.height, 0.96],
            [hip_r[0] / self.width, hip_r[1] / self.height, 0.96],
            [knee_l[0] / self.width, knee_l[1] / self.height, 0.91],
            [knee_r[0] / self.width, knee_r[1] / self.height, 0.92],
        ]
        hands = {
            "left": self._hand_points(wrist_l),
            "right": self._hand_points(wrist_r),
        }

        self._draw_person(frame, pose, hands)
        bbox = self._draw_bottle(frame, bottle_center, angle)
        signals = self._signals(phase, cycle)
        return frame, signals, {
            "pose": pose,
            "hands": hands,
            "bbox": [v / (self.width if i % 2 == 0 else self.height) for i, v in enumerate(bbox)],
            "phase": phase,
        }

    def _background(self, frame: np.ndarray) -> None:
        cv2.rectangle(frame, (0, 0), (960, 68), (31, 35, 38), -1)
        cv2.putText(frame, "ASSEMBLY CELL A / DEMO FEED", (28, 42), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (150, 160, 165), 1, cv2.LINE_AA)
        cv2.rectangle(frame, (40, 390), (300, 520), (41, 46, 48), -1)
        cv2.rectangle(frame, (600, 380), (920, 520), (35, 40, 42), -1)
        for x in range(30, 960, 80):
            cv2.line(frame, (x, 70), (x, 540), (27, 31, 33), 1)
        cv2.line(frame, (0, 380), (960, 380), (69, 75, 76), 2)
        cv2.rectangle(frame, (622, 336), (685, 380), (65, 73, 75), -1)

    def _draw_person(self, frame: np.ndarray, pose: list, hands: dict) -> None:
        pts = [(int(p[0] * self.width), int(p[1] * self.height)) for p in pose]
        edges = [(1, 2), (1, 3), (2, 4), (1, 5), (2, 6), (5, 6), (5, 7), (6, 8)]
        cv2.circle(frame, pts[0], 33, (73, 78, 80), -1)
        cv2.line(frame, pts[1], pts[5], (86, 92, 94), 18)
        cv2.line(frame, pts[2], pts[6], (86, 92, 94), 18)
        for a, b in edges:
            cv2.line(frame, pts[a], pts[b], (98, 105, 107), 12, cv2.LINE_AA)
        cv2.rectangle(frame, (454, 205), (538, 345), (55, 65, 68), -1)
        cv2.rectangle(frame, (472, 220), (520, 270), (196, 137, 36), -1)
        for hand in hands.values():
            x, y = int(hand[0][0] * self.width), int(hand[0][1] * self.height)
            cv2.circle(frame, (x, y), 11, (120, 127, 129), -1)

    def _draw_bottle(self, frame: np.ndarray, center: list[int], angle: float) -> list[int]:
        overlay = np.zeros_like(frame)
        cx, cy = center
        cv2.rectangle(overlay, (cx - 14, cy - 46), (cx + 14, cy + 46), (190, 130, 42), -1)
        cv2.rectangle(overlay, (cx - 9, cy - 56), (cx + 9, cy - 43), (210, 151, 50), -1)
        cv2.rectangle(overlay, (cx - 10, cy - 62), (cx + 10, cy - 55), (70, 150, 175), -1)
        matrix = cv2.getRotationMatrix2D((cx, cy), angle, 1)
        rotated = cv2.warpAffine(overlay, matrix, (self.width, self.height))
        mask = rotated.any(axis=2)
        frame[mask] = rotated[mask]
        size = 68 if abs(angle) > 25 else 48
        return [cx - size // 2, cy - size, cx + size // 2, cy + size]

    def _hand_points(self, wrist: list[int]) -> list[list[float]]:
        points = []
        for i in range(9):
            angle = i * 0.8
            points.append([
                (wrist[0] + math.cos(angle) * (i % 3) * 5) / self.width,
                (wrist[1] + math.sin(angle) * (i % 3) * 5) / self.height,
                0.9,
            ])
        return points

    @staticmethod
    def _signals(phase: str, index: int) -> DetectionSignals:
        wobble = 0.03 * math.sin(index * 0.33)
        presets = {
            "idle": (0.08, 0.05, 0.04, 0.06, 0.04),
            "bottle_in_hand": (0.9, 0.34, 0.14, 0.12, 0.1),
            "cap_opening": (0.86, 0.91, 0.88, 0.2, 0.12),
            "drinking": (0.9, 0.3, 0.2, 0.94, 0.92),
            "completed": (0.84, 0.2, 0.12, 0.88, 0.86),
            "uncertain": (0.4, 0.22, 0.1, 0.2, 0.1),
        }
        vals = [max(0, min(1, value + wobble)) for value in presets[phase]]
        return DetectionSignals(
            hand_bottle_proximity=vals[0],
            neck_hand_proximity=vals[1],
            wrist_rotation=vals[2],
            mouth_bottle_proximity=vals[3],
            bottle_tilt=vals[4],
        )


class CameraWorker:
    def __init__(self, camera: Camera, store: EventStore, data_dir: Path):
        self.camera = camera
        self.store = store
        self.data_dir = data_dir
        self.running = False
        self.thread: threading.Thread | None = None
        self.lock = threading.Condition()
        self.latest_jpeg: bytes | None = None
        self.latest_output: FrameOutput | None = None
        self.machine = HydrationStateMachine()
        self.ring: deque[tuple[np.ndarray, str]] = deque(maxlen=150)
        self.completion_emitted = False
        self.pending_event: dict | None = None
        self.scene = (
            DemoScene(negative=camera.id == "cam-002")
            if camera.source_type == "demo"
            else None
        )
        self.capture: cv2.VideoCapture | None = None

    def start(self) -> None:
        if self.running:
            return
        self.running = True
        self.camera.status = CameraStatus.LIVE
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def stop(self) -> None:
        self.running = False
        self.camera.status = CameraStatus.OFFLINE
        if self.thread:
            self.thread.join(timeout=2)
        self._release_capture()

    def _run(self) -> None:
        if self.camera.source_type == "webcam":
            self._run_capture()
        else:
            self._run_demo()

    def _run_demo(self) -> None:
        if not self.scene:
            return
        target_fps = 12
        frame_id = 0
        next_frame = time.perf_counter()
        while self.running:
            started = time.perf_counter()
            ts = utc_now()
            frame, signals, meta = self.scene.render(frame_id)
            action = self.machine.update(signals, ts)

            if meta["phase"] == "completed" and self.machine.state == ActionState.DRINKING:
                self.machine.state = ActionState.COMPLETED
                self.machine.state_frames = 1
                action.state = ActionState.COMPLETED
                action.confidence = 0.93

            if action.state == ActionState.COMPLETED and not self.completion_emitted:
                self._begin_event(frame, ts, action.confidence)
                self.completion_emitted = True
            if meta["phase"] == "idle" and self.completion_emitted:
                self.machine.reset_after_completion()
                self.completion_emitted = False

            person = PersonOutput(
                track_id=0,
                pose_keypoints=meta["pose"],
                hand_keypoints=meta["hands"],
                bottle_bbox=meta["bbox"],
                action=action,
            )
            elapsed = (time.perf_counter() - started) * 1000
            latency = int(145 + elapsed + 25 * abs(math.sin(frame_id / 30)))
            self.camera.fps = target_fps
            self.camera.latency_ms = latency
            self.camera.status = CameraStatus.DELAYED if latency > 800 else CameraStatus.LIVE
            output = FrameOutput(
                ts=ts,
                camera_id=self.camera.id,
                frame_id=frame_id,
                frame_size=[self.scene.width, self.scene.height],
                people=[person],
                system={
                    "fps": target_fps,
                    "latency_ms": latency,
                    "status": self.camera.status.value,
                },
            )
            _, encoded = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 82])
            self.ring.append((frame.copy(), ts))
            self._advance_pending_event(frame)
            with self.lock:
                self.latest_jpeg = encoded.tobytes()
                self.latest_output = output
                self.lock.notify_all()

            frame_id += 1
            next_frame += 1 / target_fps
            time.sleep(max(0, next_frame - time.perf_counter()))

    def _run_capture(self) -> None:
        target_fps = 20
        frame_id = 0
        next_frame = time.perf_counter()
        source = self._capture_source()

        while self.running:
            started = time.perf_counter()
            if not self.capture or not self.capture.isOpened():
                self.capture = cv2.VideoCapture(source)
                if not self.capture.isOpened():
                    self.camera.status = CameraStatus.OFFLINE
                    self.camera.fps = 0
                    self.camera.latency_ms = 0
                    time.sleep(1)
                    continue

            ok, frame = self.capture.read()
            if not ok or frame is None:
                self._release_capture()
                self.camera.status = CameraStatus.DELAYED
                time.sleep(0.25)
                continue

            ts = utc_now()
            height, width = frame.shape[:2]
            self.camera.resolution = (width, height)
            latency = int((time.perf_counter() - started) * 1000)
            self.camera.fps = target_fps
            self.camera.latency_ms = latency
            self.camera.status = CameraStatus.DELAYED if latency > 800 else CameraStatus.LIVE
            output = FrameOutput(
                ts=ts,
                camera_id=self.camera.id,
                frame_id=frame_id,
                frame_size=[width, height],
                people=[],
                system={
                    "fps": target_fps,
                    "latency_ms": latency,
                    "status": self.camera.status.value,
                },
            )
            _, encoded = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 82])
            with self.lock:
                self.latest_jpeg = encoded.tobytes()
                self.latest_output = output
                self.lock.notify_all()

            frame_id += 1
            next_frame += 1 / target_fps
            time.sleep(max(0, next_frame - time.perf_counter()))

        self._release_capture()

    def _capture_source(self) -> int | str:
        source = self.camera.source_url or os.getenv("FACTORY_WEBCAM_INDEX", "0")
        if source.isdigit():
            return int(source)
        return source

    def _release_capture(self) -> None:
        if self.capture:
            self.capture.release()
            self.capture = None

    def _begin_event(self, frame: np.ndarray, end_ts: str, confidence: float) -> None:
        if self.pending_event:
            return
        event_id = str(uuid.uuid4())
        snapshots = self.data_dir / "snapshots"
        clips = self.data_dir / "clips"
        snapshots.mkdir(parents=True, exist_ok=True)
        clips.mkdir(parents=True, exist_ok=True)
        snapshot_path = snapshots / f"{event_id}.jpg"
        clip_path = clips / f"{event_id}.mp4"
        cv2.imwrite(str(snapshot_path), frame)
        pre_frames = [buffered for buffered, _ in list(self.ring)[-120:]]
        self.pending_event = {
            "event_id": event_id,
            "end_ts": end_ts,
            "confidence": confidence,
            "snapshot_path": snapshot_path,
            "clip_path": clip_path,
            "start_ts": self.machine.sequence_started_at or end_ts,
            "frames": pre_frames,
            "post_frames": 0,
        }

    def _advance_pending_event(self, frame: np.ndarray) -> None:
        pending = self.pending_event
        if not pending:
            return
        pending["frames"].append(frame.copy())
        pending["post_frames"] += 1
        if pending["post_frames"] < 120:
            return

        writer = cv2.VideoWriter(
            str(pending["clip_path"]),
            cv2.VideoWriter_fourcc(*"mp4v"),
            12,
            (
                self.scene.width if self.scene else self.camera.resolution[0],
                self.scene.height if self.scene else self.camera.resolution[1],
            ),
        )
        for buffered in pending["frames"]:
            writer.write(buffered)
        writer.release()
        self.store.save(
            EventRecord(
                event_id=pending["event_id"],
                camera_id=self.camera.id,
                track_id=0,
                start_ts=pending["start_ts"],
                end_ts=pending["end_ts"],
                sequence=["bottle_in_hand", "cap_opening", "drinking"],
                confidence=pending["confidence"],
                snapshot_path=str(pending["snapshot_path"]),
                clip_path=str(pending["clip_path"]),
            )
        )
        self.pending_event = None


class CameraManager:
    def __init__(self, store: EventStore, data_dir: Path):
        self.store = store
        self.data_dir = data_dir
        self.cameras: dict[str, Camera] = {
            "cam-001": Camera(
                id="cam-001",
                name="Assembly Cell A",
                location="Line 01 · Station 04",
                source_type="demo",
            ),
            "cam-002": Camera(
                id="cam-002",
                name="Packing Gate",
                location="Line 02 · Exit",
                source_type="demo",
            ),
            "cam-003": Camera(
                id="cam-003",
                name="Welding Bay",
                location="Line 03 · Bay 02",
                source_type="rtsp",
                status=CameraStatus.OFFLINE,
            ),
            "cam-local": Camera(
                id="cam-local",
                name="Laptop Camera",
                location="Local device · Camera 0",
                source_type="webcam",
                source_url=os.getenv("FACTORY_WEBCAM_INDEX", "0"),
                status=CameraStatus.LIVE,
            ),
        }
        self.workers = {
            camera_id: CameraWorker(camera, store, data_dir)
            for camera_id, camera in self.cameras.items()
            if camera.source_type == "demo"
        }

    def start_defaults(self) -> None:
        for worker in self.workers.values():
            worker.start()

    def stop_all(self) -> None:
        for worker in self.workers.values():
            worker.stop()

    def start(self, camera_id: str) -> Camera:
        worker = self.workers.get(camera_id)
        if not worker:
            raise KeyError(camera_id)
        worker.start()
        return self.cameras[camera_id]

    def stop(self, camera_id: str) -> Camera:
        worker = self.workers.get(camera_id)
        if not worker:
            raise KeyError(camera_id)
        worker.stop()
        return self.cameras[camera_id]


DATA_DIR = Path(os.getenv("FACTORY_DATA_DIR", Path(__file__).parent.parent / "data"))
