import json
import os
from typing import Any

import httpx
from anthropic import Anthropic
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import and_
from sqlalchemy.orm import Session

try:
    from backend.database import Base, engine, get_db
    from backend.models import Crop, Disease, GovtScheme, WeatherAdvice
except ImportError:
    from database import Base, engine, get_db
    from models import Crop, Disease, GovtScheme, WeatherAdvice

load_dotenv()
Base.metadata.create_all(bind=engine)

OPEN_METEO_BASE_URL = os.getenv("OPEN_METEO_BASE_URL", "https://api.open-meteo.com/v1")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
FRONTEND_ORIGINS = os.getenv("FRONTEND_ORIGINS", "*")
anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None

app = FastAPI(title="Farmer Assistant API", version="1.0.0")

if FRONTEND_ORIGINS.strip() == "*":
    cors_origins = ["*"]
else:
    cors_origins = [origin.strip() for origin in FRONTEND_ORIGINS.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


class CropRecommendationRequest(BaseModel):
    soil_type: str
    season: str
    state: str


class EligibilityRequest(BaseModel):
    land_hectares: float
    annual_income: float
    has_bank_account: bool
    state: str


class VoiceQueryRequest(BaseModel):
    text: str
    language: str = "hi"


class AIChatRequest(BaseModel):
    message: str
    language: str = "hi"
    context: str = ""


def to_dict(row):
    return {c.name: getattr(row, c.name) for c in row.__table__.columns}


def classify_weather(temp: float, rain_prob: float, humidity: float, wind: float) -> str:
    if temp >= 40 and rain_prob < 10:
        return "Hot Dry"
    if rain_prob >= 70:
        return "Heavy Rain Alert"
    if temp <= 5:
        return "Frost Alert"
    if humidity >= 80 and temp >= 24:
        return "Humid Risk"
    if wind >= 30:
        return "High Wind"
    if rain_prob <= 5 and temp >= 30:
        return "Drought Signal"
    if 20 <= temp <= 28 and 20 <= rain_prob <= 40:
        return "Optimal Growth"
    if temp < 15:
        return "Cool Pleasant"
    return "Warm Cloudy"


def safe_json_load(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.replace("```json", "").replace("```", "").strip()
    return json.loads(cleaned)


def call_claude(system_prompt: str, user_prompt: str) -> str:
    if not anthropic_client:
        return "Claude API key not configured. Showing fallback response."
    msg = anthropic_client.messages.create(
        model="claude-3-5-sonnet-latest",
        max_tokens=800,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    return msg.content[0].text if msg.content else ""


@app.get("/api/weather")
async def get_weather(lat: float, lon: float, db: Session = Depends(get_db)):
    try:
        params = {
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,precipitation,windspeed_10m,relative_humidity_2m",
            "daily": "precipitation_probability_max,temperature_2m_max,temperature_2m_min",
            "timezone": "Asia/Kolkata",
            "forecast_days": 3,
        }
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(f"{OPEN_METEO_BASE_URL}/forecast", params=params)
            if response.status_code == 429:
                weather_payload = {
                    "current": {"temperature_2m": 32, "relative_humidity_2m": 45, "windspeed_10m": 12},
                    "daily": {
                        "time": ["Today", "Tomorrow", "Day 3"],
                        "precipitation_probability_max": [0, 10, 20],
                        "temperature_2m_max": [35, 34, 33],
                        "temperature_2m_min": [22, 23, 21]
                    }
                }
            else:
                response.raise_for_status()
                weather_payload = response.json()

        current = weather_payload.get("current", {})
        daily = weather_payload.get("daily", {})
        temp = float(current.get("temperature_2m", 0))
        humidity = float(current.get("relative_humidity_2m", 0))
        wind = float(current.get("windspeed_10m", 0))
        rain_prob = float((daily.get("precipitation_probability_max") or [0])[0] or 0)
        condition = classify_weather(temp, rain_prob, humidity, wind)

        advice = db.query(WeatherAdvice).filter(WeatherAdvice.condition == condition).first()
        if not advice:
            advice = db.query(WeatherAdvice).filter(WeatherAdvice.condition == "Optimal Growth").first()

        status = "good" if condition in {"Optimal Growth", "Cool Pleasant"} else ("warning" if condition in {"Heavy Rain Alert", "Frost Alert", "Drought Signal"} else "caution")
        return {
            "weather": weather_payload,
            "condition": condition,
            "status": status,
            "advice": {
                "advice_en": advice.advice_en if advice else "",
                "advice_hi": advice.advice_hi if advice else "",
                "crop_action": advice.crop_action if advice else "",
                "irrigation_advice": advice.irrigation_advice if advice else "",
            },
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Weather fetch failed: {exc}")


@app.post("/api/crops/recommend")
def recommend_crops(payload: CropRecommendationRequest, db: Session = Depends(get_db)):
    try:
        filters = and_(
            Crop.soil_type.ilike(f"%{payload.soil_type}%"),
            Crop.season.ilike(f"%{payload.season}%"),
            Crop.state.ilike(f"%{payload.state}%"),
        )
        crops = db.query(Crop).filter(filters).all()
        if not crops:
            crops = db.query(Crop).filter(Crop.soil_type.ilike(f"%{payload.soil_type}%")).limit(5).all()
        return {"count": len(crops[:5]), "results": [to_dict(c) for c in crops[:5]]}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Crop recommendation failed: {exc}")


@app.get("/api/schemes")
def get_schemes(db: Session = Depends(get_db)):
    try:
        rows = db.query(GovtScheme).filter(GovtScheme.active == True).all()  # noqa: E712
        return {"count": len(rows), "results": [to_dict(r) for r in rows]}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to fetch schemes: {exc}")


@app.post("/api/schemes/check-eligibility")
def check_eligibility(payload: EligibilityRequest, db: Session = Depends(get_db)):
    try:
        schemes = db.query(GovtScheme).filter(GovtScheme.active == True).all()  # noqa: E712
        eligible = []
        for scheme in schemes:
            reasons = []
            is_eligible = True
            lower = scheme.name_en.lower()

            if "pm-kisan" in lower:
                if payload.land_hectares <= 2:
                    reasons.append("Land is within 2 hectare bracket.")
                else:
                    is_eligible = False
                    reasons.append("PM-KISAN prefers small and marginal farmers.")
            if "kisan credit card" in lower and not payload.has_bank_account:
                is_eligible = False
                reasons.append("Bank account is required for KCC.")
            if "kusum" in lower and payload.annual_income > 1000000:
                reasons.append("High income may reduce subsidy priority in some states.")
            if "insurance" in lower or "bima" in lower:
                reasons.append("Crop insurance generally open to all registered farmers.")

            if is_eligible:
                eligible.append(
                    {
                        "scheme": scheme.name_en,
                        "scheme_hi": scheme.name_hi,
                        "reason_en": " | ".join(reasons) if reasons else "Meets general eligibility conditions.",
                        "reason_hi": "प्राथमिक शर्तें पूरी होती हैं।",
                    }
                )
        return {"count": len(eligible), "eligible_schemes": eligible}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Eligibility check failed: {exc}")


@app.get("/api/diseases")
def get_diseases(db: Session = Depends(get_db)):
    try:
        data = db.query(Disease).all()
        return {"count": len(data), "results": [to_dict(d) for d in data]}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to fetch diseases: {exc}")


@app.post("/api/diseases/detect")
async def detect_disease(image: UploadFile = File(...)):
    try:
        content = await image.read()
        if not content:
            raise HTTPException(status_code=400, detail="Empty image file.")
        if not anthropic_client:
            return {
                "disease_name_en": "Unknown (API key missing)",
                "disease_name_hi": "अज्ञात (API key उपलब्ध नहीं)",
                "confidence": 0,
                "affected_crop": "Unknown",
                "symptoms": "Please configure ANTHROPIC_API_KEY for vision detection.",
                "organic_treatment": "Use neem-based broad preventive spray.",
                "chemical_treatment": "Consult local agri officer before chemical use.",
                "prevention": "Use healthy seed and keep field sanitation.",
            }

        prompt = (
            "You are an agricultural disease detection expert. "
            "Analyze this plant/leaf image and identify: "
            "1. Disease name in English and Hindi "
            "2. Confidence percentage "
            "3. Affected crop "
            "4. Symptoms observed "
            "5. Organic treatment "
            "6. Chemical treatment "
            "7. Prevention tips "
            "Respond ONLY in JSON format."
        )

        import base64
        base64_image = base64.b64encode(content).decode("utf-8")

        msg = anthropic_client.messages.create(
            model="claude-3-5-sonnet-latest",
            max_tokens=900,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": image.content_type or "image/jpeg",
                                "data": base64_image,
                            },
                        },
                    ],
                }
            ],
        )
        raw = msg.content[0].text if msg.content else "{}"
        parsed = safe_json_load(raw)
        return parsed
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Disease detection failed: {exc}")


@app.post("/api/voice/query")
def voice_query(payload: VoiceQueryRequest, db: Session = Depends(get_db)):
    try:
        text = payload.text.lower()
        intent = "general"
        if any(k in text for k in ["mausam", "barish", "temperature", "garmi", "मौसम", "बारिश"]):
            intent = "weather"
        elif any(k in text for k in ["fasal", "crop", "ugana", "kaunsi", "फसल", "उगाऊ"]):
            intent = "crop"
        elif any(k in text for k in ["yojana", "scheme", "paisa", "subsidy", "योजना", "सब्सिडी"]):
            intent = "scheme"
        elif any(k in text for k in ["bimari", "disease", "patta", "leaf", "बीमारी", "पत्ता"]):
            intent = "disease"

        if intent == "scheme":
            schemes = db.query(GovtScheme).filter(GovtScheme.active == True).limit(3).all()  # noqa: E712
            names = ", ".join([s.name_hi if payload.language == "hi" else s.name_en for s in schemes])
            short = f"मुख्य योजनाएं: {names}" if payload.language == "hi" else f"Top schemes: {names}"
            return {"intent": intent, "response_text": short, "audio_friendly_text": short}

        if intent == "disease":
            msg = "पत्ती पर दाग या पीला पन हो तो फोटो अपलोड करके जांच करें।" if payload.language == "hi" else "If leaves show spots or yellowing, upload an image for diagnosis."
            return {"intent": intent, "response_text": msg, "audio_friendly_text": msg}

        if intent == "crop":
            msg = "मिट्टी, मौसम और राज्य बताएं, मैं उपयुक्त फसल सुझाऊंगा।" if payload.language == "hi" else "Share soil, season, and state to get crop recommendations."
            return {"intent": intent, "response_text": msg, "audio_friendly_text": msg}

        if intent == "weather":
            msg = "अपने स्थान की अनुमति दें, मैं मौसम और खेती सलाह दिखाऊंगा।" if payload.language == "hi" else "Allow location and I will show weather with farming advice."
            return {"intent": intent, "response_text": msg, "audio_friendly_text": msg}

        system = "You are a helpful farming assistant for Indian farmers. Keep answers practical."
        user = f"Language: {payload.language}. Farmer asked: {payload.text}"
        answer = call_claude(system, user)
        short = answer[:180]
        return {"intent": intent, "response_text": answer, "audio_friendly_text": short}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Voice query failed: {exc}")


@app.post("/api/ai/chat")
def ai_chat(payload: AIChatRequest):
    try:
        system_prompt = (
            "You are a helpful farming assistant for Indian farmers. "
            f"Respond in {payload.language}. Keep answers simple and practical. "
            "Use farming terminology familiar to Indian farmers."
        )
        user_prompt = f"Context: {payload.context}\nQuestion: {payload.message}"
        answer = call_claude(system_prompt, user_prompt)
        return {"response": answer}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI chat failed: {exc}")
