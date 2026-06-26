from fastapi import APIRouter, Depends, HTTPException, Request

from app.intelligence.proposal_rules import (
    extract_rules_text_from_bytes,
    get_proposal_voice_rules_for_api,
    save_proposal_voice_rules,
    validate_rules_upload_filename,
)
from app.llm.credentials import (
    delete_provider_key,
    get_generation_provider,
    get_provider_status,
    provider_has_key,
    save_provider_key,
    set_generation_provider,
)
from app.llm.providers import SUPPORTED_LLM_PROVIDERS, normalize_provider
from app.schemas_settings import (
    LlmKeySaveRequest,
    LlmKeySaveResponse,
    LlmProviderStatus,
    LlmProviderUpdateRequest,
    LlmSettingsRead,
    ProposalRulesRead,
)
from app.security.encryption import EncryptionKeyMissingError
from app.security.scoping import UserScope, get_scope

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/proposal-rules", response_model=ProposalRulesRead)
def get_proposal_rules(scope: UserScope = Depends(get_scope)) -> ProposalRulesRead:
    return ProposalRulesRead(text=get_proposal_voice_rules_for_api(scope.session, scope.user_id))


@router.put("/proposal-rules", response_model=ProposalRulesRead)
async def update_proposal_rules(
    request: Request,
    scope: UserScope = Depends(get_scope),
) -> ProposalRulesRead:
    """
    Save proposal voice rules from typed text (JSON body) or an uploaded file.

    Supported uploads: .md, .txt, .skills (plain text), .pdf (text extraction).
    Images are rejected.
    """
    content_type = request.headers.get("content-type", "")

    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        upload = form.get("file")
        if upload is None or not getattr(upload, "filename", None):
            raise HTTPException(status_code=400, detail="Missing file upload.")

        filename = upload.filename
        try:
            validate_rules_upload_filename(filename)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        data = await upload.read()
        if not data:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        try:
            text = extract_rules_text_from_bytes(data, filename)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        saved = save_proposal_voice_rules(scope.session, scope.user_id, text)
        return ProposalRulesRead(text=saved)

    if content_type.startswith("application/json"):
        try:
            payload = await request.json()
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Invalid JSON body.") from exc

        if not isinstance(payload, dict) or "text" not in payload:
            raise HTTPException(status_code=400, detail='JSON body must include "text".')

        text = payload.get("text")
        if text is not None and not isinstance(text, str):
            raise HTTPException(status_code=400, detail='"text" must be a string.')

        saved = save_proposal_voice_rules(scope.session, scope.user_id, text or "")
        return ProposalRulesRead(text=saved)

    raise HTTPException(
        status_code=415,
        detail='Use application/json {"text":"..."} or multipart/form-data with a file field.',
    )


@router.get("/llm", response_model=LlmSettingsRead)
def get_llm_settings(scope: UserScope = Depends(get_scope)) -> LlmSettingsRead:
    """Return configured LLM providers (masked) and the active generation provider."""
    status = get_provider_status(scope.session, scope.user_id)
    providers = {
        provider: LlmProviderStatus(**status[provider])
        for provider in SUPPORTED_LLM_PROVIDERS
    }
    return LlmSettingsRead(
        providers=providers,
        generation_provider=get_generation_provider(scope.session, scope.user_id),
    )


@router.put("/llm-keys", response_model=LlmKeySaveResponse)
def save_llm_key(
    body: LlmKeySaveRequest, scope: UserScope = Depends(get_scope)
) -> LlmKeySaveResponse:
    """Encrypt and store a provider API key. Never returns the full key."""
    try:
        provider = normalize_provider(body.provider)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    api_key = body.api_key.strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="api_key must not be empty.")

    try:
        row = save_provider_key(scope.session, scope.user_id, provider, api_key)
    except EncryptionKeyMissingError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return LlmKeySaveResponse(provider=row.provider, last4=row.last4, configured=True)


@router.delete("/llm-keys/{provider}")
def delete_llm_key(provider: str, scope: UserScope = Depends(get_scope)) -> dict[str, object]:
    """Remove a stored provider API key."""
    try:
        normalized = normalize_provider(provider)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        removed = delete_provider_key(scope.session, scope.user_id, normalized)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not removed:
        raise HTTPException(status_code=404, detail=f"No stored key for provider {normalized!r}.")
    return {"provider": normalized, "removed": True}


@router.put("/llm-provider", response_model=LlmSettingsRead)
def update_llm_provider(
    body: LlmProviderUpdateRequest,
    scope: UserScope = Depends(get_scope),
) -> LlmSettingsRead:
    """Set the active text-generation provider (must have a configured key)."""
    try:
        provider = normalize_provider(body.provider)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not provider_has_key(scope.session, scope.user_id, provider):
        raise HTTPException(
            status_code=400,
            detail=f"No API key configured for provider {provider!r}.",
        )

    try:
        set_generation_provider(scope.session, scope.user_id, provider)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    status = get_provider_status(scope.session, scope.user_id)
    providers = {
        name: LlmProviderStatus(**status[name])
        for name in SUPPORTED_LLM_PROVIDERS
    }
    return LlmSettingsRead(
        providers=providers,
        generation_provider=get_generation_provider(scope.session, scope.user_id),
    )
