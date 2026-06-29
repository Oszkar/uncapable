from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from .models import EventRecord


class EventStore:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _initialize(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS events (
                    event_id TEXT PRIMARY KEY,
                    camera_id TEXT NOT NULL,
                    track_id INTEGER NOT NULL,
                    start_ts TEXT NOT NULL,
                    end_ts TEXT NOT NULL,
                    sequence TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    snapshot_path TEXT NOT NULL,
                    clip_path TEXT NOT NULL,
                    verified INTEGER NOT NULL DEFAULT 0,
                    note TEXT NOT NULL DEFAULT ''
                )
                """
            )

    def save(self, event: EventRecord) -> EventRecord:
        data = event.model_dump()
        data["sequence"] = json.dumps(data["sequence"])
        data["verified"] = int(data["verified"])
        with self._connect() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO events VALUES (
                    :event_id, :camera_id, :track_id, :start_ts, :end_ts,
                    :sequence, :confidence, :snapshot_path, :clip_path,
                    :verified, :note
                )
                """,
                data,
            )
        return event

    def list(
        self,
        camera_id: str | None = None,
        verified: bool | None = None,
        from_ts: str | None = None,
        to_ts: str | None = None,
    ) -> list[EventRecord]:
        clauses, params = [], []
        if camera_id:
            clauses.append("camera_id = ?")
            params.append(camera_id)
        if verified is not None:
            clauses.append("verified = ?")
            params.append(int(verified))
        if from_ts:
            clauses.append("start_ts >= ?")
            params.append(from_ts)
        if to_ts:
            clauses.append("end_ts <= ?")
            params.append(to_ts)
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        with self._connect() as conn:
            rows = conn.execute(
                f"SELECT * FROM events {where} ORDER BY start_ts DESC", params
            ).fetchall()
        return [self._row(row) for row in rows]

    def get(self, event_id: str) -> EventRecord | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM events WHERE event_id = ?", (event_id,)
            ).fetchone()
        return self._row(row) if row else None

    def verify(self, event_id: str, verified: bool) -> EventRecord | None:
        with self._connect() as conn:
            conn.execute(
                "UPDATE events SET verified = ? WHERE event_id = ?",
                (int(verified), event_id),
            )
        return self.get(event_id)

    def note(self, event_id: str, note: str) -> EventRecord | None:
        with self._connect() as conn:
            conn.execute("UPDATE events SET note = ? WHERE event_id = ?", (note, event_id))
        return self.get(event_id)

    @staticmethod
    def _row(row: sqlite3.Row) -> EventRecord:
        data = dict(row)
        data["sequence"] = json.loads(data["sequence"])
        data["verified"] = bool(data["verified"])
        return EventRecord(**data)

