import unittest

from app.config import SETTINGS, retry_limit


class Settings(unittest.TestCase):
    def test_values_come_from_the_file(self):
        self.assertEqual(retry_limit(), 3)
        self.assertEqual(SETTINGS["timeout_s"], 10)
