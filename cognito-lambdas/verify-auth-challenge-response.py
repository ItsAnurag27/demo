import time


def handler(event, context):
    """Cognito VerifyAuthChallengeResponse trigger.

    Validates the OTP answer and enforces expiration (15 minutes by default).
    """

    request = event.get("request", {})
    private_params = request.get("privateChallengeParameters", {}) or {}

    expected = private_params.get("answer")
    provided = request.get("challengeAnswer")

    issued_at_raw = private_params.get("issuedAt")
    ttl_ms_raw = private_params.get("ttlMs")

    def _to_int(value):
        try:
            return int(value)
        except Exception:
            return None

    issued_at = _to_int(issued_at_raw)
    ttl_ms = _to_int(ttl_ms_raw)
    now = int(time.time() * 1000)

    # Backward-compatible behavior if metadata missing.
    is_not_expired = True
    if issued_at is not None and ttl_ms is not None:
        is_not_expired = (now - issued_at) <= ttl_ms

    is_correct = (str(provided or "").strip() == str(expected or "").strip())

    event.setdefault("response", {})
    event["response"]["answerCorrect"] = bool(is_correct and is_not_expired)
    return event
