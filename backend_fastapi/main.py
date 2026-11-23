from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="ProductPulse AI Companion API", version="2.0.0")


class RiceInput(BaseModel):
    reach: int = Field(ge=0)
    impact: float = Field(ge=0.25, le=3.0)
    confidence: int = Field(ge=1, le=100)
    effort: float = Field(gt=0)


@app.get("/api/health")
def health() -> dict[str, str | bool]:
    return {"ok": True, "service": "ProductPulse AI (FastAPI Companion)"}


@app.post("/api/rice/calculate")
def compute_rice(payload: RiceInput) -> dict[str, float]:
    score = (payload.reach * payload.impact * (payload.confidence / 100.0)) / payload.effort
    return {"riceScore": round(score, 2)}
