export type ActionState =
  | "idle"
  | "bottle_in_hand"
  | "cap_opening"
  | "drinking"
  | "completed"
  | "uncertain";

export interface Camera {
  id: string;
  name: string;
  location: string;
  source_type: string;
  source_url?: string;
  status: "live" | "delayed" | "offline";
  fps: number;
  latency_ms: number;
  resolution: [number, number];
}

export interface Signals {
  hand_bottle_proximity: number;
  neck_hand_proximity: number;
  wrist_rotation: number;
  mouth_bottle_proximity: number;
  bottle_tilt: number;
}

export interface PersonDetection {
  track_id: number;
  pose_keypoints: number[][];
  hand_keypoints: Record<string, number[][]>;
  bottle_bbox: number[] | null;
  action: {
    state: ActionState;
    confidence: number;
    signals: Signals;
  };
}

export interface FrameOutput {
  ts: string;
  camera_id: string;
  frame_id: number;
  frame_size: number[];
  people: PersonDetection[];
  system: { fps: number; latency_ms: number; status: string };
}

export interface HydrationEvent {
  event_id: string;
  camera_id: string;
  track_id: number;
  start_ts: string;
  end_ts: string;
  sequence: string[];
  confidence: number;
  snapshot_path: string;
  clip_path: string;
  verified: boolean;
  note: string;
}

