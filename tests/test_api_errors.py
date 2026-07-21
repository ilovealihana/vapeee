import re
import unittest
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel

from webapp.errors import ApiError, ErrorCode, api_error, register_error_handlers
from webapp.main import app as main_app


_DEFAULT_LOCATION = object()


class Payload(BaseModel):
    quantity: int


def build_app() -> FastAPI:
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/api-error")
    async def api_error_route():
        raise ApiError(status_code=404, code=ErrorCode.CART_ITEM_NOT_FOUND, message="Cart item not found")

    @app.get("/unexpected")
    async def unexpected_route():
        raise RuntimeError("database password must not leak")

    @app.get("/legacy-http")
    async def legacy_http_route():
        raise HTTPException(status_code=404, detail="Legacy text")

    @app.get("/legacy-bad-request")
    async def legacy_bad_request_route():
        raise HTTPException(status_code=400, detail="Legacy bad request")

    @app.get("/legacy-not-implemented")
    async def legacy_not_implemented_route():
        raise HTTPException(status_code=501, detail="Legacy not implemented")

    @app.get("/legacy-with-headers")
    async def legacy_with_headers_route():
        raise HTTPException(
            status_code=401,
            detail="Legacy unauthorized",
            headers={"WWW-Authenticate": "Bearer"},
        )

    @app.post("/validation")
    async def validation_route(payload: Payload):
        return payload

    return app


class ApiErrorEnvelopeTest(unittest.TestCase):
    def test_api_error_uses_canonical_envelope(self):
        response = TestClient(build_app()).get("/api-error")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            response.json(),
            {"code": "cart.item_not_found", "message": "Cart item not found", "details": {}},
        )

    def test_validation_errors_use_field_envelope(self):
        response = TestClient(build_app()).post("/validation", json={"quantity": "bad"})

        self.assertEqual(response.status_code, 422)
        body = response.json()
        self.assertEqual(body["code"], ErrorCode.VALIDATION_FAILED)
        self.assertEqual(body["message"], "Validation failed")
        self.assertIn("fields", body["details"])
        self.assertEqual(body["details"]["fields"][0]["field"], "quantity")
        self.assertTrue(body["details"]["fields"][0]["code"].startswith("validation."))

    def test_unexpected_errors_use_safe_internal_error(self):
        client = TestClient(build_app(), raise_server_exceptions=False)
        response = client.get("/unexpected")

        self.assertEqual(response.status_code, 500)
        self.assertEqual(
            response.json(),
            {"code": "common.internal_error", "message": "Internal server error", "details": {}},
        )
        self.assertNotIn("password", response.text)

    def test_legacy_http_exception_uses_known_common_code(self):
        response = TestClient(build_app()).get("/legacy-http")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"code": "common.not_found", "message": "Not found", "details": {}})

    def test_legacy_bad_request_preserves_status_with_common_code(self):
        response = TestClient(build_app()).get("/legacy-bad-request")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"code": "common.bad_request", "message": "Bad request", "details": {}})

    def test_legacy_not_implemented_preserves_status_with_common_code(self):
        response = TestClient(build_app()).get("/legacy-not-implemented")

        self.assertEqual(response.status_code, 501)
        self.assertEqual(response.json(), {"code": "common.not_implemented", "message": "Not implemented", "details": {}})

    def test_missing_route_uses_canonical_not_found(self):
        response = TestClient(build_app()).get("/missing")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"code": "common.not_found", "message": "Not found", "details": {}})

    def test_method_not_allowed_uses_canonical_common_code(self):
        response = TestClient(build_app()).post("/api-error")

        self.assertEqual(response.status_code, 405)
        self.assertEqual(
            response.json(),
            {"code": "common.method_not_allowed", "message": "Method not allowed", "details": {}},
        )
        self.assertIn("GET", response.headers["allow"])

    def test_http_exception_handler_preserves_framework_headers(self):
        response = TestClient(build_app()).get("/legacy-with-headers")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.headers["www-authenticate"], "Bearer")
        self.assertEqual(
            response.json(),
            {"code": "auth.not_authenticated", "message": "Not authenticated", "details": {}},
        )

    def test_error_code_constants_cover_documented_catalog(self):
        docs = Path("docs/backend/error-handling.md").read_text(encoding="utf-8")
        documented = set(re.findall(r"\|\s*`([a-z_]+(?:\.[a-z_]+)+)`\s*\|", docs))
        constants = {
            value
            for name, value in vars(ErrorCode).items()
            if name.isupper() and isinstance(value, str)
        }

        self.assertEqual(documented - constants, set())


class RouteErrorFactoryTest(unittest.TestCase):
    def test_api_error_factory_preserves_safe_details(self):
        exc = api_error(
            409,
            ErrorCode.CART_INSUFFICIENT_STOCK,
            "Insufficient stock",
            {"field": "quantity", "available": 2},
        )

        self.assertEqual(exc.status_code, 409)
        self.assertEqual(exc.code, ErrorCode.CART_INSUFFICIENT_STOCK)
        self.assertEqual(exc.details, {"field": "quantity", "available": 2})

    def test_api_error_factory_drops_unsafe_detail_keys(self):
        exc = api_error(
            500,
            ErrorCode.COMMON_INTERNAL_ERROR,
            "Internal server error",
            {
                "field": "quantity",
                "stack": "traceback",
                "sql": "select * from users",
                "token": "secret",
                "path": "C:/secret/file.py",
            },
        )

        self.assertEqual(exc.details, {"field": "quantity"})


class RuntimeRouteErrorEnvelopeTest(unittest.TestCase):
    def test_missing_authorization_uses_auth_code(self):
        response = TestClient(main_app).get("/api/cart")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["code"], ErrorCode.AUTH_INVALID_AUTHORIZATION_HEADER)

    def test_malformed_authorization_uses_auth_header_code(self):
        response = TestClient(main_app).get("/api/cart", headers={"Authorization": "Bearer test"})

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["code"], ErrorCode.AUTH_INVALID_AUTHORIZATION_HEADER)

    def test_orders_malformed_authorization_uses_auth_header_code(self):
        response = TestClient(main_app).get("/api/orders", headers={"Authorization": "Bearer test"})

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["code"], ErrorCode.AUTH_INVALID_AUTHORIZATION_HEADER)

    def test_cart_missing_user_id_uses_auth_code(self):
        import webapp.deps as deps

        original_verify_init_data = deps.verify_init_data
        deps.verify_init_data = lambda _init_data: {}
        try:
            response = TestClient(main_app).get("/api/cart", headers={"Authorization": "tma test"})
        finally:
            deps.verify_init_data = original_verify_init_data

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["code"], ErrorCode.AUTH_MISSING_USER_ID)

    def test_orders_missing_user_id_uses_auth_code(self):
        import webapp.deps as deps

        original_verify_init_data = deps.verify_init_data
        deps.verify_init_data = lambda _init_data: {}
        try:
            response = TestClient(main_app).get("/api/orders", headers={"Authorization": "tma test"})
        finally:
            deps.verify_init_data = original_verify_init_data

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["code"], ErrorCode.AUTH_MISSING_USER_ID)

    def test_user_language_missing_authorization_takes_priority_over_body_validation(self):
        response = TestClient(main_app).patch("/api/user/language")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["code"], ErrorCode.AUTH_INVALID_AUTHORIZATION_HEADER)

    def test_cart_add_missing_authorization_takes_priority_over_body_validation(self):
        response = TestClient(main_app).post("/api/cart/items")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["code"], ErrorCode.AUTH_INVALID_AUTHORIZATION_HEADER)

    def test_cart_update_malformed_authorization_takes_priority_over_body_validation(self):
        response = TestClient(main_app).patch(
            "/api/cart/items/1",
            headers={"Authorization": "Bearer test"},
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["code"], ErrorCode.AUTH_INVALID_AUTHORIZATION_HEADER)

    def test_order_create_missing_authorization_takes_priority_over_body_validation(self):
        response = TestClient(main_app).post("/api/orders")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["code"], ErrorCode.AUTH_INVALID_AUTHORIZATION_HEADER)

    def test_representative_domain_route_codes_are_declared(self):
        self.assertEqual(ErrorCode.CATALOG_PRODUCT_NOT_FOUND, "catalog.product_not_found")
        self.assertEqual(ErrorCode.CATALOG_LOCATION_NOT_FOUND, "catalog.location_not_found")
        self.assertEqual(ErrorCode.CART_INSUFFICIENT_STOCK, "cart.insufficient_stock")
        self.assertEqual(ErrorCode.ORDER_CART_EMPTY, "order.cart_empty")
        self.assertEqual(ErrorCode.ADMIN_PRODUCT_NOT_FOUND, "admin.product_not_found")

    def test_migrated_routes_do_not_keep_legacy_http_exception_detail_contract(self):
        files = [
            "webapp/auth.py",
            "webapp/deps.py",
            "webapp/routes/auth.py",
            "webapp/routes/user.py",
            "webapp/routes/catalog.py",
            "webapp/routes/cart.py",
            "webapp/routes/orders.py",
            "webapp/routes/admin.py",
        ]

        offenders = []
        for file in files:
            source = Path(file).read_text(encoding="utf-8")
            if "HTTPException(" in source or "detail=" in source:
                offenders.append(file)

        self.assertEqual(offenders, [])

    def test_protected_routes_reuse_shared_auth_dependency(self):
        route_files = [
            "webapp/routes/user.py",
            "webapp/routes/cart.py",
            "webapp/routes/orders.py",
        ]

        offenders = []
        for file in route_files:
            source = Path(file).read_text(encoding="utf-8")
            if "def _get_user_data(" in source or "def _get_user(" in source:
                offenders.append(file)

        self.assertEqual(offenders, [])


class DomainRouteErrorContractTest(unittest.TestCase):
    def test_catalog_missing_city_filter_returns_city_not_found(self):
        from webapp.routes import catalog as catalog_routes

        original_repository = catalog_routes.CatalogRepository

        class FakeCatalogRepository:
            def __init__(self, _session):
                pass

            async def get_city(self, _city_id):
                return None

            async def get_locations_for_city(self, _city_id):
                return []

        app = FastAPI()
        register_error_handlers(app)
        app.include_router(catalog_routes.router)
        app.dependency_overrides[catalog_routes.get_session] = lambda: object()
        catalog_routes.CatalogRepository = FakeCatalogRepository
        try:
            response = TestClient(app).get("/api/cities/999/locations")
        finally:
            catalog_routes.CatalogRepository = original_repository
            app.dependency_overrides.clear()

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["code"], ErrorCode.CATALOG_CITY_NOT_FOUND)

    def test_catalog_inactive_city_filter_returns_city_not_found(self):
        from webapp.routes import catalog as catalog_routes

        original_repository = catalog_routes.CatalogRepository

        class FakeCatalogRepository:
            def __init__(self, _session):
                pass

            async def get_city(self, _city_id):
                return SimpleNamespace(is_active=False)

            async def get_locations_for_city(self, _city_id):
                return []

        app = FastAPI()
        register_error_handlers(app)
        app.include_router(catalog_routes.router)
        app.dependency_overrides[catalog_routes.get_session] = lambda: object()
        catalog_routes.CatalogRepository = FakeCatalogRepository
        try:
            response = TestClient(app).get("/api/cities/999/locations")
        finally:
            catalog_routes.CatalogRepository = original_repository
            app.dependency_overrides.clear()

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["code"], ErrorCode.CATALOG_CITY_NOT_FOUND)

    def test_catalog_locations_return_active_points_without_manager_as_unavailable(self):
        from webapp.routes import catalog as catalog_routes

        original_repository = catalog_routes.CatalogRepository
        location = self._location_with_city()

        class FakeCatalogRepository:
            def __init__(self, _session):
                pass

            async def get_city(self, _city_id):
                return SimpleNamespace(is_active=True)

            async def get_locations_for_city(self, _city_id):
                return [location]

            async def get_location_stock_summary(self, _location_id):
                return {"total_qty": 0, "last_sold": None}

            async def get_location_point_manager(self, _location_id):
                return None

        app = FastAPI()
        register_error_handlers(app)
        app.include_router(catalog_routes.router)
        app.dependency_overrides[catalog_routes.get_session] = lambda: object()
        catalog_routes.CatalogRepository = FakeCatalogRepository
        try:
            response = TestClient(app).get("/api/cities/1/locations")
        finally:
            catalog_routes.CatalogRepository = original_repository
            app.dependency_overrides.clear()

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload[0]["id"], location.id)
        self.assertFalse(payload[0]["has_manager"])
        self.assertIsNone(payload[0]["manager_tg_id"])
        self.assertFalse(payload[0]["catalog_available"])

    def test_catalog_locations_return_point_manager_username_for_contact(self):
        from webapp.routes import catalog as catalog_routes

        original_repository = catalog_routes.CatalogRepository
        location = self._location_with_city()

        class FakeCatalogRepository:
            def __init__(self, _session):
                pass

            async def get_city(self, _city_id):
                return SimpleNamespace(is_active=True)

            async def get_locations_for_city(self, _city_id):
                return [location]

            async def get_location_stock_summary(self, _location_id):
                return {"total_qty": 0, "last_sold": None}

            async def get_location_point_manager(self, _location_id):
                return SimpleNamespace(tg_id=12345, username="manager_user")

        app = FastAPI()
        register_error_handlers(app)
        app.include_router(catalog_routes.router)
        app.dependency_overrides[catalog_routes.get_session] = lambda: object()
        catalog_routes.CatalogRepository = FakeCatalogRepository
        try:
            response = TestClient(app).get("/api/cities/1/locations")
        finally:
            catalog_routes.CatalogRepository = original_repository
            app.dependency_overrides.clear()

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload[0]["manager_tg_id"], 12345)
        self.assertEqual(payload[0]["manager_tg_username"], "manager_user")
        self.assertTrue(payload[0]["catalog_available"])

    def test_catalog_missing_category_filter_returns_category_not_found(self):
        from webapp.routes import catalog as catalog_routes

        original_repository = catalog_routes.CatalogRepository

        class FakeCatalogRepository:
            def __init__(self, _session):
                pass

            async def get_category(self, _category_id):
                return None

            async def get_products(self, **_kwargs):
                return []

        app = FastAPI()
        register_error_handlers(app)
        app.include_router(catalog_routes.router)
        app.dependency_overrides[catalog_routes.get_session] = lambda: object()
        catalog_routes.CatalogRepository = FakeCatalogRepository
        try:
            response = TestClient(app).get("/api/products?category_id=999")
        finally:
            catalog_routes.CatalogRepository = original_repository
            app.dependency_overrides.clear()

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["code"], ErrorCode.CATALOG_CATEGORY_NOT_FOUND)

    def test_catalog_missing_location_filter_returns_location_not_found(self):
        response = self._catalog_client_with_location(None).get("/api/products?location_id=999")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["code"], ErrorCode.CATALOG_LOCATION_NOT_FOUND)

    def test_catalog_inactive_location_filter_returns_location_inactive(self):
        response = self._catalog_client_with_location(SimpleNamespace(is_active=False)).get(
            "/api/products?location_id=999"
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["code"], ErrorCode.CATALOG_LOCATION_INACTIVE)

    def test_catalog_inactive_location_direct_lookup_returns_location_inactive(self):
        response = self._catalog_client_with_location(SimpleNamespace(is_active=False, id=999)).get(
            "/api/locations/999"
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["code"], ErrorCode.CATALOG_LOCATION_INACTIVE)

    def test_catalog_location_under_inactive_city_returns_location_inactive(self):
        response = self._catalog_client_with_location(self._location_with_city(city_active=False)).get(
            "/api/locations/999"
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["code"], ErrorCode.CATALOG_LOCATION_INACTIVE)

    def test_catalog_location_filter_under_inactive_city_returns_location_inactive(self):
        response = self._catalog_client_with_location(self._location_with_city(city_active=False)).get(
            "/api/products?location_id=999"
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["code"], ErrorCode.CATALOG_LOCATION_INACTIVE)

    def test_catalog_location_without_point_manager_blocks_product_list(self):
        response = self._catalog_client_with_location(self._location_with_city(), point_manager=None).get(
            "/api/products?location_id=999"
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["code"], ErrorCode.CATALOG_LOCATION_INACTIVE)

    def test_catalog_location_without_point_manager_blocks_product_detail(self):
        response = self._catalog_client_with_location(self._location_with_city(), point_manager=None).get(
            "/api/products/1?location_id=999"
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["code"], ErrorCode.CATALOG_LOCATION_INACTIVE)

    def test_catalog_product_detail_missing_location_returns_location_not_found(self):
        response = self._catalog_client_with_location(None).get("/api/products/1?location_id=999")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["code"], ErrorCode.CATALOG_LOCATION_NOT_FOUND)

    def test_catalog_inactive_product_detail_returns_product_unavailable(self):
        response = self._catalog_client_with_location(
            SimpleNamespace(is_active=True),
            product_active=False,
        ).get("/api/products/1")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["code"], ErrorCode.CATALOG_PRODUCT_UNAVAILABLE)

    def test_cart_update_missing_item_returns_item_not_found(self):
        response = self._cart_client_with_missing_item().patch(
            "/api/cart/items/999",
            json={"quantity": 2},
            headers={"Authorization": "tma test"},
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["code"], ErrorCode.CART_ITEM_NOT_FOUND)

    def test_cart_update_without_cart_returns_item_not_found(self):
        response = self._cart_client_without_cart().patch(
            "/api/cart/items/999",
            json={"quantity": 2},
            headers={"Authorization": "tma test"},
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["code"], ErrorCode.CART_ITEM_NOT_FOUND)

    def test_cart_update_non_positive_quantity_returns_invalid_quantity(self):
        response = self._cart_client_with_missing_item().patch(
            "/api/cart/items/999",
            json={"quantity": 0},
            headers={"Authorization": "tma test"},
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["code"], ErrorCode.CART_INVALID_QUANTITY)

    def test_cart_delete_missing_item_returns_item_not_found(self):
        response = self._cart_client_with_missing_item().delete(
            "/api/cart/items/999",
            headers={"Authorization": "tma test"},
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["code"], ErrorCode.CART_ITEM_NOT_FOUND)

    def test_cart_delete_without_cart_returns_item_not_found(self):
        response = self._cart_client_without_cart().delete(
            "/api/cart/items/999",
            headers={"Authorization": "tma test"},
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["code"], ErrorCode.CART_ITEM_NOT_FOUND)

    def test_cart_update_inactive_location_returns_variant_unavailable_without_mutation(self):
        state = SimpleNamespace(set_item_quantity_called=False)
        response = self._cart_update_available_client(
            stock_qty=5,
            location=SimpleNamespace(is_active=False, city=SimpleNamespace(is_active=True)),
            state=state,
        ).patch(
            "/api/cart/items/999",
            json={"quantity": 2},
            headers={"Authorization": "tma test"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], ErrorCode.CART_VARIANT_UNAVAILABLE)
        self.assertFalse(state.set_item_quantity_called)

    def test_cart_update_location_under_inactive_city_returns_variant_unavailable_without_mutation(self):
        state = SimpleNamespace(set_item_quantity_called=False)
        response = self._cart_update_available_client(
            stock_qty=5,
            location=SimpleNamespace(is_active=True, city=SimpleNamespace(is_active=False)),
            state=state,
        ).patch(
            "/api/cart/items/999",
            json={"quantity": 2},
            headers={"Authorization": "tma test"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], ErrorCode.CART_VARIANT_UNAVAILABLE)
        self.assertFalse(state.set_item_quantity_called)

    def test_cart_update_insufficient_stock_returns_insufficient_stock_without_mutation(self):
        state = SimpleNamespace(set_item_quantity_called=False)
        response = self._cart_update_available_client(
            stock_qty=1,
            state=state,
        ).patch(
            "/api/cart/items/999",
            json={"quantity": 2},
            headers={"Authorization": "tma test"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], ErrorCode.CART_INSUFFICIENT_STOCK)
        self.assertFalse(state.set_item_quantity_called)

    def test_cart_update_reloads_with_captured_user_id_after_expire(self):
        state = SimpleNamespace(
            set_item_quantity_called=False,
            raise_user_id_after_expire=True,
            expired=False,
        )
        response = self._cart_update_available_client(
            stock_qty=5,
            state=state,
        ).patch(
            "/api/cart/items/999",
            json={"quantity": 2},
            headers={"Authorization": "tma test"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(state.set_item_quantity_called)
        self.assertTrue(state.expired)

    def test_cart_add_missing_variant_returns_variant_unavailable(self):
        response = self._cart_add_client(variant=None, product=None, stock_qty=5).post(
            "/api/cart/items",
            json={"variant_id": 999, "quantity": 1, "location_id": 1},
            headers={"Authorization": "tma test"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], ErrorCode.CART_VARIANT_UNAVAILABLE)

    def test_cart_add_inactive_product_returns_variant_unavailable(self):
        response = self._cart_add_client(
            variant=SimpleNamespace(product_id=1),
            product=SimpleNamespace(is_active=False),
            stock_qty=5,
        ).post(
            "/api/cart/items",
            json={"variant_id": 10, "quantity": 1, "location_id": 1},
            headers={"Authorization": "tma test"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], ErrorCode.CART_VARIANT_UNAVAILABLE)

    def test_cart_add_insufficient_location_stock_returns_insufficient_stock(self):
        response = self._cart_add_client(
            variant=SimpleNamespace(product_id=1),
            product=SimpleNamespace(is_active=True),
            stock_qty=1,
            existing_quantity=0,
        ).post(
            "/api/cart/items",
            json={"variant_id": 10, "quantity": 2, "location_id": 1},
            headers={"Authorization": "tma test"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], ErrorCode.CART_INSUFFICIENT_STOCK)

    def test_cart_add_accumulated_quantity_cannot_exceed_location_stock(self):
        response = self._cart_add_client(
            variant=SimpleNamespace(product_id=1),
            product=SimpleNamespace(is_active=True),
            stock_qty=5,
            existing_quantity=4,
        ).post(
            "/api/cart/items",
            json={"variant_id": 10, "quantity": 2, "location_id": 1},
            headers={"Authorization": "tma test"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], ErrorCode.CART_INSUFFICIENT_STOCK)

    def test_cart_add_insufficient_stock_does_not_create_empty_cart(self):
        state = SimpleNamespace(get_or_create_called=False)
        response = self._cart_add_client(
            variant=SimpleNamespace(product_id=1),
            product=SimpleNamespace(is_active=True),
            stock_qty=1,
            existing_quantity=0,
            state=state,
        ).post(
            "/api/cart/items",
            json={"variant_id": 10, "quantity": 2, "location_id": 1},
            headers={"Authorization": "tma test"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], ErrorCode.CART_INSUFFICIENT_STOCK)
        self.assertFalse(state.get_or_create_called)

    def test_cart_add_inactive_location_returns_variant_unavailable(self):
        response = self._cart_add_client(
            variant=SimpleNamespace(product_id=1),
            product=SimpleNamespace(is_active=True),
            stock_qty=5,
            location=SimpleNamespace(is_active=False, city=SimpleNamespace(is_active=True)),
        ).post(
            "/api/cart/items",
            json={"variant_id": 10, "quantity": 1, "location_id": 1},
            headers={"Authorization": "tma test"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], ErrorCode.CART_VARIANT_UNAVAILABLE)

    def test_cart_add_location_without_point_manager_returns_variant_unavailable(self):
        response = self._cart_add_client(
            variant=SimpleNamespace(product_id=1),
            product=SimpleNamespace(is_active=True),
            stock_qty=5,
            point_manager=None,
        ).post(
            "/api/cart/items",
            json={"variant_id": 10, "quantity": 1, "location_id": 1},
            headers={"Authorization": "tma test"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], ErrorCode.CART_VARIANT_UNAVAILABLE)

    def test_cart_add_location_under_inactive_city_returns_variant_unavailable(self):
        response = self._cart_add_client(
            variant=SimpleNamespace(product_id=1),
            product=SimpleNamespace(is_active=True),
            stock_qty=5,
            location=SimpleNamespace(is_active=True, city=SimpleNamespace(is_active=False)),
        ).post(
            "/api/cart/items",
            json={"variant_id": 10, "quantity": 1, "location_id": 1},
            headers={"Authorization": "tma test"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], ErrorCode.CART_VARIANT_UNAVAILABLE)

    def test_cart_add_missing_location_returns_variant_unavailable(self):
        state = SimpleNamespace(get_or_create_called=False)
        response = self._cart_add_client(
            variant=SimpleNamespace(product_id=1),
            product=SimpleNamespace(is_active=True),
            stock_qty=5,
            location=None,
            state=state,
        ).post(
            "/api/cart/items",
            json={"variant_id": 10, "quantity": 1, "location_id": 1},
            headers={"Authorization": "tma test"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], ErrorCode.CART_VARIANT_UNAVAILABLE)
        self.assertFalse(state.get_or_create_called)

    def test_order_invalid_delivery_type_returns_domain_code(self):
        response = self._orders_client().post(
            "/api/orders",
            json={**self._valid_order_payload(), "delivery_type": "drone"},
            headers={"Authorization": "tma test"},
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["code"], ErrorCode.ORDER_INVALID_DELIVERY_TYPE)

    def test_order_invalid_payment_method_returns_domain_code(self):
        response = self._orders_client().post(
            "/api/orders",
            json={**self._valid_order_payload(), "payment_method": "gold"},
            headers={"Authorization": "tma test"},
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["code"], ErrorCode.ORDER_INVALID_PAYMENT_METHOD)

    def test_order_invalid_schedule_returns_domain_code(self):
        response = self._orders_client().post(
            "/api/orders",
            json={**self._valid_order_payload(), "scheduled_date": "not-a-date"},
            headers={"Authorization": "tma test"},
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["code"], ErrorCode.ORDER_INVALID_SCHEDULE)

    def test_order_insufficient_stock_returns_domain_code_without_mutation(self):
        state = SimpleNamespace(created=False, cleared=False, committed=False)
        response = self._orders_client(stock_qty=1, state=state).post(
            "/api/orders",
            json=self._valid_order_payload(),
            headers={"Authorization": "tma test"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], ErrorCode.ORDER_INSUFFICIENT_STOCK)
        self.assertFalse(state.created)
        self.assertFalse(state.cleared)
        self.assertFalse(state.committed)

    def test_order_inactive_product_in_existing_cart_returns_insufficient_stock_without_mutation(self):
        state = SimpleNamespace(created=False, cleared=False, committed=False)
        response = self._orders_client(
            stock_qty=5,
            state=state,
            product=SimpleNamespace(base_price=Decimal("10.00"), is_active=False),
        ).post(
            "/api/orders",
            json=self._valid_order_payload(),
            headers={"Authorization": "tma test"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], ErrorCode.ORDER_INSUFFICIENT_STOCK)
        self.assertFalse(state.created)
        self.assertFalse(state.cleared)
        self.assertFalse(state.committed)

    def test_order_inactive_location_returns_insufficient_stock_without_mutation(self):
        state = SimpleNamespace(created=False, cleared=False, committed=False)
        response = self._orders_client(
            stock_qty=5,
            state=state,
            location=SimpleNamespace(is_active=False, city=SimpleNamespace(is_active=True)),
        ).post(
            "/api/orders",
            json=self._valid_order_payload(),
            headers={"Authorization": "tma test"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], ErrorCode.ORDER_INSUFFICIENT_STOCK)
        self.assertFalse(state.created)
        self.assertFalse(state.cleared)
        self.assertFalse(state.committed)

    def test_order_location_without_point_manager_returns_insufficient_stock_without_mutation(self):
        state = SimpleNamespace(created=False, cleared=False, committed=False)
        response = self._orders_client(
            stock_qty=5,
            state=state,
            point_manager=None,
        ).post(
            "/api/orders",
            json=self._valid_order_payload(),
            headers={"Authorization": "tma test"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], ErrorCode.ORDER_INSUFFICIENT_STOCK)
        self.assertFalse(state.created)
        self.assertFalse(state.cleared)
        self.assertFalse(state.committed)

    def test_order_location_under_inactive_city_returns_insufficient_stock_without_mutation(self):
        state = SimpleNamespace(created=False, cleared=False, committed=False)
        response = self._orders_client(
            stock_qty=5,
            state=state,
            location=SimpleNamespace(is_active=True, city=SimpleNamespace(is_active=False)),
        ).post(
            "/api/orders",
            json=self._valid_order_payload(),
            headers={"Authorization": "tma test"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], ErrorCode.ORDER_INSUFFICIENT_STOCK)
        self.assertFalse(state.created)
        self.assertFalse(state.cleared)
        self.assertFalse(state.committed)

    def test_order_missing_location_returns_insufficient_stock_without_mutation(self):
        state = SimpleNamespace(created=False, cleared=False, committed=False)
        response = self._orders_client(
            stock_qty=5,
            state=state,
            location=None,
        ).post(
            "/api/orders",
            json=self._valid_order_payload(),
            headers={"Authorization": "tma test"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], ErrorCode.ORDER_INSUFFICIENT_STOCK)
        self.assertFalse(state.created)
        self.assertFalse(state.cleared)
        self.assertFalse(state.committed)

    def test_admin_delete_missing_targets_return_domain_codes(self):
        client = self._admin_client_with_missing_targets()

        cases = [
            ("delete", "/api/admin/cities/999", ErrorCode.ADMIN_CITY_NOT_FOUND),
            ("delete", "/api/admin/locations/999", ErrorCode.ADMIN_LOCATION_NOT_FOUND),
            ("delete", "/api/admin/products/999", ErrorCode.ADMIN_PRODUCT_NOT_FOUND),
            ("delete", "/api/admin/variants/999", ErrorCode.ADMIN_VARIANT_NOT_FOUND),
        ]

        for method, path, code in cases:
            with self.subTest(path=path):
                response = getattr(client, method)(path)
                self.assertEqual(response.status_code, 404)
                self.assertEqual(response.json()["code"], code)

    def _catalog_client_with_location(self, location, product_active=True, point_manager=_DEFAULT_LOCATION):
        from webapp.routes import catalog as catalog_routes

        original_repository = catalog_routes.CatalogRepository

        class FakeCatalogRepository:
            def __init__(self, _session):
                pass

            async def get_location(self, _location_id):
                return location

            async def get_location_stock_summary(self, _location_id):
                return {"total_qty": 0, "last_sold": None}

            async def get_location_point_manager(self, _location_id):
                if point_manager is None:
                    return None
                if point_manager is _DEFAULT_LOCATION:
                    return SimpleNamespace(tg_id=12345)
                return point_manager

            async def get_products(self, **_kwargs):
                return []

            async def get_product(self, _product_id):
                return SimpleNamespace(
                    id=1,
                    category_id=None,
                    name_ru="Product",
                    name_pl="Product",
                    name_uk="Product",
                    description_ru=None,
                    description_pl=None,
                    description_uk=None,
                    image_file_id=None,
                    base_price=Decimal("10.00"),
                    is_active=product_active,
                    variants=[],
                )

        app = FastAPI()
        register_error_handlers(app)
        app.include_router(catalog_routes.router)
        app.dependency_overrides[catalog_routes.get_session] = lambda: object()
        catalog_routes.CatalogRepository = FakeCatalogRepository

        def restore():
            catalog_routes.CatalogRepository = original_repository
            app.dependency_overrides.clear()

        self.addCleanup(restore)
        return TestClient(app)

    def _location_with_city(self, city_active: bool = True):
        return SimpleNamespace(
            id=999,
            city_id=1,
            name="Location",
            address="Address",
            description=None,
            curator_tg_username=None,
            is_active=True,
            has_manager=False,
            manager_tg_id=None,
            catalog_available=False,
            city=SimpleNamespace(is_active=city_active),
        )

    def _cart_add_client(
        self,
        variant,
        product,
        stock_qty,
        existing_quantity=0,
        state=None,
        location=_DEFAULT_LOCATION,
        point_manager=_DEFAULT_LOCATION,
    ):
        import webapp.deps as deps
        from webapp.routes import cart as cart_routes

        originals = (
            deps.verify_init_data,
            deps.UserRepository,
            cart_routes.CartRepository,
            cart_routes.CatalogRepository,
        )

        class FakeUserRepository:
            def __init__(self, _session):
                pass

            async def upsert(self, **_kwargs):
                return SimpleNamespace(id=1)

        class FakeCartRepository:
            def __init__(self, _session):
                pass

            async def get_or_create(self, user_id, location_id):
                if state is not None:
                    state.get_or_create_called = True
                items = []
                if existing_quantity:
                    items.append(SimpleNamespace(variant_id=10, quantity=existing_quantity))
                return SimpleNamespace(id=1, user_id=user_id, location_id=location_id, items=items)

            async def get_by_user_id(self, user_id):
                items = []
                if existing_quantity:
                    items.append(SimpleNamespace(variant_id=10, quantity=existing_quantity))
                    return SimpleNamespace(id=1, user_id=user_id, location_id=1, items=items)
                return None

            async def set_location(self, *_args):
                return None

            async def add_item(self, *_args):
                raise AssertionError("add_item must not be called when validation fails")

        class FakeCatalogRepository:
            def __init__(self, _session):
                pass

            async def get_location(self, _location_id):
                if location is _DEFAULT_LOCATION:
                    return SimpleNamespace(is_active=True, city=SimpleNamespace(is_active=True))
                return location

            async def get_location_point_manager(self, _location_id):
                if point_manager is None:
                    return None
                if point_manager is _DEFAULT_LOCATION:
                    return SimpleNamespace(tg_id=12345)
                return point_manager

            async def get_variant(self, _variant_id):
                return variant

            async def get_product(self, _product_id):
                return product

        class FakeResult:
            def scalar_one_or_none(self):
                if stock_qty is None:
                    return None
                return SimpleNamespace(quantity=stock_qty)

        class FakeSession:
            async def execute(self, _statement):
                return FakeResult()

            def expire_all(self):
                return None

        app = FastAPI()
        register_error_handlers(app)
        app.include_router(cart_routes.router)
        app.dependency_overrides[cart_routes.get_session] = lambda: FakeSession()
        deps.verify_init_data = lambda _init_data: {"id": 123, "first_name": "Tester"}
        deps.UserRepository = FakeUserRepository
        cart_routes.CartRepository = FakeCartRepository
        cart_routes.CatalogRepository = FakeCatalogRepository

        def restore():
            (
                deps.verify_init_data,
                deps.UserRepository,
                cart_routes.CartRepository,
                cart_routes.CatalogRepository,
            ) = originals
            app.dependency_overrides.clear()

        self.addCleanup(restore)
        return TestClient(app)

    def _cart_client_with_missing_item(self):
        return self._cart_client(cart=SimpleNamespace(id=1, user_id=1, location_id=None, items=[]))

    def _cart_client_without_cart(self):
        return self._cart_client(cart=None)

    def _cart_client(self, cart):
        import webapp.deps as deps
        from webapp.routes import cart as cart_routes

        originals = (
            deps.verify_init_data,
            deps.UserRepository,
            cart_routes.CartRepository,
        )

        class FakeUserRepository:
            def __init__(self, _session):
                pass

            async def upsert(self, **_kwargs):
                return SimpleNamespace(id=1)

        class FakeCartRepository:
            def __init__(self, _session):
                pass

            async def get_by_user_id(self, _user_id):
                return cart

            async def get_item(self, _cart_id, _item_id):
                return None

            async def set_item_quantity(self, *_args):
                return None

            async def remove_item(self, *_args):
                return None

        class FakeSession:
            def expire_all(self):
                return None

        app = FastAPI()
        register_error_handlers(app)
        app.include_router(cart_routes.router)
        app.dependency_overrides[cart_routes.get_session] = lambda: FakeSession()
        deps.verify_init_data = lambda _init_data: {"id": 123, "first_name": "Tester"}
        deps.UserRepository = FakeUserRepository
        cart_routes.CartRepository = FakeCartRepository

        def restore():
            deps.verify_init_data, deps.UserRepository, cart_routes.CartRepository = originals
            app.dependency_overrides.clear()

        self.addCleanup(restore)
        return TestClient(app)

    def _cart_update_available_client(
        self,
        stock_qty,
        state=None,
        location=_DEFAULT_LOCATION,
        product=None,
        point_manager=_DEFAULT_LOCATION,
    ):
        import webapp.deps as deps
        from webapp.routes import cart as cart_routes

        originals = (
            deps.verify_init_data,
            deps.UserRepository,
            cart_routes.CartRepository,
            cart_routes.CatalogRepository,
        )

        variant = SimpleNamespace(
            id=10,
            product_id=1,
            name_ru="Variant",
            name_pl="Variant",
            name_uk="Variant",
            image_file_id=None,
            price_override=None,
        )
        cart_item = SimpleNamespace(id=999, variant_id=10, variant=variant, quantity=1)
        cart = SimpleNamespace(id=1, user_id=1, location_id=1, items=[cart_item])

        class ExpiringUpdateUser:
            @property
            def id(self):
                if (
                    state is not None
                    and getattr(state, "raise_user_id_after_expire", False)
                    and getattr(state, "expired", False)
                ):
                    raise AssertionError("user.id must be captured before session.expire_all()")
                return 1

        class FakeUserRepository:
            def __init__(self, _session):
                pass

            async def upsert(self, **_kwargs):
                return ExpiringUpdateUser()

        class FakeCartRepository:
            def __init__(self, _session):
                pass

            async def get_by_user_id(self, _user_id):
                return cart

            async def get_item(self, _cart_id, _item_id):
                return cart_item

            async def set_item_quantity(self, *_args):
                if state is not None:
                    state.set_item_quantity_called = True
                return None

        class FakeCatalogRepository:
            def __init__(self, _session):
                pass

            async def get_location(self, _location_id):
                if location is _DEFAULT_LOCATION:
                    return SimpleNamespace(is_active=True, city=SimpleNamespace(is_active=True))
                return location

            async def get_location_point_manager(self, _location_id):
                if point_manager is None:
                    return None
                if point_manager is _DEFAULT_LOCATION:
                    return SimpleNamespace(tg_id=12345)
                return point_manager

            async def get_variant(self, _variant_id):
                return variant

            async def get_product(self, _product_id):
                if product is None:
                    return SimpleNamespace(
                        id=1,
                        category_id=None,
                        name_ru="Product",
                        name_pl="Product",
                        name_uk="Product",
                        description_ru=None,
                        description_pl=None,
                        description_uk=None,
                        image_file_id=None,
                        base_price=Decimal("10.00"),
                        is_active=True,
                        variants=[],
                    )
                return product

        class FakeResult:
            def scalar_one_or_none(self):
                if stock_qty is None:
                    return None
                return SimpleNamespace(quantity=stock_qty)

        class FakeSession:
            async def execute(self, _statement):
                return FakeResult()

            def expire_all(self):
                if state is not None:
                    state.expired = True
                return None

        app = FastAPI()
        register_error_handlers(app)
        app.include_router(cart_routes.router)
        app.dependency_overrides[cart_routes.get_session] = lambda: FakeSession()
        deps.verify_init_data = lambda _init_data: {"id": 123, "first_name": "Tester"}
        deps.UserRepository = FakeUserRepository
        cart_routes.CartRepository = FakeCartRepository
        cart_routes.CatalogRepository = FakeCatalogRepository

        def restore():
            (
                deps.verify_init_data,
                deps.UserRepository,
                cart_routes.CartRepository,
                cart_routes.CatalogRepository,
            ) = originals
            app.dependency_overrides.clear()

        self.addCleanup(restore)
        return TestClient(app)

    def _orders_client(self, stock_qty=None, state=None, location=_DEFAULT_LOCATION, product=None, point_manager=_DEFAULT_LOCATION):
        import webapp.deps as deps
        from webapp.routes import orders as orders_routes

        originals = (
            deps.verify_init_data,
            deps.UserRepository,
            orders_routes.CartRepository,
            orders_routes.CatalogRepository,
            orders_routes.OrderRepository,
            orders_routes._notify_admins,
        )

        class FakeUserRepository:
            def __init__(self, _session):
                pass

            async def upsert(self, **_kwargs):
                return SimpleNamespace(id=1)

        class FakeCartRepository:
            def __init__(self, _session):
                pass

            async def get_by_user_id(self, _user_id):
                variant = SimpleNamespace(product_id=1, price_override=None)
                return SimpleNamespace(
                    id=1,
                    location_id=1,
                    items=[SimpleNamespace(variant=variant, variant_id=10, quantity=2)],
                )

            async def clear(self, _cart_id):
                if state is not None:
                    state.cleared = True
                return None

        class FakeCatalogRepository:
            def __init__(self, _session):
                pass

            async def get_location(self, _location_id):
                if location is _DEFAULT_LOCATION:
                    return SimpleNamespace(is_active=True, city=SimpleNamespace(is_active=True))
                return location

            async def get_location_point_manager(self, _location_id):
                if point_manager is None:
                    return None
                if point_manager is _DEFAULT_LOCATION:
                    return SimpleNamespace(tg_id=12345)
                return point_manager

            async def get_product(self, _product_id):
                if product is not None:
                    return product
                return SimpleNamespace(base_price=Decimal("10.00"), is_active=True)

        class FakeOrderRepository:
            def __init__(self, _session):
                pass

            async def create(self, **kwargs):
                if state is not None:
                    state.created = True
                return SimpleNamespace(
                    id=1,
                    status="new",
                    created_at=datetime.now(timezone.utc),
                    items=[],
                    **kwargs,
                )

            async def add_items(self, *_args):
                return None

            async def get(self, _order_id):
                return SimpleNamespace(
                    id=1,
                    user_id=1,
                    location_id=1,
                    delivery_type="pickup",
                    status="new",
                    customer_name="Tester",
                    customer_phone="+48123123123",
                    customer_email="t@example.com",
                    delivery_address=None,
                    scheduled_at=datetime.now(timezone.utc),
                    products_total=Decimal("20.00"),
                    delivery_cost=Decimal("0"),
                    total=Decimal("20.00"),
                    payment_method="cash",
                    comment=None,
                    created_at=datetime.now(timezone.utc),
                    items=[],
                )

        async def fake_notify_admins(*_args):
            return None

        class FakeResult:
            def scalar_one_or_none(self):
                if stock_qty is None:
                    return None
                return SimpleNamespace(quantity=stock_qty, last_sold_at=None)

        class FakeSession:
            async def execute(self, _statement):
                return FakeResult()

            async def commit(self):
                if state is not None:
                    state.committed = True
                return None

        app = FastAPI()
        register_error_handlers(app)
        app.include_router(orders_routes.router)
        app.dependency_overrides[orders_routes.get_session] = lambda: FakeSession()
        deps.verify_init_data = lambda _init_data: {"id": 123, "first_name": "Tester"}
        deps.UserRepository = FakeUserRepository
        orders_routes.CartRepository = FakeCartRepository
        orders_routes.CatalogRepository = FakeCatalogRepository
        orders_routes.OrderRepository = FakeOrderRepository
        orders_routes._notify_admins = fake_notify_admins

        def restore():
            (
                deps.verify_init_data,
                deps.UserRepository,
                orders_routes.CartRepository,
                orders_routes.CatalogRepository,
                orders_routes.OrderRepository,
                orders_routes._notify_admins,
            ) = originals
            app.dependency_overrides.clear()

        self.addCleanup(restore)
        return TestClient(app)

    def _valid_order_payload(self):
        return {
            "delivery_type": "pickup",
            "customer_name": "Tester",
            "customer_phone": "+48123123123",
            "customer_email": "t@example.com",
            "location_id": 1,
            "scheduled_date": "2099-03-15",
            "scheduled_time": "14:00",
            "payment_method": "cash",
        }

    def _admin_client_with_missing_targets(self):
        from webapp.routes import admin as admin_routes

        class FakeResult:
            def scalar_one_or_none(self):
                return None

        class FakeSession:
            async def execute(self, _statement):
                return FakeResult()

            async def commit(self):
                return None

        app = FastAPI()
        register_error_handlers(app)
        app.include_router(admin_routes.router)
        app.dependency_overrides[admin_routes.get_session] = lambda: FakeSession()
        app.dependency_overrides[admin_routes.get_admin_user] = lambda: object()
        return TestClient(app)


if __name__ == "__main__":
    unittest.main()
