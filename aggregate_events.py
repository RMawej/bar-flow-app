# -*- coding: utf-8 -*-
"""
Agrégation Instagram + OCR Events + CSV + Sauvegarde images
"""
import json
import requests
import cv2
import csv
import os
import numpy as np
import tempfile
from datetime import datetime
from urllib.parse import urlparse
from test_posts_fetch import fetch_instagram_posts
from test_ocr import ocr_from_url

CSV_FILE = "events.csv"
IMG_DIR = "images"

os.makedirs(IMG_DIR, exist_ok=True)

def slugify(value: str) -> str:
    return "".join(c if c.isalnum() else "_" for c in value).strip("_").lower()

def download_last_frame(video_url: str, owner: str, timestamp: str) -> str:
    """Télécharge la dernière frame d'une vidéo et la sauvegarde en image locale"""
    r = requests.get(video_url, timeout=30, stream=True)
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmpfile:
        for chunk in r.iter_content(chunk_size=8192):
            tmpfile.write(chunk)
        video_path = tmpfile.name

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    target_frame = max(0, total_frames - int(fps)*2)  # 1 seconde avant la fin
    cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
    ret, frame = cap.read()
    cap.release()

    if not ret:
        return None

    # Nom du fichier : bar_slug + timestamp
    bar_slug = slugify(owner)
    ts = datetime.fromisoformat(timestamp.replace("Z", "+00:00")).strftime("%Y%m%d_%H%M%S")
    img_path = os.path.join(IMG_DIR, f"{bar_slug}_{ts}.jpg")

    cv2.imwrite(img_path, frame)
    return img_path

def download_image(img_url: str, owner: str, timestamp: str) -> str:
    """Télécharge une image et la sauvegarde localement"""
    r = requests.get(img_url, timeout=30, stream=True)
    if r.status_code != 200:
        return None

    bar_slug = slugify(owner)
    ts = datetime.fromisoformat(timestamp.replace("Z", "+00:00")).strftime("%Y%m%d_%H%M%S")
    img_path = os.path.join(IMG_DIR, f"{bar_slug}_{ts}.jpg")

    with open(img_path, "wb") as f:
        for chunk in r.iter_content(chunk_size=8192):
            f.write(chunk)

    return img_path

def save_to_csv(records, filename=CSV_FILE):
    """Enregistre les résultats dans un CSV en évitant les doublons (via post_id)."""
    existing_ids = set()

    if os.path.exists(filename):
        with open(filename, "r", newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                existing_ids.add(row["post_id"])

    with open(filename, "a", newline="", encoding="utf-8") as f:
        fieldnames = ["post_id", "post_url", "owner", "caption", "timestamp", "media_url", "image_local_path", "ocr_events"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)

        if os.path.getsize(filename) == 0:
            writer.writeheader()

        for rec in records:
            if rec["post_id"] not in existing_ids:
                writer.writerow({
                    "post_id": rec["post_id"],
                    "post_url": rec["post_url"],
                    "owner": rec["owner"],
                    "caption": rec["caption"],
                    "timestamp": rec["timestamp"],
                    "media_url": rec["media_url"],
                    "image_local_path": rec.get("image_local_path", ""),
                    "ocr_events": json.dumps(rec["ocr_result"].get("events", []), ensure_ascii=False)
                })

def aggregate_bar_events(usernames, limit=5):
    posts = fetch_instagram_posts(usernames, limit=limit)
    aggregated = []

    for post in posts:
        img_url = post.get("displayUrl") or post.get("imageUrl")
        ocr_result = None
        local_path = None

        if post.get("type") == "Video" and post.get("videoUrl"):
            local_path = download_last_frame(post["videoUrl"], post.get("ownerUsername"), post.get("timestamp"))
            if local_path:
                ocr_result = ocr_from_url(local_path, post.get("caption", ""))
        elif img_url:
            local_path = download_image(img_url, post.get("ownerUsername"), post.get("timestamp"))
            if local_path:
                ocr_result = ocr_from_url(local_path, post.get("caption", ""))


        aggregated.append({
            "post_id": post.get("id"),
            "post_type": post.get("type"),
            "post_url": post.get("url"),
            "caption": post.get("caption"),
            "timestamp": post.get("timestamp"),
            "media_url": img_url or post.get("videoUrl"),
            "owner": post.get("ownerUsername"),
            "raw_post": post,
            "image_local_path": local_path,
            "ocr_result": ocr_result or {}
        })

    return aggregated

if __name__ == "__main__":
    bars = ["vinodiscobar"]
    results = aggregate_bar_events(bars, limit=5)

    save_to_csv(results)

    print(json.dumps({
        "bars": bars,
        "count": len(results),
        "results": results
    }, indent=2, ensure_ascii=False))

    # Appeler enrich_events.py après l'agrégation
    import enrich_events
    enrich_events.process_csv()

