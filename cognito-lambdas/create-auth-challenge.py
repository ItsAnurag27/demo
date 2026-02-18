import os
import random
import time

import boto3

OTP_TTL_MS = 15 * 60 * 1000  # 15 minutes


def _generate_otp():
    return f"{random.randint(100000, 999999)}"


def handler(event, context):
    """Cognito CreateAuthChallenge trigger.

    Generates an OTP and sends it via SES.

    Required environment variables on this Lambda:
    - AWS_REGION
    - FROM_EMAIL (must be verified in SES)

    IAM permissions needed:
    - ses:SendEmail (and/or ses:SendRawEmail)
    """

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

    # Cognito will store these and later pass them to VerifyAuthChallengeResponse.
    event.setdefault("response", {})
    event["response"]["publicChallengeParameters"] = {"email": email}
    event["response"]["privateChallengeParameters"] = {
        "answer": otp,
        "issuedAt": str(issued_at),
        "ttlMs": str(OTP_TTL_MS),
    }
    event["response"]["challengeMetadata"] = f"EMAIL_OTP_{issued_at}"

    return event
