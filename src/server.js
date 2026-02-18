require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");

const { getConfig } = require("./config");
const {
  createCognitoClient,
  ensureUserExists,
  startCustomAuth,
  respondToCustomChallenge
} = require("./cognito");
const { decodeJwtPayload } = require("./jwt");

const config = getConfig();
const cognito = createCognitoClient({ region: config.awsRegion });

const app = express();

app.disable("x-powered-by");
app.use(express.json());
app.use(
  session({
    name: "sid",
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: config.cookieSecure,
      maxAge: 60 * 60 * 1000
    }
  })
);

app.use(express.static(path.join(__dirname, "..", "public")));

function describeError(err) {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;

  const name = err.name || "Error";
  const code = err.code ? ` (${err.code})` : "";
  const message = err.message || "";

  // AWS SDK v3 timeouts can show up as AggregateError without a helpful message.
  if (!message && Array.isArray(err.errors) && err.errors.length > 0) {
    const first = err.errors.find(Boolean);
    if (first && (first.message || first.code)) {
      return `${name}${code}: ${first.message || first.code}`;
    }
  }

  if (message) return `${name}${code}: ${message}`;
  return `${name}${code}`;
}

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/auth/status", (req, res) => {
  const idToken = req.session.idToken;
  res.json({
    loggedIn: Boolean(idToken),
    user: idToken ? decodeJwtPayload(idToken) : null
  });
});

app.post("/api/auth/start", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!isValidEmail(email)) {
      return res.status(400).json({ ok: false, message: "Enter a valid email." });
    }

    if (config.autoProvision) {
      await ensureUserExists({ client: cognito, userPoolId: config.cognitoUserPoolId, email });
    }

    const response = await startCustomAuth({
      client: cognito,
      clientId: config.cognitoClientId,
      clientSecret: config.cognitoClientSecret,
      email
    });

    if (!response.Session) {
      return res.status(500).json({ ok: false, message: "Cognito did not return a session." });
    }

    req.session.authEmail = email;
    req.session.cognitoSession = response.Session;
    req.session.idToken = null;
    req.session.accessToken = null;
    req.session.refreshToken = null;

    res.json({ ok: true, step: "OTP" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: describeError(err) });
  }
});

app.post("/api/auth/verify", async (req, res) => {
  try {
    const code = String(req.body?.code || "").trim();
    const email = req.session.authEmail;
    const cognitoSession = req.session.cognitoSession;

    if (!email || !cognitoSession) {
      return res.status(400).json({ ok: false, message: "Start login first." });
    }

    if (!/^\d{4,8}$/.test(code)) {
      return res.status(400).json({ ok: false, message: "Enter the OTP code." });
    }

    const response = await respondToCustomChallenge({
      client: cognito,
      clientId: config.cognitoClientId,
      clientSecret: config.cognitoClientSecret,
      email,
      session: cognitoSession,
      answer: code
    });

    if (response.AuthenticationResult) {
      const { IdToken, AccessToken, RefreshToken } = response.AuthenticationResult;

      req.session.idToken = IdToken || null;
      req.session.accessToken = AccessToken || null;
      req.session.refreshToken = RefreshToken || null;
      req.session.cognitoSession = null;

      return res.json({
        ok: true,
        step: "SUCCESS",
        user: decodeJwtPayload(IdToken)
      });
    }

    // Wrong code typically leads to another CUSTOM_CHALLENGE with a new Session.
    if (response.Session) {
      req.session.cognitoSession = response.Session;
    }

    res.status(401).json({ ok: false, step: "OTP", message: "Invalid OTP." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: describeError(err) });
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(config.port, () => {
  console.log(`Listening on http://localhost:${config.port}`);
});
