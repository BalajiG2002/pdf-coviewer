# tests/test_app.py
"""Basic tests for the pdf-coviewer Flask application."""
import io
import os
import sys

import pytest
from PyPDF2 import PdfWriter

# Ensure the project root is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app import app as flask_app, sessions


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def make_minimal_pdf() -> bytes:
    """Create a valid one-page PDF in memory using PyPDF2."""
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture()
def client():
    flask_app.config['TESTING'] = True
    flask_app.config['WTF_CSRF_ENABLED'] = False   # disable CSRF in tests
    # Resolve upload folder relative to the project root (not the CWD)
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    upload_dir = os.path.join(project_root, 'uploads')
    os.makedirs(upload_dir, exist_ok=True)
    flask_app.config['UPLOAD_FOLDER'] = upload_dir
    with flask_app.test_client() as c:
        yield c
    # Clean up any sessions created during this test
    sessions.clear()


# ---------------------------------------------------------------------------
# Route tests
# ---------------------------------------------------------------------------
class TestIndexRoute:
    def test_index_returns_200(self, client):
        """GET / should return 200 and create a session."""
        response = client.get('/')
        assert response.status_code == 200

    def test_index_creates_session(self, client):
        """GET / should add a new entry to the sessions dict."""
        initial_count = len(sessions)
        client.get('/')
        assert len(sessions) == initial_count + 1


class TestJoinRoute:
    def test_join_invalid_session_returns_404(self, client):
        """Joining a non-existent session should return 404."""
        response = client.get('/join/nonexistent-session-id')
        assert response.status_code == 404

    def test_join_valid_session_returns_200(self, client):
        """Joining an existing session should return 200."""
        client.get('/')  # creates a session
        session_id = list(sessions.keys())[-1]
        response = client.get(f'/join/{session_id}')
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# Upload tests
# ---------------------------------------------------------------------------
class TestUploadRoute:
    def _upload(self, client, file_bytes, filename, session_id, content_type='application/pdf'):
        return client.post(
            '/upload',
            data={
                'pdf': (io.BytesIO(file_bytes), filename, content_type),
                'session_id': session_id,
            },
            content_type='multipart/form-data',
        )

    def test_upload_valid_pdf_returns_200(self, client):
        """Uploading a valid PDF should return 200 with success and total_pages."""
        client.get('/')
        session_id = list(sessions.keys())[-1]
        response = self._upload(client, make_minimal_pdf(), 'test.pdf', session_id)
        assert response.status_code == 200
        data = response.get_json()
        assert data.get('success') is True
        assert 'total_pages' in data

    def test_upload_stores_session_url(self, client):
        """Upload response should include a session_url."""
        client.get('/')
        session_id = list(sessions.keys())[-1]
        response = self._upload(client, make_minimal_pdf(), 'test.pdf', session_id)
        data = response.get_json()
        assert 'session_url' in data

    def test_upload_invalid_extension_returns_400(self, client):
        """Uploading a file with a non-.pdf extension should return 400."""
        client.get('/')
        session_id = list(sessions.keys())[-1]
        response = self._upload(client, b'some text', 'notes.txt', session_id, 'text/plain')
        assert response.status_code == 400
        assert 'error' in response.get_json()

    def test_upload_wrong_magic_bytes_returns_400(self, client):
        """A .pdf file whose content is not a real PDF should return 400."""
        client.get('/')
        session_id = list(sessions.keys())[-1]
        response = self._upload(client, b'NOT A REAL PDF CONTENT', 'fake.pdf', session_id)
        assert response.status_code == 400
        data = response.get_json()
        assert 'error' in data

    def test_upload_invalid_session_returns_400(self, client):
        """Uploading to an unknown session should return 400."""
        response = self._upload(
            client, make_minimal_pdf(), 'test.pdf', 'invalid-session-id'
        )
        assert response.status_code == 400
        assert 'error' in response.get_json()

    def test_upload_no_file_returns_400(self, client):
        """Posting without a file attachment should return 400."""
        client.get('/')
        session_id = list(sessions.keys())[-1]
        response = client.post(
            '/upload',
            data={'session_id': session_id},
            content_type='multipart/form-data',
        )
        assert response.status_code == 400

    def test_upload_no_session_id_returns_400(self, client):
        """Posting without a session_id should return 400."""
        response = client.post(
            '/upload',
            data={'pdf': (io.BytesIO(make_minimal_pdf()), 'test.pdf', 'application/pdf')},
            content_type='multipart/form-data',
        )
        assert response.status_code == 400


# ---------------------------------------------------------------------------
# PDF magic-bytes validator unit test
# ---------------------------------------------------------------------------
class TestValidatePdfMagicBytes:
    def test_valid_pdf_stream(self):
        from utils.validators import validate_pdf_magic_bytes
        stream = io.BytesIO(b'%PDF-1.4 rest of file')
        assert validate_pdf_magic_bytes(stream) is True
        assert stream.read(5) == b'%PDF-'  # stream rewound to 0

    def test_invalid_stream(self):
        from utils.validators import validate_pdf_magic_bytes
        stream = io.BytesIO(b'NOTPDF content')
        assert validate_pdf_magic_bytes(stream) is False

    def test_empty_stream(self):
        from utils.validators import validate_pdf_magic_bytes
        stream = io.BytesIO(b'')
        assert validate_pdf_magic_bytes(stream) is False
