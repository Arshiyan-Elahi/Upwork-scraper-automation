from pydantic import BaseModel, Field


class ProposalRulesRead(BaseModel):
    text: str


class ProposalRulesUpdate(BaseModel):
    text: str = Field(..., description="Proposal voice rules as plain text")


class LlmProviderStatus(BaseModel):
    configured: bool
    last4: str | None = None


class LlmSettingsRead(BaseModel):
    providers: dict[str, LlmProviderStatus]
    generation_provider: str


class LlmKeySaveRequest(BaseModel):
    provider: str
    api_key: str = Field(..., min_length=1)


class LlmKeySaveResponse(BaseModel):
    provider: str
    last4: str
    configured: bool = True


class LlmProviderUpdateRequest(BaseModel):
    provider: str
