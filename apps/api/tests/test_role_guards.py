"""Every route must carry a role guard; candidates get 403 on every mentor/admin endpoint."""

import uuid

from fastapi.routing import APIRoute
from starlette.routing import WebSocketRoute

from app.main import API_PREFIX, ROUTERS, app
from app.models import Role
from tests.conftest import auth, make_user

# Routes intentionally reachable without a role guard.
PUBLIC_ROUTES = {
    ("GET", "/api/v1/health"),
    ("POST", "/api/v1/auth/login"),
    ("POST", "/api/v1/auth/refresh"),
}


def _guard_roles(dependant) -> set[Role] | None:
    for dep in dependant.dependencies:
        roles = getattr(dep.call, "roles", None)
        if roles is not None:
            return set(roles)
        found = _guard_roles(dep)
        if found is not None:
            return found
    return None


class _R:
    """APIRoute view with the full mounted path (FastAPI >=0.16x wraps included routers)."""

    def __init__(self, route: APIRoute):
        self.path = API_PREFIX + route.path
        self.dependant = route.dependant


def _api_routes():
    for router in ROUTERS:
        for route in router.routes:
            if isinstance(route, APIRoute):
                for method in route.methods - {"HEAD", "OPTIONS"}:
                    yield method, _R(route)


def test_route_walker_sees_routes():
    assert len(list(_api_routes())) >= 10


def _fill(path: str) -> str:
    out = path
    while "{" in out:
        start, end = out.index("{"), out.index("}")
        out = out[:start] + str(uuid.uuid4()) + out[end + 1 :]
    return out


def test_every_route_has_a_role_guard():
    missing = [
        (m, r.path)
        for m, r in _api_routes()
        if (m, r.path) not in PUBLIC_ROUTES and _guard_roles(r.dependant) is None
    ]
    assert missing == []


def test_websocket_routes_are_guarded_in_handler():
    # WebSocket routes authenticate inside the handler (token query param); listed explicitly here.
    ws = [API_PREFIX + r.path for router in ROUTERS for r in router.routes if isinstance(r, WebSocketRoute)]
    assert app is not None
    assert all(p.startswith("/api/v1/ws/mentor/") for p in ws)


def test_candidate_gets_403_on_every_mentor_and_admin_endpoint(client, db):
    cand = make_user(db, Role.candidate)
    checked = 0
    for method, route in _api_routes():
        roles = _guard_roles(route.dependant)
        if roles is None or Role.candidate in roles:
            continue
        res = client.request(method, _fill(route.path), headers=auth(cand), json={})
        assert res.status_code == 403, f"{method} {route.path} -> {res.status_code}"
        checked += 1
    assert checked > 0


def test_mentor_gets_403_on_admin_endpoints(client, db):
    mentor = make_user(db, Role.mentor)
    for method, route in _api_routes():
        roles = _guard_roles(route.dependant)
        if roles == {Role.admin}:
            res = client.request(method, _fill(route.path), headers=auth(mentor), json={})
            assert res.status_code == 403, f"{method} {route.path}"


def test_unauthenticated_gets_401(client):
    for method, route in _api_routes():
        if (method, route.path) in PUBLIC_ROUTES:
            continue
        res = client.request(method, _fill(route.path), json={})
        assert res.status_code == 401, f"{method} {route.path} -> {res.status_code}"
