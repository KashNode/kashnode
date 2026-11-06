// Keep the marketing site at its fixed desktop layout viewport on phones,
// while signed-in/application routes use the device viewport. This runs from
// the bundled first-party entrypoint, so it complies with script-src 'self'.
const path = window.location.pathname
const isAppRoute =
  path === '/login' ||
  path === '/signup' ||
  path === '/admin' ||
  path === '/onboarding' ||
  path === '/dashboard' ||
  path.startsWith('/login/') ||
  path.startsWith('/signup/') ||
  path.startsWith('/admin/') ||
  path.startsWith('/onboarding/') ||
  path.startsWith('/dashboard/')

if (isAppRoute) {
  document
    .querySelector('meta[name="viewport"]')
    ?.setAttribute('content', 'width=device-width, initial-scale=1.0')
}
