export function getPermadeathProximityMessage(overkillDamage: number, threshold: number): string {
  if (threshold === 0) {
    return 'The threshold was not set.';
  }
  if (overkillDamage === 0) {
    return 'The blow that killed you was clean — no risk of permanent death.';
  }
  const percentOfThreshold = (overkillDamage / threshold) * 100;
  if (percentOfThreshold < 50) {
    return 'A stronger blow could have ended you for good.';
  }
  return 'That was dangerously close to permanent death.';
}
