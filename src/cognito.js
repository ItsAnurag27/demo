const crypto = require("crypto");
const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  AdminGetUserCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand
} = require("@aws-sdk/client-cognito-identity-provider");

function randomPassword() {
  return crypto.randomBytes(32).toString("base64url") + "Aa1!";
}

function createCognitoClient({ region }) {
  return new CognitoIdentityProviderClient({ region });
}

function computeSecretHash({ clientId, clientSecret, username }) {
  if (!clientSecret) return "";
  return crypto
    .createHmac("sha256", clientSecret)
    .update(String(username) + String(clientId))
    .digest("base64");
}

async function ensureUserExists({ client, userPoolId, email }) {
  if (!userPoolId) {
    throw new Error("COGNITO_USER_POOL_ID is required when COGNITO_AUTO_PROVISION=true");
  }

  try {
    await client.send(new AdminGetUserCommand({ UserPoolId: userPoolId, Username: email }));
    return;
  } catch (err) {
    if (err && (err.name === "UserNotFoundException" || err.__type === "UserNotFoundException")) {
      // continue
    } else {
      throw err;
    }
  }

  await client.send(
    new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: email,
      MessageAction: "SUPPRESS",
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "email_verified", Value: "true" }
      ]
    })
  );

  await client.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: email,
      Password: randomPassword(),
      Permanent: true
    })
  );
}

async function startCustomAuth({ client, clientId, clientSecret, email }) {
  const secretHash = computeSecretHash({ clientId, clientSecret, username: email });
  return client.send(
    new InitiateAuthCommand({
      AuthFlow: "CUSTOM_AUTH",
      ClientId: clientId,
      AuthParameters: {
        USERNAME: email,
        ...(secretHash ? { SECRET_HASH: secretHash } : {})
      }
    })
  );
}

async function respondToCustomChallenge({ client, clientId, clientSecret, email, session, answer }) {
  const secretHash = computeSecretHash({ clientId, clientSecret, username: email });
  return client.send(
    new RespondToAuthChallengeCommand({
      ClientId: clientId,
      ChallengeName: "CUSTOM_CHALLENGE",
      Session: session,
      ChallengeResponses: {
        USERNAME: email,
        ANSWER: String(answer),
        ...(secretHash ? { SECRET_HASH: secretHash } : {})
      }
    })
  );
}

module.exports = {
  createCognitoClient,
  ensureUserExists,
  startCustomAuth,
  respondToCustomChallenge
};
