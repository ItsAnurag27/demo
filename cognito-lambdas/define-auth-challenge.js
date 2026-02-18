exports.handler = async (event) => {
  // This custom auth flow issues a CUSTOM_CHALLENGE (OTP) and, when answered correctly,
  // tells Cognito to issue tokens.

  const session = event.request.session || [];

  // First request: ask for a custom challenge.
  if (session.length === 0) {
    event.response.issueTokens = false;
    event.response.failAuthentication = false;
    event.response.challengeName = "CUSTOM_CHALLENGE";
    return event;
  }

  // If the last challenge was successful, issue tokens.
  const last = session[session.length - 1];
  if (last.challengeName === "CUSTOM_CHALLENGE" && last.challengeResult === true) {
    event.response.issueTokens = true;
    event.response.failAuthentication = false;
    return event;
  }

  // Otherwise retry a few times, then fail.
  if (session.length >= 3) {
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
    return event;
  }

  event.response.issueTokens = false;
  event.response.failAuthentication = false;
  event.response.challengeName = "CUSTOM_CHALLENGE";
  return event;
};
