"""File validation utilities for pdf-coviewer."""


def validate_pdf_magic_bytes(file_stream) -> bool:
    """Return True if *file_stream* starts with the PDF magic bytes (``%PDF-``).

    The stream position is restored to 0 after the check so callers can
    continue reading or saving the file normally.
    """
    header = file_stream.read(5)
    file_stream.seek(0)
    return header == b'%PDF-'
