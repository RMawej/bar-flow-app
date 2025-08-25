# -*- coding: utf-8 -*-
import csv
import json
from openai import OpenAI
import os
from dotenv import load_dotenv

CSV_IN = "events.csv"
CSV_OUT = "events_enriched.csv"

load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("API key for OpenAI not found. Please set OPENAI_API_KEY in your .env file.")

client = OpenAI(api_key=api_key)

def generate_event_from_caption(caption: str, timestamp: str) -> dict:
    """Appel API OpenAI si pas d'events OCR. Retourne un dict avec un event au bon format."""
    if not caption.strip() and not timestamp.strip():
        print("[SKIP] Caption et timestamp vides, aucun appel OpenAI")
        return {"events": []}

    # Debug
    print("\n[DEBUG] Prompt envoyé à OpenAI :")
    print(f"Caption : {caption}")
    print(f"Timestamp : {timestamp}")
    input("👉 Appuie sur [Entrée] pour lancer l'appel OpenAI...")

    prompt = f"""
    Tu es un assistant d'événements. On n'a pas réussi à extraire d'événement d'une affiche.
    Voici les infos disponibles :
    - Caption : {caption}
    - Timestamp (date de publication du post) : {timestamp}

    ⚠️ Instructions :
    1. Si la caption contient des indications relatives comme "this Saturday", "ce vendredi", "tonight", "ce soir", etc. → calcule la date réelle en fonction du timestamp du post.
    Exemple : si le post est publié un mardi 19 août et que la caption dit "this Saturday", la date correcte est le samedi 23 août suivant.
    2. Si aucune information de date n’est claire, mets "day": "Unknown" et "time": "Unknown".
    3. Les tags doivent donner une idée du **style de musique / ambiance** (ex : "house", "techno", "hip-hop", "live jazz", "EDM", "disco", "afrobeat", "pop").
    4. Si rien n’indique un style précis, utilise un tag général comme "club", "nightlife", "DJ set".

    Ne renvoie pas de texte explicatif, uniquement du JSON strict.

    Format JSON strict attendu :
    {{
    "events": [
        {{
        "day": "...",   // date au format AAAA-MM-JJ
        "time": "...",
        "artists": [{{"nom": "...", "arobase": "..."}}],
        "event_type": "...",
        "confidence": 0.0,
        "prix": "...",
        "description": "...",
        "tags": ["..."]   // tags qui reflètent le style musical
        }}
    ]
    }}
    """
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3
        )
        content = response.choices[0].message.content.strip()
        print("[DEBUG] Réponse brute OpenAI :", content)
        if not content:
            print("[OpenAI] Réponse vide ❌")
            return {"events": []}
        return json.loads(content)
    except Exception as e:
        print(f"[ERROR OpenAI] {e}")
        return {"events": []}

def process_csv():
    rows_out = []
    with open(CSV_IN, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or []
        if "ocr_events" not in fieldnames:
            fieldnames.append("ocr_events")

        for i, row in enumerate(reader, start=1):
            print(f"\n=== Traitement ligne {i} | post_id={row.get('post_id')} ===")
            try:
                events = json.loads(row["ocr_events"]) if row["ocr_events"].strip() else []
            except Exception as e:
                print("[ERROR JSON parse ocr_events]", e)
                events = []

            if not events:
                caption = row.get("caption", "")
                timestamp = row.get("timestamp", "")
                ai_events = generate_event_from_caption(caption, timestamp)
                row["ocr_events"] = json.dumps(ai_events.get("events", []), ensure_ascii=False)
            else:
                print("[INFO] OCR déjà présent, on saute.")

            rows_out.append(row)

    with open(CSV_OUT, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows_out)

if __name__ == "__main__":
    process_csv()
    print(f"\n[OK] CSV enrichi sauvegardé -> {CSV_OUT}")