# app.py
import logging
import os
import threading
import uuid
from datetime import datetime

import PyPDF2
from flask import Flask, jsonify, render_template, request, send_file, url_for
from flask_socketio import SocketIO, emit, join_room
from flask_wtf.csrf import CSRFProtect
from werkzeug.utils import secure_filename

from utils.validators import validate_pdf_magic_bytes

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s: %(message)s',
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App configuration
# ---------------------------------------------------------------------------
app = Flask(__name__)
# Use SECRET_KEY env-var in production; fall back to a static dev value.
_DEFAULT_SECRET = 'dev-only-change-me-in-production'
_secret_key = os.environ.get('SECRET_KEY', _DEFAULT_SECRET)
if _secret_key == _DEFAULT_SECRET:
    logging.warning(
        "SECRET_KEY is not set — using insecure default. "
        "Set the SECRET_KEY environment variable in production."
    )
app.config['SECRET_KEY'] = _secret_key
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50 MB upload limit

csrf = CSRFProtect(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# ---------------------------------------------------------------------------
# In-memory session store
# ---------------------------------------------------------------------------
sessions = {}

# Session lifetime before automatic cleanup (seconds)
SESSION_TTL_SECONDS = 3600        # 1 hour
CLEANUP_INTERVAL_SECONDS = 300    # run cleanup every 5 minutes


def create_session() -> str:
    """Create a new session entry and return its ID."""
    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        'current_page': 1,
        'total_pages': 1,
        'pdf_path': None,
        'admin_sid': None,
        'connected_users': {},
        'created_at': datetime.now(),
        'chat_messages': [],          # last 50 messages
    }
    logger.info("Created session %s", session_id)
    return session_id


# ---------------------------------------------------------------------------
# Background session-cleanup (Task 1.2)
# ---------------------------------------------------------------------------
def cleanup_expired_sessions() -> None:
    """Delete sessions (and their PDF files) older than SESSION_TTL_SECONDS."""
    now = datetime.now()
    expired = [
        sid for sid, session in sessions.items()
        if session.get('created_at') and
        (now - session['created_at']).total_seconds() > SESSION_TTL_SECONDS
    ]
    for sid in expired:
        pdf_path = sessions[sid].get('pdf_path')
        if pdf_path and os.path.exists(pdf_path):
            os.remove(pdf_path)
            logger.info("Deleted PDF for expired session %s: %s", sid, pdf_path)
        del sessions[sid]
        logger.info("Cleaned up expired session %s", sid)
    if expired:
        logger.info("Cleanup removed %d expired session(s)", len(expired))

    # Schedule the next run
    timer = threading.Timer(CLEANUP_INTERVAL_SECONDS, cleanup_expired_sessions)
    timer.daemon = True
    timer.start()


# Start the background cleanup loop on first import
cleanup_expired_sessions()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.route('/')
def index():
    session_id = create_session()
    return render_template('index.html', session_id=session_id, is_admin=True)


@app.route('/join/<session_id>')
def join_session(session_id):
    if session_id not in sessions:
        return "Session not found", 404
    return render_template('index.html', session_id=session_id, is_admin=False)


@app.route('/upload', methods=['POST'])
def upload_pdf():
    if 'pdf' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['pdf']
    session_id = request.form.get('session_id')

    if not session_id or session_id not in sessions:
        return jsonify({'error': 'Invalid session'}), 400

    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    # Extension check
    if not file.filename.lower().endswith('.pdf'):
        return jsonify({'error': 'Invalid file type. Only PDF files are allowed.'}), 400

    # Magic-bytes validation (Task 1.1)
    if not validate_pdf_magic_bytes(file):
        return jsonify({'error': 'Invalid PDF file (magic bytes check failed).'}), 400

    filename = secure_filename(f"{session_id}_{file.filename}")
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    logger.info("Uploaded PDF for session %s: %s", session_id, filename)

    try:
        with open(filepath, 'rb') as pdf_file:
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            total_pages = len(pdf_reader.pages)
    except Exception as exc:
        os.remove(filepath)
        logger.error("Failed to read PDF for session %s: %s", session_id, exc)
        return jsonify({'error': 'Could not read PDF. The file may be corrupted.'}), 400

    sessions[session_id]['pdf_path'] = filepath
    sessions[session_id]['total_pages'] = total_pages
    sessions[session_id]['current_page'] = 1

    return jsonify({
        'success': True,
        'total_pages': total_pages,
        'session_url': url_for('join_session', session_id=session_id, _external=True),
    })


@app.errorhandler(413)
def request_entity_too_large(e):
    return jsonify({'error': 'File too large. Maximum allowed size is 50 MB.'}), 413


@app.route('/pdf/<session_id>')
def get_pdf(session_id):
    if session_id not in sessions or not sessions[session_id]['pdf_path']:
        return "PDF not found", 404
    return send_file(sessions[session_id]['pdf_path'])


# ---------------------------------------------------------------------------
# Socket.IO events
# ---------------------------------------------------------------------------
@socketio.on('join_session')
def handle_join_session(data):
    session_id = data.get('session_id')
    is_admin = data.get('is_admin', False)

    if not session_id or session_id not in sessions:
        return

    join_room(session_id)
    user_id = request.sid

    if is_admin and not sessions[session_id]['admin_sid']:
        sessions[session_id]['admin_sid'] = user_id

    sessions[session_id]['connected_users'][user_id] = {
        'is_admin': user_id == sessions[session_id]['admin_sid'],
        'page': sessions[session_id]['current_page'],
    }
    logger.info("User %s joined session %s", user_id, session_id)

    # Send current state (including recent chat history) to the joining user
    emit('session_state', {
        'current_page': sessions[session_id]['current_page'],
        'total_pages': sessions[session_id]['total_pages'],
        'is_admin': sessions[session_id]['admin_sid'] == user_id,
        'user_count': len(sessions[session_id]['connected_users']),
        'chat_history': sessions[session_id]['chat_messages'],
    })

    # Notify everyone else in the room
    emit('user_joined', {
        'user_count': len(sessions[session_id]['connected_users']),
    }, room=session_id)


@socketio.on('change_page')
def handle_page_change(data):
    session_id = data.get('session_id')
    new_page = data.get('page')

    if (not session_id or session_id not in sessions
            or request.sid != sessions[session_id]['admin_sid']
            or not isinstance(new_page, int)
            or not 1 <= new_page <= sessions[session_id]['total_pages']):
        return

    sessions[session_id]['current_page'] = new_page
    logger.info("Session %s page → %d", session_id, new_page)
    emit('page_changed', {'page': new_page}, room=session_id)


@socketio.on('pointer_move')
def handle_pointer_move(data):
    """Broadcast presenter laser-pointer coordinates to other viewers (Task 3.2)."""
    session_id = data.get('session_id')
    if not session_id or session_id not in sessions:
        return
    if request.sid != sessions[session_id]['admin_sid']:
        return
    emit('pointer_update', {
        'x': data.get('x'),
        'y': data.get('y'),
        'page': data.get('page'),
    }, room=session_id, include_self=False)


@socketio.on('send_chat')
def handle_chat(data):
    """Relay a chat message to all users in the session (Task 3.3)."""
    session_id = data.get('session_id')
    if not session_id or session_id not in sessions:
        return

    message = (data.get('message') or '').strip()
    if not message:
        return

    chat_message = {
        'user': (data.get('user') or 'Anonymous')[:50],
        'message': message[:500],
        'timestamp': datetime.now().isoformat(),
    }

    # Keep only the last 50 messages
    sessions[session_id]['chat_messages'].append(chat_message)
    if len(sessions[session_id]['chat_messages']) > 50:
        sessions[session_id]['chat_messages'].pop(0)

    emit('receive_chat', chat_message, room=session_id)


@socketio.on('disconnect')
def handle_disconnect():
    for session_id, session in sessions.items():
        if request.sid in session['connected_users']:
            del session['connected_users'][request.sid]
            if request.sid == session['admin_sid']:
                session['admin_sid'] = (
                    next(iter(session['connected_users']))
                    if session['connected_users'] else None
                )
            logger.info("User %s left session %s", request.sid, session_id)
            emit('user_left', {
                'user_count': len(session['connected_users']),
                'new_admin': session['admin_sid'],
            }, room=session_id)
            break


if __name__ == '__main__':
    os.makedirs('uploads', exist_ok=True)
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)

