import pytest

pytestmark = pytest.mark.django_db


def test_health_is_public(anon_client):
    res = anon_client.get("/api/v1/health/")
    assert res.status_code == 200 and res.data["status"] == "ok"
    assert res["X-Request-ID"]


def test_request_id_is_echoed(anon_client):
    res = anon_client.get("/api/v1/health/", HTTP_X_REQUEST_ID="abcdef12-3456")
    assert res["X-Request-ID"] == "abcdef12-3456"


def test_readiness_reports_dependencies(anon_client):
    res = anon_client.get("/api/v1/health/ready/")
    assert res.status_code == 200, res.data
    assert res.data["checks"]["database"]["detail"].startswith("pgvector")
    assert res.data["checks"]["ai"]["ok"]


def test_readiness_degraded_when_ai_down(anon_client, settings):
    settings.AI_LLM_PROVIDER = "apps.ai.providers.ollama.OllamaProvider"
    settings.OLLAMA_BASE_URL = "http://127.0.0.1:9"
    res = anon_client.get("/api/v1/health/ready/")
    assert res.status_code == 503
    assert res.data["status"] == "degraded"
    assert not res.data["checks"]["ai"]["ok"]


def test_admin_analytics_requires_staff(client, user):
    assert client.get("/api/v1/admin/analytics/").status_code == 403
    user.is_staff = True
    user.save()
    res = client.get("/api/v1/admin/analytics/")
    assert res.status_code == 200
    assert res.data["totals"]["users"] >= 1
    assert "feature_usage" in res.data and "health" in res.data


def test_openapi_schema_and_docs(anon_client):
    schema = anon_client.get("/api/schema/")
    assert schema.status_code == 200
    body = schema.content.decode()
    for path in (
        "/api/v1/conversations/{id}/stream/",
        "/api/v1/knowledge-bases/{kb_id}/documents/",
        "/api/v1/study/quiz/",
    ):
        assert path in body
    assert anon_client.get("/api/docs/").status_code == 200


def test_consistent_error_envelope(client):
    res = client.get("/api/v1/knowledge-bases/999999/")
    assert res.status_code == 404
    assert set(res.data["error"]) == {"code", "message", "details", "request_id"}
