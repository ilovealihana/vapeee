from decimal import Decimal
import unittest

from webapp.routes.orders import delivery_cost_for_type, should_deduct_stock


class OrderDeliveryRulesTest(unittest.TestCase):
    def test_pickup_has_no_delivery_cost_and_deducts_stock(self):
        self.assertEqual(delivery_cost_for_type("pickup", Decimal("15.00")), Decimal("0"))
        self.assertTrue(should_deduct_stock("pickup"))

    def test_door_delivery_costs_fixed_fee_and_deducts_stock(self):
        self.assertEqual(delivery_cost_for_type("door_delivery", Decimal("15.00")), Decimal("15.00"))
        self.assertTrue(should_deduct_stock("door_delivery"))

    def test_inpost_is_not_part_of_location_stock_checkout(self):
        self.assertEqual(delivery_cost_for_type("inpost", Decimal("15.00")), Decimal("0"))
        self.assertFalse(should_deduct_stock("inpost"))


if __name__ == "__main__":
    unittest.main()
