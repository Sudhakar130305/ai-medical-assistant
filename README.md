# AI Medical Assistant

AI Medical Assistant is a Flask-based web application that helps users interact with medical documents and ask health-related questions using AI. It combines document search, symptom-based responses, and generative AI to provide educational assistance.

This project uses Retrieval-Augmented Generation (RAG), vector embeddings, and Gemini API integration.

---

## Features

- Upload medical PDF files
- Extract and process PDF text
- Ask questions based on uploaded medical documents
- Basic symptom-checking support
- AI-generated responses using Gemini
- Vector search using ChromaDB
- Dockerized deployment support
- Web-based user interface

---

## Tech Stack

### Backend
- Python
- Flask

### AI / NLP
- Sentence Transformers
- Gemini API
- ChromaDB

### Document Processing
- PyPDF

### Deployment
- Docker

### Frontend
- HTML
- CSS
- JavaScript

---

## Project Structure

```text
AI-Medical-Assistant/
│── app.py
│── main.py
│── requirements.txt
│── Dockerfile
│── .gitignore
│── README.md
│── static/
│   ├── index.html
│   ├── style.css
│   └── script.js
│── uploads/


Local Installation (Without Docker)
1. Clone Repository
git clone https://github.com/your-username/ai-medical-assistant.git
cd ai-medical-assistant

2. Create Virtual Environment
python -m venv venv

3. Activate Virtual Environment
Windows
venv\Scripts\activate

Mac/Linux
source venv/bin/activate

4. Install Dependencies
pip install -r requirements.txt

5. Set Environment Variable
Windows PowerShell
$env:GEMINI_API_KEY="your_api_key"

Windows CMD
set GEMINI_API_KEY=your_api_key

Mac/Linux
export GEMINI_API_KEY=your_api_key

6. Run Application
python app.py

7. Open Browser
http://localhost:5000

Docker Installation
1. Build Docker Image
docker build -f static/Dockerfile -t medical-ai-app .

2. Run Docker Container
docker run -d -p 5000:5000 -e GEMINI_API_KEY=your_api_key --name medapp medical-ai-app-fixed python app.py

3. Open Browser
http://localhost:5000

4. Start Existing Container Later
docker start medapp

5. Stop Container
docker stop medapp
