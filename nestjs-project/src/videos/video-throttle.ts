export function videoUserTracker(request: Record<string, unknown>): string {
  const user = request.user;
  if (
    typeof user === 'object' &&
    user !== null &&
    'sub' in user &&
    typeof user.sub === 'string'
  ) {
    return `video-user:${user.sub}`;
  }
  return typeof request.ip === 'string' ? request.ip : 'anonymous';
}
