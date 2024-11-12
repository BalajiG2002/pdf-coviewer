# 📚 PDF Co-Viewer

> A real-time collaborative PDF viewer built with Flask and Socket.IO

## ✨ Features

- 🔄 Real-time PDF synchronization
- 👥 Multi-user support with presenter/viewer roles
- 🔍 Zoom controls for better readability
- 🔗 Shareable session links
- 📱 Responsive design
- 🎯 Simple and intuitive interface

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

## 📋 Prerequisites

Before you begin, ensure you have met the following requirements:
- Python 3.x
- Modern web browser with WebSocket support
- pip (Python package manager)

## ⚙️ Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/pdf-co-viewer.git
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
└── uploads/           # PDF storage (auto-created)
```

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
