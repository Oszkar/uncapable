# Factory Action Console

Runnable Phase 1 console for real-time hydration action monitoring. The default demo
uses a deterministic fake-live camera pipeline, so the complete lift → cap → drink
workflow is available without camera hardware or model downloads.

## Start

```bash
docker compose up --build
```

Open `http://localhost:5173`. The API and OpenAPI docs are available at
`http://localhost:8000/docs`.

For local development:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

```bash
cd frontend
npm install
npm run dev
```

## Architecture

- **Frontend:** React, TypeScript, Vite, canvas overlays, MJPEG playback, WebSocket
  frame metadata, EN/JP labels.
- **Backend:** FastAPI, OpenCV camera worker, rule-based temporal state machine,
  SQLite event metadata, local snapshots and MP4 clips.
- **Detector boundary:** `SignalExtractor` in `backend/app/detector.py` is the swap
  point for MediaPipe Pose/Hands, YOLO bottle detection, or a learned classifier.
- **Demo mode:** generated 12 FPS factory scene with normalized pose, hand, bottle,
  and signal outputs. `cam-002` is a negative case.

## Camera Sources

The runtime ships with two fake-live demo cameras and one offline RTSP placeholder.
To connect a real source, create a `Camera` with `source_type="rtsp"` and its URL,
then replace `DemoScene.render` in the worker with an OpenCV capture:

```python
capture = cv2.VideoCapture("rtsp://user:password@host/stream")
ok, frame = capture.read()
```

For production RTSP, use GStreamer with hardware decode and reconnect/backoff.
Keep output coordinates normalized to source width/height; the UI canvas accounts
for responsive letterboxing.

MP4 replay uses the same capture path and should seek to frame zero at EOF. Generate
the included fixtures again with:

```bash
python scripts/generate_samples.py
```

## Detection Rules

1. `bottle_in_hand`: bottle/hand proximity with sustained motion.
2. `cap_opening`: bottle-neck hand proximity plus wrist rotation (Method 1).
3. `drinking`: bottle neck near mouth plus bottle tilt for sustained frames.
4. `completed`: valid ordered sequence reaches the completion hold.

Confidence is a weighted score of agreeing signals. Invalid transitions are ignored,
which prevents a bottle near the mouth from skipping lift and cap opening.

## API

- `GET /api/cameras`
- `POST /api/cameras/{camera_id}/start`
- `POST /api/cameras/{camera_id}/stop`
- `GET /api/cameras/{camera_id}/mjpeg`
- `WS /ws/cameras/{camera_id}`
- `GET /api/events`
- `GET /api/events/{event_id}`
- `POST /api/events/{event_id}/verify`
- `POST /api/events/{event_id}/note`
- `GET /api/events/{event_id}/snapshot`
- `GET /api/events/{event_id}/clip`

## Short Test Plan

1. **Lift:** select Assembly Cell A; confirm bottle bbox follows the right hand and
   state advances to Bottle lifted only after stable proximity.
2. **Cap:** confirm second hand moves to the neck, hand landmarks oscillate, and
   state advances to Cap opening.
3. **Drink:** confirm bottle moves to the mouth, tilts, persists, and advances to
   Drinking detected.
4. **Full sequence:** wait about 25 seconds; verify a completed event appears with
   snapshot, timestamp, confidence, clip, and timeline marker.
5. **Negative:** select Packing Gate; confirm the nearby bottle does not create a
   completed event.
6. **Overlay alignment:** resize Chrome from desktop to tablet width and verify pose,
   hands, and bottle remain registered over the MJPEG image.
7. **Review:** open Events, filter results, open detail, replay clip, add a note,
   verify, and export JSON.

## Three-Minute Demo

1. **Live detection:** show Assembly Cell A moving through lift, cap, drink while
   toggling pose/hands/bottle overlays and pointing out FPS/latency.
2. **False-positive guard:** switch to Packing Gate and show that an unattended
   nearby bottle remains uncertain and never completes.
3. **Supervisor workflow:** open the new event from the live feed, replay its clip,
   inspect metadata, add a note, verify it, and export JSON.

## Phase 2 Ready

- Learned temporal action classifier behind the existing detector interface.
- Custom cap detector (Method 2) without changing the state-machine consumer.
- Additional object classes: cups, tools, PPE, parts, and containers.
- Real multi-person tracking with persistent IDs and per-track state machines.
- MediaPipe Face landmarks for better mouth/head geometry.
- WebRTC low-latency video transport and GPU inference workers.
- Object storage, PostgreSQL, retention policy, audit logs, and role-based access.
- Multi-camera correlation, alert rules, shift analytics, and model feedback labels.

