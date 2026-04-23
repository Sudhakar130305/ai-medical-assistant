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
