function decodeJwtPayload(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;

  const payload = parts[1];
  const padded = payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, "=");
  const json = Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  return JSON.parse(json);
}

module.exports = {
  decodeJwtPayload
};
