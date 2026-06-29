from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from .camera import CameraManager, DATA_DIR
from .models import NoteRequest, VerifyRequest
from .storage import EventStore


store = EventStore(DATA_DIR / "factory.db")
manager = CameraManager(store, DATA_DIR)


@asynccontextmanager
async def lifespan(_: FastAPI):
    manager.start_defaults()
    yield
    manager.stop_all()


app = FastAPI(title="Factory Action Console API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/cameras")
def cameras():
    return list(manager.cameras.values())


@app.post("/api/cameras/{camera_id}/start")
def start_camera(camera_id: str):
    try:
        return manager.start(camera_id)
    except KeyError:
        raise HTTPException(404, "Camera is not available in this runtime")


@app.post("/api/cameras/{camera_id}/stop")
def stop_camera(camera_id: str):
    try:
        return manager.stop(camera_id)
    except KeyError:
        raise HTTPException(404, "Camera is not available in this runtime")


@app.get("/api/cameras/{camera_id}/mjpeg")
def mjpeg(camera_id: str):
    worker = manager.workers.get(camera_id)
    if not worker:
        raise HTTPException(404, "No active stream for this camera")

    def frames():
        last = None
        while worker.running:
            with worker.lock:
                worker.lock.wait_for(lambda: worker.latest_jpeg is not last, timeout=2)
                jpeg = worker.latest_jpeg
            if jpeg:
                last = jpeg
                yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + jpeg + b"\r\n"

    return StreamingResponse(frames(), media_type="multipart/x-mixed-replace; boundary=frame")


@app.websocket("/ws/cameras/{camera_id}")
async def camera_socket(websocket: WebSocket, camera_id: str):
    worker = manager.workers.get(camera_id)
    if not worker:
        await websocket.close(code=4404)
        return
    await websocket.accept()
    last_id = -1
    try:
        while True:
            output = worker.latest_output
            if output and output.frame_id != last_id:
                await websocket.send_json(output.model_dump(mode="json"))
                last_id = output.frame_id
            await asyncio.sleep(1 / 30)
    except WebSocketDisconnect:
        pass


@app.get("/api/events")
def events(
    camera_id: str | None = None,
    verified: bool | None = None,
    from_ts: str | None = Query(None, alias="from"),
    to_ts: str | None = Query(None, alias="to"),
):
    return store.list(camera_id, verified, from_ts, to_ts)


def event_or_404(event_id: str):
    event = store.get(event_id)
    if not event:
        raise HTTPException(404, "Event not found")
    return event


@app.get("/api/events/{event_id}")
def event_detail(event_id: str):
    return event_or_404(event_id)


@app.post("/api/events/{event_id}/verify")
def verify_event(event_id: str, request: VerifyRequest):
    event_or_404(event_id)
    return store.verify(event_id, request.verified)


@app.post("/api/events/{event_id}/note")
def note_event(event_id: str, request: NoteRequest):
    event_or_404(event_id)
    return store.note(event_id, request.note)


def media_response(event_id: str, attribute: str, media_type: str):
    event = event_or_404(event_id)
    path = Path(getattr(event, attribute))
    if not path.exists():
        raise HTTPException(404, "Media is not available yet")
    return FileResponse(path, media_type=media_type)


@app.get("/api/events/{event_id}/snapshot")
def snapshot(event_id: str):
    return media_response(event_id, "snapshot_path", "image/jpeg")


@app.get("/api/events/{event_id}/clip")
def clip(event_id: str):
    return media_response(event_id, "clip_path", "video/mp4")

