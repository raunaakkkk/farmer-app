from sqlalchemy import Boolean, Column, Float, Integer, String, Text
try:
    from backend.database import Base
except ImportError:
    from database import Base


class Crop(Base):
    __tablename__ = "crops"

    id = Column(Integer, primary_key=True, index=True)
    name_en = Column(String(120), nullable=False, index=True)
    name_hi = Column(String(120), nullable=False)
    soil_type = Column(String(120), nullable=False, index=True)
    season = Column(String(120), nullable=False, index=True)
    state = Column(String(200), nullable=False, index=True)
    water_need = Column(String(80), nullable=False)
    expected_yield_qtl = Column(String(80), nullable=False)
    market_price_min = Column(Integer, nullable=False)
    market_price_max = Column(Integer, nullable=False)
    growing_days = Column(Integer, nullable=False)
    fertilizer = Column(String(200), nullable=False)
    description_hi = Column(Text, nullable=False)


class GovtScheme(Base):
    __tablename__ = "govt_schemes"

    id = Column(Integer, primary_key=True, index=True)
    name_en = Column(String(180), nullable=False, index=True)
    name_hi = Column(String(220), nullable=False)
    ministry = Column(String(160), nullable=False)
    benefit_en = Column(Text, nullable=False)
    benefit_hi = Column(Text, nullable=False)
    eligibility_en = Column(Text, nullable=False)
    eligibility_hi = Column(Text, nullable=False)
    amount = Column(String(100), nullable=False)
    frequency = Column(String(100), nullable=False)
    official_url = Column(String(260), nullable=False)
    launch_year = Column(Integer, nullable=False)
    active = Column(Boolean, default=True)


class Disease(Base):
    __tablename__ = "diseases"

    id = Column(Integer, primary_key=True, index=True)
    name_en = Column(String(150), nullable=False, index=True)
    name_hi = Column(String(150), nullable=False)
    crop_affected = Column(String(150), nullable=False)
    symptoms_en = Column(Text, nullable=False)
    symptoms_hi = Column(Text, nullable=False)
    cause = Column(String(200), nullable=False)
    organic_treatment = Column(Text, nullable=False)
    chemical_treatment = Column(Text, nullable=False)
    prevention = Column(Text, nullable=False)
    severity = Column(String(20), nullable=False, index=True)


class WeatherAdvice(Base):
    __tablename__ = "weather_advice"

    id = Column(Integer, primary_key=True, index=True)
    condition = Column(String(120), nullable=False, index=True)
    temp_min = Column(Float, nullable=False)
    temp_max = Column(Float, nullable=False)
    rain_probability_min = Column(Float, nullable=False)
    advice_en = Column(Text, nullable=False)
    advice_hi = Column(Text, nullable=False)
    crop_action = Column(Text, nullable=False)
    irrigation_advice = Column(Text, nullable=False)


class SoilProfile(Base):
    __tablename__ = "soil_profiles"

    id = Column(Integer, primary_key=True, index=True)
    soil_type = Column(String(80), nullable=False, index=True)
    state = Column(String(200), nullable=False)
    ph_range = Column(String(40), nullable=False)
    nutrients = Column(Text, nullable=False)
    suitable_crops = Column(Text, nullable=False)
    not_suitable = Column(Text, nullable=False)
    improvement_tips_hi = Column(Text, nullable=False)
