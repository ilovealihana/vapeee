import os
import tempfile
import unittest
from unittest.mock import patch

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text


class StaffMigrationTest(unittest.TestCase):
    def test_staff_migration_upgrade_and_downgrade(self):
        db_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        db_file.close()
        async_url = f"sqlite+aiosqlite:///{db_file.name}"
        sync_url = f"sqlite:///{db_file.name}"
        engine = None
        try:
            cfg = Config("alembic.ini")
            with patch("config.settings.DATABASE_URL", async_url):
                command.upgrade(cfg, "head")

            engine = create_engine(sync_url)
            inspector = inspect(engine)
            self.assertIn("staff_members", inspector.get_table_names())
            self.assertIn("staff_assignments", inspector.get_table_names())
            self.assertIn("product_requests", inspector.get_table_names())
            staff_columns = {column["name"] for column in inspector.get_columns("staff_members")}
            self.assertIn("username", staff_columns)
            request_columns = {column["name"] for column in inspector.get_columns("product_requests")}
            self.assertIn("request_type", request_columns)
            self.assertIn("published_variant_id", request_columns)

            with engine.begin() as conn:
                conn.execute(text("PRAGMA foreign_keys=ON"))
                with self.assertRaises(Exception):
                    conn.execute(
                        text(
                            "INSERT INTO staff_assignments "
                            "(staff_member_id, city_id, location_id) VALUES (1, NULL, NULL)"
                        )
                    )

            engine.dispose()
            engine = None
            with patch("config.settings.DATABASE_URL", async_url):
                command.downgrade(cfg, "0001")

            engine = create_engine(sync_url)
            inspector = inspect(engine)
            self.assertNotIn("staff_members", inspector.get_table_names())
            self.assertNotIn("staff_assignments", inspector.get_table_names())
            self.assertNotIn("product_requests", inspector.get_table_names())
        finally:
            if engine is not None:
                engine.dispose()
            os.unlink(db_file.name)


if __name__ == "__main__":
    unittest.main()
