import unittest

import db.models  # noqa: F401
from db.session import Base


class GlobalCatalogSchemaTest(unittest.TestCase):
    def test_location_cart_order_and_inpost_schema_are_registered(self):
        self.assertIn("locations", Base.metadata.tables)
        self.assertIn("carts", Base.metadata.tables)
        self.assertIn("orders", Base.metadata.tables)
        self.assertIn("inpost_stock", Base.metadata.tables)

        locations = Base.metadata.tables["locations"].c
        carts = Base.metadata.tables["carts"].c
        orders = Base.metadata.tables["orders"].c
        inpost_stock = Base.metadata.tables["inpost_stock"].c

        self.assertIn("latitude", locations)
        self.assertIn("longitude", locations)
        self.assertIn("source_type", carts)
        self.assertIn("source_type", orders)
        self.assertIn("inpost_delivery_method", orders)
        self.assertIn("inpost_point_id", orders)
        self.assertIn("inpost_point_label", orders)
        self.assertIn("inpost_courier_address_json", orders)
        self.assertIn("variant_id", inpost_stock)
        self.assertIn("quantity", inpost_stock)
        self.assertIn("last_sold_at", inpost_stock)


if __name__ == "__main__":
    unittest.main()
