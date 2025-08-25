#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scrape Instagram public pages with apify/instagram-scraper and export results.
- Requires: APIFY_TOKEN in env, Python 3.8+, `requests`
- Usage examples:
  python3 ig_scrape.py --username assa.club --limit 50
  python3 ig_scrape.py --url https://www.instagram.com/assa.club/ --since 2025-08-01
"""

import os
import json
import csv
import argparse
from datetime import datetime, timezone
import requests
from typing import List, Dict, Any, Optional

from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv



API_BASE = "https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items"

def run_apify(
    token: str,
    direct_urls: Optional[List[str]] = None,
    search: Optional[str] = None,
    search_type: str = "users",
    results_limit: int = 5,
    since: Optional[str] = None,
    include_comments: bool = False,
) -> List[Dict[str, Any]]:
    """Call Apify Instagram Scraper and return dataset items."""
    params = {"token": token, "format": "json"}
    url = API_BASE + "?" + "&".join([f"{k}={v}" for k, v in params.items()])
    payload: Dict[str, Any] = {
        "resultsLimit": results_limit,
        "addOwnerInfo": True,
        "includeComments": include_comments,
        "proxyConfig": {"useApifyProxy": True},
    }
    if direct_urls:
        payload["directUrls"] = direct_urls
    if search:
        payload["search"] = search
        payload["searchType"] = search_type
        payload["searchLimit"] = 10
    if since:
        # ISO 8601 at midnight UTC
        dt = datetime.fromisoformat(since).replace(tzinfo=timezone.utc)
        payload["scrapePostsUntilDate"] = dt.isoformat()

    resp = requests.post(url, json=payload, timeout=120)
    resp.raise_for_status()
    try:
        items = resp.json()
        if not isinstance(items, list):
            raise ValueError("Unexpected response format (not a list).")
        return items
    except Exception as e:
        raise RuntimeError(f"Invalid JSON from Apify: {e}\nRaw: {resp.text[:500]}")

def to_event_item(post: Dict[str, Any]) -> Dict[str, Any]:
    """
    Map a raw Instagram post to a simple 'event-like' structure.
    Heuristics: first line of caption as title; keep timestamp UTC.
    """
    caption = (post.get("caption") or "").strip()
    title = caption.splitlines()[0][:120] if caption else f"Post {post.get('shortCode','')}"
    ts = post.get("timestamp")
    dt_iso = None
    if ts:
        try:
            dt_iso = datetime.fromtimestamp(int(ts), tz=timezone.utc).isoformat()
        except Exception:
            dt_iso = None

    return {
        "id": post.get("shortCode") or post.get("id") or "",
        "name": title,
        "url": f"https://www.instagram.com/p/{post.get('shortCode')}/" if post.get("shortCode") else post.get("url"),
        "image_url": post.get("imageUrl") or (post.get("images") or [None])[0],
        "video_url": post.get("videoUrl"),
        "owner_username": post.get("ownerUsername"),
        "owner_full_name": post.get("ownerFullName"),
        "timestamp_utc": dt_iso,
        "caption": caption,
        "like_count": post.get("likesCount"),
        "comments_count": post.get("commentsCount"),
        "raw_location": (post.get("location") or {}).get("name"),
    }

def save_json(path: str, data: Any) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def save_csv(path: str, rows: List[Dict[str, Any]]) -> None:
    if not rows:
        with open(path, "w", newline="", encoding="utf-8") as f:
            f.write("")  # empty file
        return
    fieldnames = list(rows[0].keys())
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow(r)

def main():
    parser = argparse.ArgumentParser(description="Scrape Instagram with Apify")
    g = parser.add_mutually_exclusive_group(required=True)
    g.add_argument("--username", nargs="+", help="One or more Instagram usernames (public)")
    g.add_argument("--url", nargs="+", help="One or more direct Instagram profile URLs")

    parser.add_argument("--limit", type=int, default=10, help="Max posts (default: 50)")
    parser.add_argument("--since", help="Only posts since YYYY-MM-DD (UTC)")
    parser.add_argument("--out", default="out_instagram", help="Output prefix (default: out_instagram)")
    parser.add_argument("--include-comments", action="store_true", help="Include comments (slower)")
    args = parser.parse_args()

    token = os.getenv("APIFY_TOKEN")
    if not token:
        raise SystemExit("ERROR: Set APIFY_TOKEN in your environment.")

    direct_urls = []
    if args.username:
        direct_urls = [f"https://www.instagram.com/{u.strip('/')}/" for u in args.username]
        print(f"Using username(s): {', '.join(direct_urls)}")
    elif args.url:
        direct_urls = [args.url]

    if args.since is None:
        since = (datetime.now(timezone.utc).date() - timedelta(days=7)).isoformat()
    else:
        since = args.since



    items = run_apify(
        token=token,
        direct_urls=direct_urls,
        search=None,
        results_limit=args.limit,
        since=since,
        include_comments=args.include_comments,
    )

    # Save raw posts
    raw_path = f"{args.out}.posts.json"
    save_json(raw_path, items)

    # Transform to event-like rows
    events = [p for p in items]
    # Print each event one by one
    for i, ev in enumerate(events, 1):
        print(f"\nPost {i}:")
        for k, v in ev.items():
            print(f"  {k}: {v}")
        
    # events_json_path = f"{args.out}.events.json"
    # events_csv_path = f"{args.out}.events.csv"
    # save_json(events_json_path, events)
    # save_csv(events_csv_path, events)

    print(json.dumps({
        "profile": direct_urls[0] if direct_urls else None,
        "count_raw_posts": len(items),
        "count_events": len(events),
        "outputs": {
            "raw_posts_json": raw_path,
            # "events_json": events_json_path,
            # "events_csv": events_csv_path
        }
    }, ensure_ascii=False, indent=2))

def fetch_instagram_posts(usernames, limit=5, since=None, include_comments=False):
    load_dotenv()
    token = os.getenv("APIFY_TOKEN")
    if not token:
        raise RuntimeError("APIFY_TOKEN not set")

    direct_urls = [f"https://www.instagram.com/{u.strip('/')}/" for u in usernames]
    items = run_apify(
        token=token,
        direct_urls=direct_urls,
        results_limit=limit,
        since=since,
        include_comments=include_comments,
    )
    return items


if __name__ == "__main__":
    main()
