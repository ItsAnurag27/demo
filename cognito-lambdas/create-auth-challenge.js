const AWS = require("aws-sdk");

const ses = new AWS.SES({ region: process.env.AWS_REGION });

const OTP_TTL_MS = 15 * 60 * 1000; // 15 minutes

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

exports.handler = async (event) => {
  if (event.request.challengeName !== "CUSTOM_CHALLENGE") {
    return event;
  }

  const email = event.userName; // we use email as username
  const otp = generateOtp();
  const issuedAt = Date.now();

  // Send the OTP via SES.
  // You must verify FROM_EMAIL in SES and (if in sandbox) also verify the recipient.
  const from = process.env.FROM_EMAIL;
  if (!from) {
    throw new Error("Missing FROM_EMAIL env var on CreateAuthChallenge Lambda");
  }

  await ses
    .sendEmail({
      Source: from,
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: { Data: "Your login code" },
        Body: {
          Text: { Data: `Your OTP code is: ${otp}` }
        }
      }
    })
    .promise();

  // Cognito will store this and later pass it to VerifyAuthChallengeResponse.
  event.response.publicChallengeParameters = { email };
  event.response.privateChallengeParameters = {
    answer: otp,
    issuedAt: String(issuedAt),
    ttlMs: String(OTP_TTL_MS)
  };
  event.response.challengeMetadata = `EMAIL_OTP_${issuedAt}`;

  return event;
};
