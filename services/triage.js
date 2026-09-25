function getTriageStatus(intensity, redFlags = []) {
  if (Array.isArray(redFlags) && redFlags.length > 0) return 'urgent';
  if (Number.isFinite(Number(intensity)) && Number(intensity) >= 8) return 'high_reported_intensity';
  return 'routine';
}
module.exports = { getTriageStatus };
