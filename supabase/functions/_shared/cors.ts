export const getCorsHeaders = (req: Request) => {
  const allowedOriginsStr = Deno.env.get('ALLOWED_ORIGINS') || 'http://localhost:5173'
  const allowedOrigins = allowedOriginsStr.split(',').map(o => o.trim())
  const requestOrigin = req.headers.get('Origin')

  let origin = allowedOrigins[0]
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    origin = requestOrigin
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin'
  }
}
