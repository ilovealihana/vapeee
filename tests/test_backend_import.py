import unittest


class BackendImportTest(unittest.TestCase):
    def test_fastapi_app_imports(self):
        from webapp.main import app

        self.assertEqual(app.title, "VapeShop Mini App API")
        routes = {route.path for route in app.routes}
        self.assertIn("/health", routes)


if __name__ == "__main__":
    unittest.main()
