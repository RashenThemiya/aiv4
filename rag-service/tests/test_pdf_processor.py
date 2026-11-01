import unittest

from app.services.pdf_processor import (
    PdfPage,
    _merge_extracted_text,
    _is_visual_page,
    _is_usable_table,
    _extract_page_text,
    _extract_tables,
    _split_long_unit,
    _table_to_markdown,
    chunk_pages,
)


class PdfProcessorTests(unittest.TestCase):
    def test_table_rows_keep_column_meaning(self):
        rendered = _table_to_markdown([
            ["Model", "Fuse rating"],
            ["IC1230150", "450 A"],
        ])

        self.assertIn("Model = IC1230150", rendered)
        self.assertIn("Fuse rating = 450 A", rendered)

    def test_merged_table_title_does_not_replace_column_headers(self):
        rendered = _table_to_markdown([
            ["Electrical specifications", None],
            ["Model", "Fuse rating"],
            ["IC1230150", "450 A"],
        ])

        self.assertIn("Table title: Electrical specifications", rendered)
        self.assertIn("Model = IC1230150", rendered)

    def test_large_table_chunks_repeat_the_header(self):
        rendered = "[Table]\n" + _table_to_markdown([
            ["Model", "Current"],
            *[[f"IC12{index:04d}", f"{index} A"] for index in range(20)],
        ])
        units = _split_long_unit(rendered, 180)

        self.assertGreater(len(units), 1)
        self.assertTrue(all("Model" in unit and "Current" in unit for unit in units))

    def test_ocr_merge_does_not_duplicate_existing_lines(self):
        merged = _merge_extracted_text(
            "Fuse rating: 450 A",
            "Fuse rating: 450 A\nBattery threshold: >3.0 V",
        )

        self.assertEqual(merged.count("Fuse rating: 450 A"), 1)
        self.assertIn("Battery threshold: >3.0 V", merged)

    def test_section_heading_is_retained_in_chunk_metadata(self):
        chunks = chunk_pages([PdfPage(
            page_number=7,
            text="Electrical Specifications\n\nFuse rating is 450 A.",
        )])

        self.assertEqual(chunks[0].page_number, 7)
        self.assertEqual(chunks[0].section_heading, "Electrical Specifications")

    def test_sparse_vector_drawing_is_treated_as_a_visual_page(self):
        self.assertTrue(_is_visual_page(
            "IC244090i TECHNICAL DRAWINGS",
            large_images=0,
            vector_drawings=20,
        ))

    def test_text_extraction_falls_back_when_layout_mode_fails(self):
        class Page:
            def extract_text(self, **kwargs):
                if kwargs.get("layout"):
                    raise ValueError("bad layout")
                return "Fallback technical text"

        self.assertEqual(_extract_page_text(Page()), "Fallback technical text")

    def test_table_extraction_stops_after_first_successful_strategy(self):
        class Page:
            def __init__(self):
                self.calls = 0

            def extract_tables(self, table_settings):
                self.calls += 1
                return [[
                    ["Model", "Power"],
                    ["SI-300", "300 W"],
                ]]

        page = Page()
        tables = _extract_tables(page)

        self.assertEqual(len(tables), 1)
        self.assertEqual(page.calls, 1)

    def test_long_two_column_prose_is_not_treated_as_a_table(self):
        rows = (
            ("Installation", "This is a very long prose paragraph " * 12),
            ("Operation", "Another long prose paragraph " * 12),
        )

        self.assertFalse(_is_usable_table(rows, borderless=True))

    def test_fragmented_borderless_page_layout_is_not_a_table(self):
        rows = (
            ("S S UN", "AVER"),
            ("PV SYSTEM CO", "NTROLLERS"),
            ("Installation and O", "peration Manual"),
        )

        self.assertFalse(_is_usable_table(rows, borderless=True))

    def test_vision_chunks_are_separate_and_lower_confidence(self):
        chunks = chunk_pages([PdfPage(
            page_number=4,
            text=(
                "Electrical Specifications\n\nContinuous power is 300 W.\n\n"
                "[Visual page extraction]\nFour mounting holes are visible."
            ),
        )])

        self.assertEqual({chunk.evidence_type for chunk in chunks}, {"text", "vision"})
        vision = next(chunk for chunk in chunks if chunk.evidence_type == "vision")
        self.assertLess(vision.evidence_confidence, 1.0)


if __name__ == "__main__":
    unittest.main()
