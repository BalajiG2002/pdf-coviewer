# 📄 PDF Co-Viewer App 🚀

Welcome to the **PDF Co-Viewer App**! This web application allows multiple users to view and navigate through a PDF file simultaneously. The app is built using **Python**, **WebSockets**, **HTML**, **CSS**, and **JavaScript** for real-time synchronization of page movements. The app is designed for presenters and viewers in a collaborative setting where an admin can control the PDF's page display, while viewers see the same content in real-time.

## Features ✨

- 📑 **Real-Time PDF Viewing**: Upload a PDF and allow multiple users to view it in sync.
- 🔄 **Page Synchronization**: When the admin moves the PDF page, all viewers see the same page.
- 👥 **Multiple Viewers**: Viewers can access the PDF using a shared link and follow along as the admin controls the presentation.
- 🖥️ **Admin Controls**: Admin users can control the PDF page movements (next/previous page).
- 🔒 **Session-Based**: Each session is unique, and only authorized users can control the PDF page movements.
- 👀 **Minimal UI**: Simple, user-friendly interface for both admins and viewers.

## 💻 Technologies Used

- **Python**: Backend logic, including PDF handling and WebSocket integration.
- **WebSockets**: Real-time communication for page synchronization and session management.
- **pdf.js**: Rendering PDF pages in the browser.
- **HTML/CSS/JavaScript**: Front-end interface and interactivity.

## 🚀 Getting Started

Follow the steps below to set up and run the PDF Co-Viewer app locally.

### Prerequisites 📦

1. **Python 3.x**: Ensure you have Python 3 installed. You can download it from [here](https://www.python.org/downloads/).
2. **WebSocket Library**: Install the WebSocket library for Python.
    ```bash
    pip install python-socketio
    ```
3. **pdf.js**: Used for rendering PDFs on the client-side.

### Installation Steps 🛠️

1. Clone the repository to your local machine:
    ```bash
    git clone https://github.com/yourusername/pdf-coviewer.git
    cd pdf-coviewer
    ```

2. Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```

3. Run the app:
    ```bash
    python app.py
    ```

4. Open the URL provided by the terminal (usually `http://localhost:5000`) in your browser.

### Usage 📝

1. **As an Admin**:
    - Upload a PDF file and share the session link with others.
    - Use the **Next** and **Previous** buttons to navigate through the PDF. The page will synchronize for all connected viewers.

2. **As a Viewer**:
    - Click the session link shared by the admin.
    - Follow along as the admin changes the pages in the PDF.

### Screenshots 📸

![PDF Co-Viewer](images/screenshot.png)

## 👨‍💻 Contributing

We welcome contributions! If you'd like to improve the app or fix bugs, feel free to fork the repo and submit a pull request. Please make sure to follow the code style and write tests for any new features.

### Steps to Contribute:
1. Fork the repo.
2. Clone your fork locally.
3. Create a new branch for your changes.
4. Commit your changes and push to your fork.
5. Create a pull request to merge your changes into the main repo.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Contact

For any queries or feedback, feel free to open an issue or reach out at [adithya8112002@gmail.com].

---

Happy PDF Viewing! 🎉
