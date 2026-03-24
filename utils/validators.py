"""
File validation utilities for PDF uploads
"""
import os
from werkzeug.utils import secure_filename

# Maximum file size: 50MB in bytes
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

# PDF magic bytes signature
PDF_MAGIC_BYTES = b'%PDF-'


class ValidationError(Exception):
    """Custom exception for validation errors"""
    pass


def validate_file_size(file):
    """
    Validate that file size is within acceptable limits.

    Args:
        file: FileStorage object from Flask request

    Returns:
        bool: True if valid

    Raises:
        ValidationError: If file is too large
    """
    # Seek to end to get file size
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)  # Reset to beginning

    if file_size > MAX_FILE_SIZE:
        size_mb = file_size / (1024 * 1024)
        raise ValidationError(
            f"File too large ({size_mb:.1f}MB). Maximum allowed size is 50MB."
        )

    if file_size == 0:
        raise ValidationError("File is empty.")

    return True


def validate_pdf_content(file):
    """
    Validate that file is actually a PDF by checking magic bytes.

    Args:
        file: FileStorage object from Flask request

    Returns:
        bool: True if valid PDF

    Raises:
        ValidationError: If file is not a valid PDF
    """
    # Read first 5 bytes to check PDF signature
    file.seek(0)
    header = file.read(5)
    file.seek(0)  # Reset to beginning

    if header != PDF_MAGIC_BYTES:
        raise ValidationError(
            "Invalid file format. File must be a valid PDF document."
        )

    return True


def validate_filename(filename):
    """
    Sanitize and validate filename.

    Args:
        filename: Original filename string

    Returns:
        str: Sanitized filename

    Raises:
        ValidationError: If filename is invalid
    """
    if not filename:
        raise ValidationError("No filename provided.")

    # Use werkzeug's secure_filename to sanitize
    safe_filename = secure_filename(filename)

    if not safe_filename:
        raise ValidationError("Invalid filename. Please use a valid filename.")

    # Check if it has .pdf extension
    if not safe_filename.lower().endswith('.pdf'):
        raise ValidationError("File must have .pdf extension.")

    return safe_filename


def validate_pdf_upload(file):
    """
    Comprehensive validation for PDF uploads.
    Checks file size, content, and filename.

    Args:
        file: FileStorage object from Flask request

    Returns:
        tuple: (is_valid, error_message)
            is_valid (bool): True if all validations pass
            error_message (str): Error message if validation fails, None if valid
    """
    try:
        # Validate filename
        if not file.filename:
            return False, "No file selected."

        validate_filename(file.filename)

        # Validate file size
        validate_file_size(file)

        # Validate PDF content
        validate_pdf_content(file)

        return True, None

    except ValidationError as e:
        return False, str(e)
    except Exception as e:
        return False, f"Validation error: {str(e)}"
