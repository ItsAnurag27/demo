# Cognito Email OTP Auth (Node.js + Docker)

This is a minimal authentication-only web page:

1) Enter email
2) Receive OTP by email
3) Enter OTP
4) Login success

It uses **Amazon Cognito User Pool Custom Auth** (`CUSTOM_AUTH` + `CUSTOM_CHALLENGE`). Cognito does **not** provide “passwordless email OTP” out of the box, so the OTP is generated/sent by Cognito **Lambda triggers**.

## What’s in this repo

- `public/` – single page UI (email → OTP → success)
- `src/server.js` – Express server + session + Cognito calls
- `cognito-lambdas/` – sample Lambda trigger handlers required for Custom Auth OTP
- `Dockerfile`, `docker-compose.yml` – containerized run

## Prerequisites

- AWS account
- SES configured to send email from your account
  - Verify a sender address in SES (and if your SES is in sandbox, verify recipient addresses too)
- A Cognito User Pool
- AWS credentials available to the Node app (local: env vars; Docker: env vars or IAM role)

## 1) Create Cognito User Pool

In AWS Console → Cognito → **User pools** → Create user pool:

- **Sign-in options**: Email
- Make sure the pool has the `email` attribute

## 2) Create the App Client

User pool → **App integration** → App clients → Create an app client:

- **Do not** generate a client secret (this sample uses a browser-based flow + server calls)
- **Authentication flows**: enable **Custom authentication flow**
  - The flow must allow `CUSTOM_AUTH`

Copy the **App client id**.

## 3) Create and attach the 3 Lambda triggers (required)

User pool → **User pool properties** → **Lambda triggers**:

Attach these triggers:

- **Define auth challenge** → use `cognito-lambdas/define-auth-challenge.py`
- **Create auth challenge** → use `cognito-lambdas/create-auth-challenge.py`
- **Verify auth challenge response** → use `cognito-lambdas/verify-auth-challenge-response.py`

### Option: use ONE Lambda instead of three

Cognito requires the **three trigger slots**, but they can all point to the **same Lambda function**.

If you want to deploy only one Lambda, use:

- `cognito-lambdas/custom-auth-combined.py`

Then attach that same Lambda ARN to:

- Define auth challenge
- Create auth challenge
- Verify auth challenge response

Note: if you use the combined Lambda, it must have the union of permissions/env vars (SES send + `FROM_EMAIL`, etc.).

### CreateAuthChallenge Lambda environment

Set environment variables on the **CreateAuthChallenge** Lambda:

- `AWS_REGION` – same region as your user pool
- `FROM_EMAIL` – a verified SES sender email

### Lambda permissions (CreateAuthChallenge)

The CreateAuthChallenge function must be allowed to send email via SES.

Add IAM permission (example):

- `ses:SendEmail`
- `ses:SendRawEmail`

## 4) Users: pick one of these approaches

Cognito custom auth still requires that the user exists in the pool.

### Option A (simple + manual): create a user in the pool

Create a user with username = email, and ensure:

- user is **CONFIRMED**
- `email_verified` is `true`

You can do this in the console, or with AWS CLI.

### Option B (no manual user creation): enable auto-provisioning

This app can auto-create a user the first time someone requests an OTP.

1) Set `COGNITO_AUTO_PROVISION=true`
2) Set `COGNITO_USER_POOL_ID=...`
3) Ensure the Node app’s AWS principal has these permissions:

- `cognito-idp:AdminGetUser`
- `cognito-idp:AdminCreateUser`
- `cognito-idp:AdminSetUserPassword`

## 5) Configure this web app

Copy `.env.example` to `.env` and fill in values:

- `AWS_REGION`
- `COGNITO_CLIENT_ID`
- `COGNITO_USER_POOL_ID` (required only if auto-provision is enabled)
- `SESSION_SECRET`

## Run locally (Node)

```bash
npm install
npm start
```

Open:

- http://localhost:3000

## Run with Docker

```bash
docker compose up --build
```

Open:

- http://localhost:3000

## Notes / troubleshooting

- If OTP emails don’t arrive, check:
  - SES sender verification and SES sandbox restrictions
  - CloudWatch logs for the CreateAuthChallenge Lambda
- OTP expiry: the sample lambdas enforce a 15-minute expiration window.
- If Cognito errors on `/api/auth/start`, verify:
  - App client has Custom Auth enabled
  - The 3 Lambda triggers are attached to the user pool
- If you see `NotAuthorizedException: ... SECRET_HASH was not received`:
  - Either create an App Client **without** a client secret, OR
  - Set `COGNITO_CLIENT_SECRET` in your `.env` (this app will send `SECRET_HASH` automatically)
- This sample stores Cognito session/tokens in an in-memory Express session (fine for demos). For production you’d use a persistent session store and `COOKIE_SECURE=true` behind HTTPS.
