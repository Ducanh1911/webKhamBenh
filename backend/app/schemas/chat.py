from typing import Literal

from pydantic import BaseModel, Field, model_validator


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=1000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1, max_length=10)

    @model_validator(mode="after")
    def last_message_must_be_user(self):
        if self.messages and self.messages[-1].role != "user":
            raise ValueError("Tin nhắn cuối cùng phải là của người dùng.")
        return self


class ChatDoctorOut(BaseModel):
    id: int
    name: str
    consultation_fee: int


class ChatSpecialtyOut(BaseModel):
    id: int
    name: str


class ChatResponse(BaseModel):
    reply: str
    specialty: ChatSpecialtyOut | None
    doctors: list[ChatDoctorOut]
    priority: str  # routine | urgent | emergency
    disclaimer: str
