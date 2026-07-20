import unittest

from config import Settings


class SettingsTest(unittest.TestCase):
    def test_bot_token_is_optional_for_backend_startup(self):
        settings = Settings(_env_file=None)

        self.assertEqual(settings.BOT_TOKEN, "")


if __name__ == "__main__":
    unittest.main()
