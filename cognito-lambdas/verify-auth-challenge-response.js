exports.handler = async (event) => {
  const expected = event.request.privateChallengeParameters.answer;
  const provided = event.request.challengeAnswer;

  event.response.answerCorrect = String(provided || "").trim() === String(expected || "").trim();
  return event;
};
