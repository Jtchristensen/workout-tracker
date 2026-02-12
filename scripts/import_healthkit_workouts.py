#!/usr/bin/env python3
"""Import Apple Health (HealthKit) Workout entries into the workout-tracker API.

MVP importer (schema approach A):
- Uses existing API fields: workout_date, activity, duration_minutes, notes
- Skips non-"real" workouts by default (e.g., Walking)
- Best-effort de-dupe against existing API data so re-runs don't spam duplicates
- Streams the XML (iterparse) so large exports are OK

Usage:
  python3 scripts/import_healthkit_workouts.py --xml export.xml --api http://localhost:5000 --dry-run
  python3 scripts/import_healthkit_workouts.py --xml export.xml --api http://localhost:5000
"""

from __future__ import annotations

import argparse
import json
import sys
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Dict, Iterable, Optional, Set, Tuple
from urllib.parse import urlencode
from urllib.request import Request, urlopen


DEFAULT_EXCLUDE_TYPES = {
    "HKWorkoutActivityTypeWalking",
    "HKWorkoutActivityTypeOther",
}


def _http_json(method: str, url: str, payload: Optional[dict] = None, timeout: int = 30):
    data = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = Request(url, data=data, headers=headers, method=method.upper())
    with urlopen(req, timeout=timeout) as resp:
        body = resp.read()
        if not body:
            return None
        return json.loads(body.decode("utf-8"))


def parse_healthkit_dt(s: str) -> datetime:
    # Example: "2018-02-24 17:48:40 -0600"
    return datetime.strptime(s, "%Y-%m-%d %H:%M:%S %z")


def friendly_activity(workout_activity_type: str) -> str:
    # HKWorkoutActivityTypeTraditionalStrengthTraining -> Traditional Strength Training
    prefix = "HKWorkoutActivityType"
    raw = workout_activity_type
    if raw.startswith(prefix):
        raw = raw[len(prefix) :]

    out = []
    buf = ""
    for ch in raw:
        if ch.isupper() and buf:
            out.append(buf)
            buf = ch
        else:
            buf += ch
    if buf:
        out.append(buf)

    # fix common acronyms
    return " ".join(out)


def iter_workouts(xml_path: str) -> Iterable[dict]:
    # Streaming parse: only keep Workout elements
    for event, elem in ET.iterparse(xml_path, events=("end",)):
        if elem.tag != "Workout":
            continue

        attrib = dict(elem.attrib)
        # healthkit can include nested statistics/events; we ignore for MVP
        elem.clear()
        yield attrib


def build_existing_keyset(api_base: str) -> Set[Tuple[str, str, Optional[int]]]:
    existing = _http_json("GET", f"{api_base}/api/workouts") or []
    keys: Set[Tuple[str, str, Optional[int]]] = set()
    for w in existing:
        keys.add((w.get("workout_date"), (w.get("activity") or "").strip(), w.get("duration_minutes")))
    return keys


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--xml", required=True, help="Path to export.xml")
    ap.add_argument("--api", default="http://localhost:5000", help="API base URL")
    ap.add_argument("--dry-run", action="store_true", help="Do not POST; just print summary")
    ap.add_argument(
        "--include-type",
        action="append",
        default=[],
        help="Include only this HealthKit workoutActivityType (repeatable)",
    )
    ap.add_argument(
        "--exclude-type",
        action="append",
        default=list(DEFAULT_EXCLUDE_TYPES),
        help="Exclude this HealthKit workoutActivityType (repeatable)",
    )
    ap.add_argument("--max", type=int, default=0, help="Max workouts to import (0 = no limit)")
    args = ap.parse_args()

    include_types = set(args.include_type)
    exclude_types = set(args.exclude_type)

    # Verify API is up
    try:
        health = _http_json("GET", f"{args.api}/api/health")
        if not (isinstance(health, dict) and health.get("ok") is True):
            print(f"API health check unexpected response: {health}", file=sys.stderr)
            return 2
    except Exception as e:
        print(f"API health check failed: {e}", file=sys.stderr)
        return 2

    existing_keys = build_existing_keyset(args.api)

    seen = 0
    skipped_type = 0
    skipped_dupe = 0
    posted = 0

    for w in iter_workouts(args.xml):
        if args.max and seen >= args.max:
            break
        seen += 1

        wtype = w.get("workoutActivityType") or ""
        if include_types and wtype not in include_types:
            skipped_type += 1
            continue
        if wtype in exclude_types:
            skipped_type += 1
            continue

        start = parse_healthkit_dt(w["startDate"])
        end = parse_healthkit_dt(w["endDate"])
        workout_date = start.date().isoformat()

        activity = friendly_activity(wtype)

        duration_minutes: Optional[int] = None
        if "duration" in w:
            try:
                dur = float(w["duration"])
                unit = (w.get("durationUnit") or "min").lower()
                if unit in ("min", "mins", "minute", "minutes"):
                    duration_minutes = int(round(dur))
                elif unit in ("s", "sec", "secs", "second", "seconds"):
                    duration_minutes = int(round(dur / 60.0))
                elif unit in ("h", "hr", "hrs", "hour", "hours"):
                    duration_minutes = int(round(dur * 60.0))
                else:
                    # unknown; leave null
                    duration_minutes = None
            except Exception:
                duration_minutes = None

        key = (workout_date, activity.strip(), duration_minutes)
        if key in existing_keys:
            skipped_dupe += 1
            continue

        notes_parts = [
            f"Imported from HealthKit",
            f"Start: {start.isoformat()}",
            f"End: {end.isoformat()}",
        ]
        if w.get("sourceName"):
            notes_parts.append(f"Source: {w['sourceName']}")
        if w.get("totalDistance") and w.get("totalDistanceUnit"):
            notes_parts.append(f"Distance: {w['totalDistance']} {w['totalDistanceUnit']}")
        if w.get("totalEnergyBurned") and w.get("totalEnergyBurnedUnit"):
            notes_parts.append(f"Energy: {w['totalEnergyBurned']} {w['totalEnergyBurnedUnit']}")

        payload = {
            "workout_date": workout_date,
            "activity": activity,
            "duration_minutes": duration_minutes,
            "notes": "\n".join(notes_parts),
        }

        if args.dry_run:
            posted += 1
            # keep it terse
            if posted <= 10:
                print(f"WOULD IMPORT: {payload['workout_date']} | {payload['activity']} | {payload['duration_minutes']} min")
        else:
            try:
                _http_json("POST", f"{args.api}/api/workouts", payload)
            except Exception as e:
                print(f"POST failed for {key}: {e}", file=sys.stderr)
                return 3
            posted += 1
            existing_keys.add(key)

    print(
        json.dumps(
            {
                "workout_tags_seen": seen,
                "skipped_type": skipped_type,
                "skipped_dupe": skipped_dupe,
                "imported": posted,
                "dry_run": bool(args.dry_run),
            },
            indent=2,
        )
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
