import os
import tempfile
import unittest
from unittest.mock import patch

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text


class StaffMigrationTest(unittest.TestCase):
    def _temp_db_urls(self):
        db_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        db_file.close()
        return db_file.name, f"sqlite+aiosqlite:///{db_file.name}", f"sqlite:///{db_file.name}"

    def _insert_need_changes_request(self, engine):
        with engine.begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO users (tg_id, first_name, created_at) "
                    "VALUES (9001, 'Manager', CURRENT_TIMESTAMP)"
                )
            )
            conn.execute(text("INSERT INTO cities (name, slug, is_active) VALUES ('Wroclaw', 'wroclaw', 1)"))
            conn.execute(
                text(
                    "INSERT INTO locations (city_id, name, address, is_active) "
                    "VALUES (1, 'Center', 'Main 1', 1)"
                )
            )
            conn.execute(
                text(
                    "INSERT INTO products (name_ru, name_pl, name_uk, base_price, is_active) "
                    "VALUES ('Product', 'Product', 'Product', 10, 1)"
                )
            )
            conn.execute(
                text(
                    "INSERT INTO product_requests "
                    "(request_type, status, requester_tg_id, city_id, location_id, product_id, quantity) "
                    "VALUES ('ADD_VARIANT', 'need_changes', 9001, 1, 1, 1, 1)"
                )
            )

    def test_staff_migration_upgrade_and_downgrade(self):
        db_path, async_url, sync_url = self._temp_db_urls()
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
            self.assertIn("locked_by_tg_id", request_columns)
            self.assertIn("locked_at", request_columns)
            self.assertIn("review_comment", request_columns)

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
            os.unlink(db_path)

    def test_product_request_need_changes_status_survives_upgrade(self):
        db_path, async_url, sync_url = self._temp_db_urls()
        engine = None
        try:
            cfg = Config("alembic.ini")
            with patch("config.settings.DATABASE_URL", async_url):
                command.upgrade(cfg, "head")

            engine = create_engine(sync_url)
            self._insert_need_changes_request(engine)
        finally:
            if engine is not None:
                engine.dispose()
            os.unlink(db_path)

    def test_product_request_need_changes_blocks_downgrade_to_0004(self):
        db_path, async_url, sync_url = self._temp_db_urls()
        engine = None
        try:
            cfg = Config("alembic.ini")
            with patch("config.settings.DATABASE_URL", async_url):
                command.upgrade(cfg, "head")

            engine = create_engine(sync_url)
            self._insert_need_changes_request(engine)
            engine.dispose()
            engine = None

            with self.assertRaises(Exception):
                with patch("config.settings.DATABASE_URL", async_url):
                    command.downgrade(cfg, "0004")
        finally:
            if engine is not None:
                engine.dispose()
            os.unlink(db_path)

    def test_product_request_review_loop_columns_removed_on_clean_downgrade_to_0004(self):
        db_path, async_url, sync_url = self._temp_db_urls()
        engine = None
        try:
            cfg = Config("alembic.ini")
            with patch("config.settings.DATABASE_URL", async_url):
                command.upgrade(cfg, "head")
                command.downgrade(cfg, "0004")

            engine = create_engine(sync_url)
            inspector = inspect(engine)
            self.assertIn("product_requests", inspector.get_table_names())
            request_columns = {column["name"] for column in inspector.get_columns("product_requests")}
            self.assertIn("request_type", request_columns)
            self.assertNotIn("locked_by_tg_id", request_columns)
            self.assertNotIn("locked_at", request_columns)
            self.assertNotIn("review_comment", request_columns)
        finally:
            if engine is not None:
                engine.dispose()
            os.unlink(db_path)

    def test_product_requests_support_source_type_and_nullable_inpost_target(self):
        import db.models  # noqa: F401
        from db.session import Base

        columns = Base.metadata.tables["product_requests"].c

        self.assertIn("source_type", columns)
        self.assertTrue(columns["city_id"].nullable)
        self.assertTrue(columns["location_id"].nullable)


if __name__ == "__main__":
    unittest.main()
