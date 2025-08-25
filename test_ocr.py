#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import requests
import base64
import json
import shutil
from openai import OpenAI

import csv

import os
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("API key for OpenAI not found. Please set OPENAI_API_KEY in your .env file.")

client = OpenAI(api_key=api_key)
IMG_PATH = "affiche.jpg"

def ocr_from_url(path_or_url: str, caption: str = "") -> dict:
    """Accepte soit une URL HTTP(S), soit un chemin local d'image"""
    if path_or_url.startswith("http://") or path_or_url.startswith("https://"):
        # Télécharger depuis internet
        r = requests.get(path_or_url, timeout=20)
        with open(IMG_PATH, "wb") as f:
            f.write(r.content)
    else:
        # Déjà un fichier local → copie directe
        shutil.copy(path_or_url, IMG_PATH)

    # 2. Encoder en Base64
    with open(IMG_PATH, "rb") as f:
        b64_img = base64.b64encode(f.read()).decode("utf-8")

    # 3. Prompt
    prompt = f"""
        Tu es un OCR intelligent pour affiches d’événements.
        Lis cette image et produis un JSON structuré enrichi.
        Renvoie UNIQUEMENT un JSON valide (sans ```).

        Caption associée au post : "{caption}"

        Format attendu :
        {{
        "events": [
            {{
            "day": "...",
            "time": "...",
            "artists": [{{"nom": "...", "arobase": "..."}}],
            "event_type": "...",
            "confidence": ...,
            "prix": "...",
            "description": "...",
            "tags": ["..."]
            }}
        ],
        "errors": []
        }}

        - Corrige les erreurs typiques d’OCR.
        - Normalise les horaires au format "19:00" ou "22:00-06:00".
        - Déduis event_type (jazz, concert, DJ set…).
        - Ajoute une estimation confidence entre 0 et 1.
        - Dans "errors", liste les incohérences détectées.
        """
    print(f"Prompt envoyé à OpenAI : {prompt}")

    # 4. Appel OpenAI
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_img}"}}
            ]
        }]
    )

    # 5. Retour JSON
    try:
        return json.loads(resp.choices[0].message.content)
    except json.JSONDecodeError:
        return {
            "error": "Invalid JSON response",
            "raw": resp.choices[0].message.content
        }