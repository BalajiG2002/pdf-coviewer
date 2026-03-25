# 📚 PDF Co-Viewer

> A real-time collaborative PDF viewer built with Flask and Socket.IO

## ✨ Features

- 🔄 Real-time PDF synchronization
- 👥 Multi-user support with presenter/viewer roles
- 🔍 Zoom controls for better readability
- 🔗 Shareable session links
- 📱 Responsive design
- 🎯 Simple and intuitive interface
- 🔒 Secure file validation with size limits and content checks

## 🚀 Tech Stack

- **Backend:**
  - Flask
  - Flask-SocketIO
  - PyPDF2

- **Frontend:**
  - Socket.IO Client
  - PDF.js
  - Vanilla JavaScript
  - Modern CSS
Upload video of application 

https://github.com/user-attachments/assets/6733531b-4f21-402d-a84a-ac9194118593

## 📋 Prerequisites

Before you begin, ensure you have met the following requirements:
- Python 3.x
- Modern web browser with WebSocket support
- pip (Python package manager)

## ⚙️ Installation

1. Clone the repository:
```bash
git clone https://github.com/BalajiG2002/pdf-co-viewer.git
cd pdf-co-viewer
```

2. Create and activate a virtual environment:
```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

3. Install required packages:
```bash
pip install flask flask-socketio PyPDF2
```



## 🏃‍♂️ Running the Application

1. Start the server:
```bash
python app.py
```

2. Open your browser and navigate to:
```
http://localhost:5000
```

## 📖 How to Use

1. **As a Presenter:**
   - Visit the home page
   - Upload a PDF file
   - Share the generated URL with viewers
   - Navigate through pages using controls
   - Adjust zoom level as needed

2. **As a Viewer:**
   - Click the shared session URL
   - View the PDF in sync with the presenter
   - Adjust zoom level independently

## 🔧 Project Structure
```
pdf-co-viewer/
├── app.py              # Main Flask application
├── static/
│   ├── script.js      # Frontend JavaScript
│   └── style.css      # Styling
├── templates/
│   └── index.html     # Main template
├── utils/
│   ├── __init__.py    # Package init
│   ├── session_manager.py  # Session/session-user state management
│   └── validators.py  # File validation utilities
└── uploads/           # PDF storage (auto-created)
```

## 🔒 Security & Validation

The following validation checks are performed on every PDF upload:

- **File size limit**: Uploads are rejected if the file exceeds **50 MB**. Flask's `MAX_CONTENT_LENGTH` enforces this at the server level and returns a clear 413 error.
- **PDF magic bytes check**: The first 5 bytes of each file are read and compared against the PDF signature (`%PDF-`). Non-PDF files are rejected with an informative error message.
- **Filename sanitization**: All uploaded filenames are sanitized using `werkzeug.utils.secure_filename` to prevent path traversal and other filename-based attacks.
- **Extension validation**: Only files with a `.pdf` extension are accepted.

These checks are implemented in `utils/validators.py` and called from the `/upload` route in `app.py`.

## 📝 Recent Changes

### File Validation & Size Limits (Security Hardening)

- Added `utils/validators.py` with reusable validation helpers:
  - `validate_file_size()` — rejects empty files and files over 50 MB
  - `validate_pdf_content()` — checks PDF magic bytes (`b'%PDF-'`)
  - `validate_filename()` — sanitizes filename and enforces `.pdf` extension
  - `validate_pdf_upload()` — orchestrates all checks and returns `(is_valid, error_message)`
- Updated `app.py`:
  - Added `MAX_CONTENT_LENGTH = 50 * 1024 * 1024` (50 MB)
  - Added `@app.errorhandler(413)` to return a JSON error for oversized requests
  - Integrated `validate_pdf_upload()` into the `/upload` route before saving the file

## 💡 Key Features Explained

- **Real-time Synchronization:** Using Socket.IO for instant page changes
- **Role Management:** Automatic presenter/viewer role assignment
- **Session Management:** Unique session IDs for each presentation
- **Responsive Design:** Works on various screen sizes
- **Error Handling:** Robust error messages and loading states

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch:
```bash
git checkout -b feature/AmazingFeature
```
3. Commit your changes:
```bash
git commit -m '✨ Add some amazing feature'
```
4. Push to the branch:
```bash
git push origin feature/AmazingFeature
```
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👏 Acknowledgments

- PDF.js for PDF rendering
- Socket.IO for real-time communication
- Flask community for the amazing framework

## 📫 Contact

adithya8112002@gmail.com

---

⭐️ Star this repo if you find it helpful!
