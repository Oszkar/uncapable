import { useEffect, useRef } from "react";
import type { PersonDetection } from "../types";

interface Props {
  detection?: PersonDetection;
  sourceSize: number[];
  toggles: { bottle: boolean; pose: boolean; hands: boolean };
}

const poseEdges = [[1, 2], [1, 3], [2, 4], [1, 5], [2, 6], [5, 6], [5, 7], [6, 8]];

export default function VideoOverlay({ detection, sourceSize, toggles }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const draw = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, rect.width, rect.height);
      if (!detection) return;

      const sourceRatio = sourceSize[0] / sourceSize[1];
      const boxRatio = rect.width / rect.height;
      const width = boxRatio > sourceRatio ? rect.height * sourceRatio : rect.width;
      const height = boxRatio > sourceRatio ? rect.height : rect.width / sourceRatio;
      const offsetX = (rect.width - width) / 2;
      const offsetY = (rect.height - height) / 2;
      const point = (p: number[]) => [offsetX + p[0] * width, offsetY + p[1] * height];

      if (toggles.pose) {
        ctx.strokeStyle = "#4dd7f2";
        ctx.fillStyle = "#4dd7f2";
        ctx.lineWidth = 2;
        poseEdges.forEach(([a, b]) => {
          const p1 = point(detection.pose_keypoints[a]);
          const p2 = point(detection.pose_keypoints[b]);
          ctx.beginPath();
          ctx.moveTo(p1[0], p1[1]);
          ctx.lineTo(p2[0], p2[1]);
          ctx.stroke();
        });
        detection.pose_keypoints.forEach((p) => {
          const [x, y] = point(p);
          ctx.beginPath();
          ctx.arc(x, y, 3.2, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      if (toggles.hands) {
        ctx.fillStyle = "#f1b643";
        Object.values(detection.hand_keypoints).flat().forEach((p) => {
          const [x, y] = point(p);
          ctx.beginPath();
          ctx.arc(x, y, 2.4, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      if (toggles.bottle && detection.bottle_bbox) {
        const [x1, y1] = point(detection.bottle_bbox);
        const [x2, y2] = point(detection.bottle_bbox.slice(2));
        ctx.strokeStyle = "#f1b643";
        ctx.lineWidth = 2;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        ctx.fillStyle = "#f1b643";
        ctx.fillRect(x1, y1 - 20, 72, 20);
        ctx.fillStyle = "#111416";
        ctx.font = "600 11px IBM Plex Mono, monospace";
        ctx.fillText("BOTTLE", x1 + 7, y1 - 6);
      }
    };

    const observer = new ResizeObserver(draw);
    observer.observe(parent);
    draw();
    return () => observer.disconnect();
  }, [detection, sourceSize, toggles]);

  return <canvas ref={canvasRef} className="video-overlay" />;
}

