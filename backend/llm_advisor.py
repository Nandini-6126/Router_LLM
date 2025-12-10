import os
import json
import requests
import traceback

# --- Configuration (Read API Key from environment) ---
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY") # Reads the key set in your terminal
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"


SYSTEM_PROMPT = """
You are an expert PCB Design Engineer. Your job is to analyze a list of electrical nets 
from a KiCad project and generate optimal routing rules (JSON).

1. Identify POWER nets (VCC, GND, +5V, +12V, VBAT) -> Suggest thicker traces (0.4mm - 0.8mm).
2. Identify DATA/SIGNAL nets (SPI, I2C, UART, GPIO) -> Standard traces (0.2mm - 0.25mm).
3. Identify SENSITIVE/SWITCHING nets (SW, FB, COMP) -> Specific constraints if needed.
4. Set global design rules appropriate for the board density.

You MUST return a JSON object matching this EXACT schema:
{
    "grid_step": 0.1,
    "clearance": 0.2,
    "trace_width": 0.2,
    "via_size": 0.6,
    "via_drill": 0.3,
    "via_cost": 20,
    "board_clearance": 0.4,
    "via_clearance_extra": 0.1,
    "pad_clearance_extra": 0.1,
    "pad_opener_safety": 0.05,
    "trace_clearance_extra": 0.1,
    "default_netclass": "Default",
    "netclasses": {
      "Default": { "trace_width": 0.2, "clearance": 0.2, "via_size": 0.6, "via_drill": 0.3, "via_cost": 10, "min_via_from_pads": 0.2 },
      "POWER": { "trace_width": 0.4, "clearance": 0.25, "via_size": 0.8, "via_drill": 0.4, "via_cost": 10, "min_via_from_pads": 0.2 },
      "SWITCH": { "trace_width": 0.25, "clearance": 0.2, "via_size": 0.6, "via_drill": 0.3, "via_cost": 10, "min_via_from_pads": 0.2 },
      "FEEDBACK": { "trace_width": 0.2, "clearance": 0.2, "via_cost": 10, "min_via_from_pads": 0.2 }
    },
    "net_to_class": {} 
}
Populate "net_to_class" by mapping every net name provided to one of the keys in "netclasses" (e.g., "VCC"->"POWER").
"""

def suggest_pcb_rules(parsed_data):
    # Fallback to parser defaults if the API key is missing
    if not GEMINI_API_KEY:
        print("FATAL: GEMINI_API_KEY not set. Using parser's default rules.")
        return parsed_data.get("rules", {})

    # Extract net names
    nets = list(parsed_data.get("rules", {}).get("net_to_class", {}).keys())
    if not nets:
        nets = list(set([t.get("net") for t in parsed_data.get("tasks", []) if t.get("net")]))

    user_message = f"""
    Here are the nets in my PCB project:
    {json.dumps(nets)}

    Please generate the routing rules and map these nets to the appropriate classes.
    """
    
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
    }
    
    # Corrected payload structure for direct HTTP call
    payload = {
        "contents": [
            {"role": "user", "parts": [{"text": user_message}]},
        ],
        "config": {
            "systemInstruction": SYSTEM_PROMPT,
            "responseMimeType": "application/json"
        }
    }

    try:
        response = requests.post(GEMINI_API_URL, headers=headers, data=json.dumps(payload))
        response.raise_for_status() # Raise exception for 4xx or 5xx errors

        api_response_json = response.json()
        
        # Extract the JSON string from the response
        json_string = api_response_json['candidates'][0]['content']['parts'][0]['text']
        
        return json.loads(json_string)

    except requests.exceptions.RequestException as e:
        print(f"API Request Failed: {e}")
        return parsed_data.get("rules", {})
    except Exception as e:
        print(f"Failed to parse API response: {e}")
        return parsed_data.get("rules", {})