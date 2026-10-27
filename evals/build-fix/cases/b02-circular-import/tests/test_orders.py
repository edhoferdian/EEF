import unittest

from shop.models import place_order
from shop.services import AUDIT_LOG


class PlaceOrder(unittest.TestCase):
    def test_order_is_audited(self):
        place_order(7, 1250)
        self.assertIn("order 7: 1250", AUDIT_LOG)
