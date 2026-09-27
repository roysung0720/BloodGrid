// Smooth, continuous marker motion. Positions arrive a few times a second (simulation
// ticks or GPS fixes); a Glide eases from where the marker is drawn now to the newest
// position over the time since the previous update, sampled on every animation frame.
// Display only: it never changes the simulated or reported position.

export type GlideSample = { longitude: number; latitude: number; heading: number | null };

const MIN_GLIDE_MS = 80;
const MAX_GLIDE_MS = 1500;
// Bigger jumps (a new leg starting elsewhere, a reset) snap instead of sliding across the map.
const SNAP_METERS = 3000;

function approxMeters(a: GlideSample, b: GlideSample) {
  const latScale = 111_320;
  const lngScale = 111_320 * Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot((b.latitude - a.latitude) * latScale, (b.longitude - a.longitude) * lngScale);
}

/** Interpolate angles in degrees along the shorter way round. */
export function lerpAngle(from: number, to: number, t: number) {
  const delta = ((((to - from) % 360) + 540) % 360) - 180;
  return (from + delta * t + 360) % 360;
}

export class Glide {
  private from: GlideSample | null = null;
  private to: GlideSample | null = null;
  private current: GlideSample | null = null;
  private start = 0;
  private duration = MIN_GLIDE_MS;
  private lastTargetAt = 0;

  setTarget(target: GlideSample, now = performance.now()) {
    const next = { ...target, heading: target.heading ?? this.current?.heading ?? null };
    if (!this.current || approxMeters(this.current, next) > SNAP_METERS) {
      this.from = next;
      this.to = next;
      this.current = next;
      this.start = now;
      this.duration = 1;
      this.lastTargetAt = now;
      return;
    }
    this.from = this.current;
    this.to = next;
    this.start = now;
    // Take as long as the gap between updates, so motion is continuous and never stalls.
    this.duration = Math.min(MAX_GLIDE_MS, Math.max(MIN_GLIDE_MS, now - this.lastTargetAt));
    this.lastTargetAt = now;
  }

  sample(now = performance.now()): GlideSample | null {
    if (!this.from || !this.to) {
      return null;
    }
    const t = Math.min(1, Math.max(0, (now - this.start) / this.duration));
    const fromHeading = this.from.heading ?? this.to.heading;
    const toHeading = this.to.heading ?? this.from.heading;
    this.current = {
      longitude: this.from.longitude + (this.to.longitude - this.from.longitude) * t,
      latitude: this.from.latitude + (this.to.latitude - this.from.latitude) * t,
      heading:
        fromHeading === null || toHeading === null ? null : lerpAngle(fromHeading, toHeading, t),
    };
    return this.current;
  }
}
