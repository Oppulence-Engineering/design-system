/**
 * Snapping (§7) — pure geometry. Given a moving rect and candidate rects (sibling /
 * artboard bounds), find the smallest adjustment on each axis that aligns an edge or
 * center within `threshold` canvas units, and return the guide lines to draw.
 */

import {
  rectCenter,
  rectRight,
  rectBottom,
  type Rect,
} from "../viewport/geometry";
import type { SnapGuide } from "../store/session-store";

export interface SnapResult {
  dx: number;
  dy: number;
  guides: SnapGuide[];
}

interface Candidate {
  value: number; // the target coordinate on this axis
  edgeStart: number; // extent on the OTHER axis for drawing the guide
  edgeEnd: number;
}

function verticalLines(rect: Rect): number[] {
  return [rect.x, rectCenter(rect).x, rectRight(rect)];
}
function horizontalLines(rect: Rect): number[] {
  return [rect.y, rectCenter(rect).y, rectBottom(rect)];
}

export function snapRect(
  moving: Rect,
  candidates: readonly Rect[],
  threshold: number,
): SnapResult {
  const movingV = verticalLines(moving);
  const movingH = horizontalLines(moving);

  let bestDx = 0;
  let bestDxDist = threshold + 1;
  let bestH: Candidate | null = null;

  let bestDy = 0;
  let bestDyDist = threshold + 1;
  let bestV: Candidate | null = null;

  for (const cand of candidates) {
    // Vertical alignment (x): compare moving vertical lines against candidate vertical lines.
    for (const cv of verticalLines(cand)) {
      for (const mv of movingV) {
        const dist = Math.abs(cv - mv);
        if (dist < bestDxDist) {
          bestDxDist = dist;
          bestDx = cv - mv;
          bestH = {
            value: cv,
            edgeStart: Math.min(moving.y, cand.y),
            edgeEnd: Math.max(rectBottom(moving), rectBottom(cand)),
          };
        }
      }
    }
    // Horizontal alignment (y).
    for (const ch of horizontalLines(cand)) {
      for (const mh of movingH) {
        const dist = Math.abs(ch - mh);
        if (dist < bestDyDist) {
          bestDyDist = dist;
          bestDy = ch - mh;
          bestV = {
            value: ch,
            edgeStart: Math.min(moving.x, cand.x),
            edgeEnd: Math.max(rectRight(moving), rectRight(cand)),
          };
        }
      }
    }
  }

  const guides: SnapGuide[] = [];
  if (bestH !== null && bestDxDist <= threshold) {
    guides.push({
      orientation: "vertical",
      position: bestH.value,
      start: bestH.edgeStart,
      end: bestH.edgeEnd,
    });
  } else {
    bestDx = 0;
  }
  if (bestV !== null && bestDyDist <= threshold) {
    guides.push({
      orientation: "horizontal",
      position: bestV.value,
      start: bestV.edgeStart,
      end: bestV.edgeEnd,
    });
  } else {
    bestDy = 0;
  }

  return { dx: bestDx, dy: bestDy, guides };
}
