export function GET() {
  return Response.json({
    user: null,
    session: null,
    organization: null,
    membership: null,
    organizations: [],
  });
}
