import os
import random
import time

import boto3

OTP_TTL_MS = 15 * 60 * 1000  # 15 minutes


def _generate_otp():
    return f"{random.randint(100000, 999999)}"


def _define_auth_challenge(event):
    session = event.get("request", {}).get("session") or []

    event.setdefault("response", {})

    # First request: ask for a custom challenge.
    if len(session) == 0:
        event["response"]["issueTokens"] = False
        event["response"]["failAuthentication"] = False
        event["response"]["challengeName"] = "CUSTOM_CHALLENGE"
        return event

    # If the last challenge was successful, issue tokens.
    last = session[-1]
    if last.get("challengeName") == "CUSTOM_CHALLENGE" and last.get("challengeResult") is True:
        event["response"]["issueTokens"] = True
        event["response"]["failAuthentication"] = False
        return event

    # Otherwise retry a few times, then fail.
    if len(session) >= 3:
        event["response"]["issueTokens"] = False
        event["response"]["failAuthentication"] = True
        return event

    event["response"]["issueTokens"] = False
    event["response"]["failAuthentication"] = False
    event["response"]["challengeName"] = "CUSTOM_CHALLENGE"
    return event


def _create_auth_challenge(event):
    if event.get("request", {}).get("challengeName") != "CUSTOM_CHALLENGE":
        return event

    email = event.get("userName")  # we use email as username
    otp = _generate_otp()
    issued_at = int(time.time() * 1000)

    region = os.environ.get("AWS_REGION")
    from_email = os.environ.get("FROM_EMAIL")

    if not region:
        raise Exception("Missing AWS_REGION env var on CreateAuthChallenge Lambda")
    if not from_email:
        raise Exception("Missing FROM_EMAIL env var on CreateAuthChallenge Lambda")

    ses = boto3.client("ses", region_name=region)
    ses.send_email(
        Source=from_email,
        Destination={"ToAddresses": [email]},
        Message={
            "Subject": {"Data": "Your login code"},
            "Body": {"Text": {"Data": f"Your OTP code is: {otp}"}},
        },
    )

    event.setdefault("response", {})
    event["response"]["publicChallengeParameters"] = {"email": email}
    event["response"]["privateChallengeParameters"] = {
        "answer": otp,
        "issuedAt": str(issued_at),
        "ttlMs": str(OTP_TTL_MS),
    }
    event["response"]["challengeMetadata"] = f"EMAIL_OTP_{issued_at}"

    return event


def _verify_auth_challenge_response(event):
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


def handler(event, context):
    """Single Lambda that can be attached to all three Cognito Custom Auth triggers.

    Attach this same Lambda ARN to:
    - Define auth challenge
    - Create auth challenge
    - Verify auth challenge response

    Cognito will set event['triggerSource'] to one of:
    - DefineAuthChallenge_Authentication
    - CreateAuthChallenge_Authentication
    - VerifyAuthChallengeResponse_Authentication
    """

    trigger_source = event.get("triggerSource", "")

    if trigger_source.startswith("DefineAuthChallenge"):
        return _define_auth_challenge(event)

    if trigger_source.startswith("CreateAuthChallenge"):
        return _create_auth_challenge(event)

    if trigger_source.startswith("VerifyAuthChallengeResponse"):
        return _verify_auth_challenge_response(event)

    # If a new/unexpected trigger source hits this handler, just return event.
    return event
