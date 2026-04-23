import os
import uuid
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from main import ingest_pdf, answer_query, check_symptoms, collection

app = Flask(__name__, static_folder="static")
app.config["UPLOAD_FOLDER"] = os.path.join(os.path.dirname(__file__), "uploads")
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50MB max

os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

# Track uploaded files for the UI
uploaded_files = []


@app.route("/")
def index():
    return send_from_directory("static", "index.html")


@app.route("/upload", methods=["POST"])
def upload_pdf():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are allowed"}), 400

    filename = secure_filename(file.filename)
    # Add unique prefix to avoid collisions
    unique_name = f"{uuid.uuid4().hex[:8]}_{filename}"
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], unique_name)
    file.save(filepath)

    try:
        ingest_pdf(filepath)
        uploaded_files.append({
            "name": filename,
            "path": filepath,
            "id": unique_name
        })
        return jsonify({
            "message": f"'{filename}' uploaded and processed into medical knowledge base!",
            "filename": filename
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/ask", methods=["POST"])
def ask_question():
    data = request.get_json()
    query = data.get("question", "").strip()

    if not query:
        return jsonify({"error": "Please enter a question"}), 400

    try:
        answer, sources, confidence, severity = answer_query(query)

        response = {
            "answer": answer,
            "sources": list(set(sources)) if sources else [],
            "confidence": round(confidence, 2) if confidence is not None else None,
            "mode": "RAG" if sources else "Gemini",
            "severity": severity
        }
        return jsonify(response)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/symptom-check", methods=["POST"])
def symptom_check():
    """Dedicated endpoint for symptom analysis."""
    data = request.get_json()
    symptoms = data.get("symptoms", "").strip()

    if not symptoms:
        return jsonify({"error": "Please describe your symptoms"}), 400

    try:
        answer, sources, confidence, severity = check_symptoms(symptoms)

        response = {
            "answer": answer,
            "sources": list(set(sources)) if sources else [],
            "confidence": round(confidence, 2) if confidence is not None else None,
            "mode": "RAG" if sources else "Gemini",
            "severity": severity
        }
        return jsonify(response)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/files", methods=["GET"])
def list_files():
    return jsonify({"files": uploaded_files})


@app.route("/clear", methods=["POST"])
def clear_chat():
    """Endpoint to clear chat history (client-side only, but provides confirmation)"""
    return jsonify({"message": "Chat cleared"})


@app.route("/stats", methods=["GET"])
def get_stats():
    """Return stats about the medical knowledge base"""
    try:
        count = collection.count()
        return jsonify({
            "chunks": count,
            "files": len(uploaded_files)
        })
    except Exception:
        return jsonify({"chunks": 0, "files": 0})

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
