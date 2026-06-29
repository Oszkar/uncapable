#!/usr/bin/env python3
"""Generate deterministic positive and negative MP4 fixtures for demos/tests."""

import sys
from pathlib import Path

import cv2

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.camera import DemoScene  # noqa: E402


def write_sample(name: str, negative: bool) -> None:
    output = ROOT / "samples" / name
    output.parent.mkdir(parents=True, exist_ok=True)
    scene = DemoScene(negative=negative)
    writer = cv2.VideoWriter(
        str(output),
        cv2.VideoWriter_fourcc(*"mp4v"),
        12,
        (scene.width, scene.height),
    )
    for frame_index in range(360):
        frame, _, _ = scene.render(frame_index)
        writer.write(frame)
    writer.release()
    print(f"Wrote {output}")


if __name__ == "__main__":
    write_sample("hydration_sequence.mp4", negative=False)
    write_sample("negative_bottle_nearby.mp4", negative=True)

