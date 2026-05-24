export function resolveUser(passcode, usersJson) {
  if (!passcode) return null;
  const map = JSON.parse(usersJson);
  for (const [user, pin] of Object.entries(map)) {
    if (pin === passcode) return user;
  }
  return null;
}
