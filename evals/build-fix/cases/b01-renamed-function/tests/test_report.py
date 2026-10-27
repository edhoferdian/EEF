import unittest

from app.report import report_filename


class ReportFilename(unittest.TestCase):
    def test_slug_and_year(self):
        self.assertEqual(report_filename("Q3 Revenue & Costs", 2026), "2026-q3-revenue-costs.pdf")
