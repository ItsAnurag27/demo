exports.handler = async (event) => {
  const expected = event.request.privateChallengeParameters.answer;
  const provided = event.request.challengeAnswer;

  const issuedAtRaw = event.request.privateChallengeParameters.issuedAt;
  const ttlMsRaw = event.request.privateChallengeParameters.ttlMs;

  const issuedAt = Number(issuedAtRaw);
  const ttlMs = Number(ttlMsRaw);
  const now = Date.now();

  const isNotExpired = Number.isFinite(issuedAt) && Number.isFinite(ttlMs)
    ? now - issuedAt <= ttlMs
    : true; // backward-compatible if metadata missing

  const isCorrect = String(provided || "").trim() === String(expected || "").trim();
  event.response.answerCorrect = Boolean(isCorrect && isNotExpired);
  return event;
};
