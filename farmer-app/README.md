# Farmer Assistant Web App

Full-stack Farmer Assistant for Indian farmers with weather guidance, crop recommendation, scheme discovery, voice assistant, and disease detection.

## Project Structure

```
farmer-app/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── seed_data.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js
└── README.md
```

## Setup

1. Clone the repository:
   - `git clone <your-repo-url>`
   - `cd farmer-app`
2. Install dependencies:
   - `cd backend`
   - `pip install -r requirements.txt`
3. Create environment file:
   - `cp .env.example .env` (PowerShell: `Copy-Item .env.example .env`)
   - Fill `ANTHROPIC_API_KEY` in `.env`
4. Seed the database:
   - `cd backend`
   - `python seed_data.py`
5. Run backend server:
   - From project root: `uvicorn backend.main:app --reload`
6. Open frontend:
   - Open `frontend/index.html` in browser
7. Enable location permissions:
   - Allow geolocation in your browser for weather and farming advice.

## API Highlights

- `GET /api/weather?lat={lat}&lon={lon}`
- `POST /api/crops/recommend`
- `GET /api/schemes`
- `POST /api/schemes/check-eligibility`
- `GET /api/diseases`
- `POST /api/diseases/detect`
- `POST /api/voice/query`
- `POST /api/ai/chat`

## Notes

- Backend uses SQLite and SQLAlchemy.
- Seed script recreates and repopulates all 5 tables.
- Disease detection and AI chat use Claude API when `ANTHROPIC_API_KEY` is configured.
