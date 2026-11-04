const CUSTOM_DOMAIN_ORIGINS = [
  'https://kashnode.com',
  'https://www.kashnode.com',
];

export function normalizeOrigin(value) {
  if (typeof value !== 'string' || !value.trim()) return null;

  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function createAllowedOrigins(env = process.env) {
  const configuredOrigins = [
    env.FRONTEND_ORIGIN,
    env.CORS_ALLOWED_ORIGINS,
    env.RENDER_EXTERNAL_URL,
  ].flatMap(value => String(value || '').split(','));

  const developmentOrigins = env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:5173', 'http://127.0.0.1:5173'];

  return new Set(
    [...CUSTOM_DOMAIN_ORIGINS, ...configuredOrigins, ...developmentOrigins]
      .map(normalizeOrigin)
      .filter(Boolean),
  );
}

export function isAllowedOrigin(origin, allowedOrigins, { allowMissing = false } = {}) {
  if (!origin) return allowMissing;
  const normalized = normalizeOrigin(origin);
  return Boolean(normalized && allowedOrigins instanceof Set && allowedOrigins.has(normalized));
}
