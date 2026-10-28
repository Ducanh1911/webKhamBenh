from pydantic import BaseModel, Field


class TriageRequest(BaseModel):
    symptoms: str = Field(..., min_length=2, max_length=1000)
    age: int | None = Field(default=None, ge=0, le=120)
    duration_days: int | None = Field(default=None, ge=0, le=3650)


class SpecialtyOut(BaseModel):
    id: int
    name: str


class DoctorOut(BaseModel):
    id: int
    name: str


class TriageResponse(BaseModel):
    specialty: SpecialtyOut | None
    doctors: list[DoctorOut]
    priority: str  # routine | urgent | emergency
    follow_up_questions: list[str]
    reason: str
    confidence: str  # high | low
    source: str  # rules (Hướng A); llm khi có lớp LLM
    disclaimer: str
