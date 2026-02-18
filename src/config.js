const truthy = new Set(["1", "true", "yes", "on"]);

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function getBoolEnv(name, defaultValue) {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  return truthy.has(String(value).trim().toLowerCase());
}

function getConfig() {
  const awsRegion = getRequiredEnv("AWS_REGION");
  const cognitoClientId = getRequiredEnv("COGNITO_CLIENT_ID");
  const cognitoClientSecret = process.env.COGNITO_CLIENT_SECRET || "";

  return {
    port: Number(process.env.PORT || 3000),
    sessionSecret: process.env.SESSION_SECRET || "dev-only-secret",
    cookieSecure: getBoolEnv("COOKIE_SECURE", false),

    awsRegion,
    cognitoClientId,
    cognitoClientSecret,
    cognitoUserPoolId: process.env.COGNITO_USER_POOL_ID || "",
    autoProvision: getBoolEnv("COGNITO_AUTO_PROVISION", false)
  };
}

module.exports = {
  getConfig
};
