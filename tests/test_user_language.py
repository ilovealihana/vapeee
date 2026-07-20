from datetime import datetime, timezone
import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from db.models.user import User
import webapp.deps as deps
from webapp.errors import register_error_handlers
from webapp.routes import user as user_routes
from webapp.schemas import SetLanguageRequest, UserSchema


class UserLanguageSchemaTest(unittest.TestCase):
    def test_user_schema_exposes_language_code_from_existing_language_column(self):
        user = User(
            id=1,
            tg_id=123,
            username="tester",
            first_name="Tester",
            last_name=None,
            language="en",
            phone=None,
            email=None,
            created_at=datetime.now(timezone.utc),
        )

        schema = UserSchema.model_validate(user)

        self.assertEqual(schema.language_code, "en")
        self.assertNotIn("language", schema.model_dump())

    def test_language_request_accepts_future_supported_codes(self):
        for code in ("ru", "en", "pl", "uk"):
            self.assertEqual(SetLanguageRequest(language_code=code).language_code, code)

    def test_language_request_accepts_legacy_language_alias(self):
        self.assertEqual(SetLanguageRequest(language="en").language_code, "en")

    def test_language_request_rejects_unknown_code(self):
        with self.assertRaises(ValidationError):
            SetLanguageRequest(language_code="de")


class UserLanguageRouteTest(unittest.TestCase):
    def setUp(self):
        self.original_verify_init_data = deps.verify_init_data
        self.original_deps_user_repository = deps.UserRepository
        self.original_user_repository = user_routes.UserRepository
        self.user = User(
            id=1,
            tg_id=123,
            username="tester",
            first_name="Tester",
            last_name=None,
            language="ru",
            phone=None,
            email=None,
            created_at=datetime.now(timezone.utc),
        )

        test_case = self

        class FakeUserRepository:
            def __init__(self, _session):
                pass

            async def upsert(self, tg_id, first_name, last_name=None, username=None):
                test_case.user.tg_id = tg_id
                test_case.user.first_name = first_name
                test_case.user.last_name = last_name
                test_case.user.username = username
                return test_case.user

            async def set_language(self, _tg_id, language):
                test_case.user.language = language
                return test_case.user

            async def get_by_tg_id(self, _tg_id):
                return test_case.user

        deps.verify_init_data = lambda _init_data: {
            "id": 123,
            "first_name": "Tester",
            "last_name": None,
            "username": "tester",
        }
        deps.UserRepository = FakeUserRepository
        user_routes.UserRepository = FakeUserRepository

        self.app = FastAPI()
        register_error_handlers(self.app)
        self.app.include_router(user_routes.router)
        self.app.dependency_overrides[user_routes.get_session] = lambda: object()
        self.client = TestClient(self.app)

    def tearDown(self):
        deps.verify_init_data = self.original_verify_init_data
        deps.UserRepository = self.original_deps_user_repository
        user_routes.UserRepository = self.original_user_repository
        self.app.dependency_overrides.clear()

    def test_set_language_route_accepts_language_code_and_returns_only_language_code(self):
        response = self.client.patch(
            "/api/user/language",
            json={"language_code": "en"},
            headers={"Authorization": "tma test-init-data"},
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["language_code"], "en")
        self.assertNotIn("language", body)

    def test_user_me_missing_authorization_uses_auth_code(self):
        response = self.client.get("/api/user/me")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["code"], "auth.invalid_authorization_header")

    def test_user_me_malformed_authorization_uses_auth_code(self):
        response = self.client.get("/api/user/me", headers={"Authorization": "Bearer test"})

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["code"], "auth.invalid_authorization_header")

    def test_user_me_missing_user_id_uses_auth_code(self):
        deps.verify_init_data = lambda _init_data: {}

        response = self.client.get("/api/user/me", headers={"Authorization": "tma test-init-data"})

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["code"], "auth.missing_user_id")

    def test_set_language_route_accepts_legacy_language_payload(self):
        response = self.client.patch(
            "/api/user/language",
            json={"language": "pl"},
            headers={"Authorization": "tma test-init-data"},
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["language_code"], "pl")
        self.assertNotIn("language", body)


if __name__ == "__main__":
    unittest.main()
