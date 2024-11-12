# app.py
from flask import Flask, render_template, request, jsonify, send_file, url_for
from flask_socketio import SocketIO, emit, join_room, leave_room
from werkzeug.utils import secure_filename
import os
import PyPDF2
import uuid
import json

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
app.config['UPLOAD_FOLDER'] = 'uploads'
socketio = SocketIO(app, cors_allowed_origins="*")

# Store sessions and their states
sessions = {}

def create_session():
    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        'current_page': 1,
        'total_pages': 1,
        'pdf_path': None,
        'admin_sid': None,
        'connected_users': {},
        'created_at': None
    }
    return session_id

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
    
    if file and file.filename.endswith('.pdf'):
        filename = secure_filename(f"{session_id}_{file.filename}")
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        with open(filepath, 'rb') as pdf_file:
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            total_pages = len(pdf_reader.pages)
        
        sessions[session_id]['pdf_path'] = filepath
        sessions[session_id]['total_pages'] = total_pages
        sessions[session_id]['current_page'] = 1
        
        return jsonify({
            'success': True,
            'total_pages': total_pages,
            'session_url': url_for('join_session', session_id=session_id, _external=True)
        })
    
    return jsonify({'error': 'Invalid file type'}), 400

@app.route('/pdf/<session_id>')
def get_pdf(session_id):
    if session_id not in sessions or not sessions[session_id]['pdf_path']:
        return "PDF not found", 404
    return send_file(sessions[session_id]['pdf_path'])

@socketio.on('join_session')
def handle_join_session(data):
    session_id = data['session_id']
    is_admin = data.get('is_admin', False)
    
    if session_id not in sessions:
        return
    
    join_room(session_id)
    user_id = request.sid
    
    if is_admin and not sessions[session_id]['admin_sid']:
        sessions[session_id]['admin_sid'] = user_id
    
    sessions[session_id]['connected_users'][user_id] = {
        'is_admin': user_id == sessions[session_id]['admin_sid'],
        'page': sessions[session_id]['current_page']
    }
    
    # Send current state to new user
    emit('session_state', {
        'current_page': sessions[session_id]['current_page'],
        'total_pages': sessions[session_id]['total_pages'],
        'is_admin': sessions[session_id]['admin_sid'] == user_id,
        'user_count': len(sessions[session_id]['connected_users'])
    })
    
    # Notify others
    emit('user_joined', {
        'user_count': len(sessions[session_id]['connected_users'])
    }, room=session_id)

@socketio.on('change_page')
def handle_page_change(data):
    session_id = data['session_id']
    new_page = data['page']
    
    if (session_id not in sessions or 
        request.sid != sessions[session_id]['admin_sid'] or 
        not 1 <= new_page <= sessions[session_id]['total_pages']):
        return
    
    sessions[session_id]['current_page'] = new_page
    emit('page_changed', {'page': new_page}, room=session_id)

@socketio.on('disconnect')
def handle_disconnect():
    for session_id, session in sessions.items():
        if request.sid in session['connected_users']:
            del session['connected_users'][request.sid]
            if request.sid == session['admin_sid']:
                session['admin_sid'] = next(iter(session['connected_users'])) if session['connected_users'] else None
            emit('user_left', {
                'user_count': len(session['connected_users']),
                'new_admin': session['admin_sid']
            }, room=session_id)
            break

if __name__ == '__main__':
    os.makedirs('uploads', exist_ok=True)
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
