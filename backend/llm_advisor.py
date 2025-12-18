import os
import json
import requests
import time

# --- Configuration ---
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

# 1. FIXED URL: Using 'gemini-2.0-flash' which is in your list
# Note the specific version in your output: models/gemini-2.0-flash
API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"

def suggest_pcb_rules(parsed_data):
    if not GEMINI_API_KEY:
        print("FATAL: GEMINI_API_KEY not set.")
        return parsed_data.get("rules", {})

    nets = list(set([t.get("net") for t in parsed_data.get("tasks", []) if t.get("net")]))

    payload = {
        "system_instruction": {
            "parts": [{"text": "You are an expert PCB Design Engineer. Return ONLY valid JSON."}]
        },
        "contents": [
            {
                "parts": [{"text": f"Analyze these nets and provide routing rules: {json.dumps(nets)}"}]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }

    try:
        response = requests.post(API_URL, json=payload, timeout=30)
        
        # 2. Handle Rate Limiting (429) automatically
        if response.status_code == 429:
            print("RATE LIMIT HIT (429). Falling back to default rules to avoid server crash.")
            return parsed_data.get("rules", {})

        if response.status_code != 200:
            print(f"AI Advisor Failed (Status {response.status_code}): {response.text}")
            return parsed_data.get("rules", {})

        api_res = response.json()
        json_string = api_res['candidates'][0]['content']['parts'][0]['text']
        return json.loads(json_string)

    except Exception as e:
        print(f"AI Error: {e}")
        return parsed_data.get("rules", {})