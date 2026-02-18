def handler(event, context):
    """Cognito DefineAuthChallenge trigger.

    Implements a Custom Auth flow that issues a CUSTOM_CHALLENGE (OTP) and
    issues tokens when the challenge is answered correctly.
    """

    session = event.get("request", {}).get("session") or []

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
