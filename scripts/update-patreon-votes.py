#!/usr/bin/env python3
"""Materialize public Patreon feature-vote totals from GA4 Data API events."""

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


FEATURE_IDS = (
    "math-performance-tracking",
    "math-master-path",
    "podcast-member-alpha",
)
API_URL_TEMPLATE = "https://analyticsdata.googleapis.com/v1beta/properties/{property_id}:runReport"


def parse_arguments():
    parser = argparse.ArgumentParser(
        description="Fetch GA4 feature-vote events and write public vote totals.",
    )
    parser.add_argument(
        "--property-id",
        default=os.environ.get("GA4_PROPERTY_ID"),
        help="GA4 numeric property ID (or set GA4_PROPERTY_ID).",
    )
    parser.add_argument(
        "--access-token",
        default=os.environ.get("GA4_ACCESS_TOKEN"),
        help="Short-lived Google OAuth access token (or set GA4_ACCESS_TOKEN).",
    )
    parser.add_argument(
        "--start-date",
        default=os.environ.get("GA4_VOTE_START_DATE", "2026-10-17"),
        help="GA4 report start date in YYYY-MM-DD format.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("patreon/votes.json"),
        help="Public totals JSON file to update.",
    )
    return parser.parse_args()


def fetch_rows(property_id, access_token, start_date):
    report = {
        "dateRanges": [{"startDate": start_date, "endDate": "today"}],
        "dimensions": [
            {"name": "customEvent:feature_id"},
            {"name": "customEvent:vote_direction"},
        ],
        "metrics": [{"name": "customEvent:vote_weight"}],
        "dimensionFilter": {
            "filter": {
                "fieldName": "eventName",
                "stringFilter": {
                    "matchType": "EXACT",
                    "value": "patreon_feature_vote",
                },
            },
        },
    }
    request = Request(
        API_URL_TEMPLATE.format(property_id=property_id),
        data=json.dumps(report).encode(),
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=30) as response:
            return json.load(response).get("rows", [])
    except HTTPError as error:
        raise RuntimeError(
            f"GA4 Data API request failed with HTTP {error.code}. "
            "Confirm the property ID, OAuth token, and registered event-scoped custom dimensions.",
        ) from error
    except URLError as error:
        raise RuntimeError(f"GA4 Data API request failed: {error.reason}") from error


def create_totals(rows):
    totals = {feature_id: {"up": 0, "down": 0} for feature_id in FEATURE_IDS}

    for row in rows:
        dimensions = row.get("dimensionValues", [])
        metrics = row.get("metricValues", [])
        if len(dimensions) != 2 or len(metrics) != 1:
            continue

        feature_id = dimensions[0].get("value")
        direction = dimensions[1].get("value")
        if feature_id not in totals or direction not in ("up", "down"):
            continue

        totals[feature_id][direction] += int(float(metrics[0].get("value", "0")))

    return totals


def write_totals(output, totals):
    payload = {
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "source": "ga4-weighted-vote-total",
        "features": totals,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary_output = output.with_suffix(f"{output.suffix}.tmp")
    temporary_output.write_text(f"{json.dumps(payload, indent=2)}\n")
    temporary_output.replace(output)


def main():
    arguments = parse_arguments()
    if not arguments.property_id or not arguments.access_token:
        raise SystemExit(
            "GA4_PROPERTY_ID and GA4_ACCESS_TOKEN are required. "
            "Use a short-lived OAuth token with GA4 Data API read access.",
        )

    rows = fetch_rows(arguments.property_id, arguments.access_token, arguments.start_date)
    write_totals(arguments.output, create_totals(rows))
    print(f"Updated {arguments.output} from {len(rows)} GA4 report rows.")


if __name__ == "__main__":
    main()
