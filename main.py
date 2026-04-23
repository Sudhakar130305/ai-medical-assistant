import os
from pypdf import PdfReader
from sentence_transformers import SentenceTransformer
import chromadb
from chromadb.config import Settings
from google import genai

# ---------------- CONFIG ----------------
# Use env var GEMINI_API_KEY if set, otherwise fall back to hardcoded key
API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyC9ZZAyO8pv8K0mIC6HUiXPWZOq0biXR8g")
client_ai = genai.Client(api_key=API_KEY)

model = SentenceTransformer('all-MiniLM-L6-v2')

client = chromadb.Client(Settings(persist_directory="./chroma_db"))
collection = client.get_or_create_collection("medical_knowledge_base")

# ---------------- MEDICAL DISCLAIMER ----------------
MEDICAL_DISCLAIMER = """

---
⚠️ **Medical Disclaimer**: This information is for educational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of a qualified healthcare provider with any questions you may have regarding a medical condition. Never disregard professional medical advice or delay seeking it because of something you have read here. If you think you may have a medical emergency, call your doctor or emergency services immediately."""

# ---------------- AUTO MODEL DETECTION ----------------
def get_available_model():
    try:
        models = [m.name for m in client_ai.models.list()]
        
        # priority order
        for m in [
            "models/gemini-2.5-flash",
            "models/gemini-2.5-pro",
            "models/gemini-2.0-flash-lite",
            "models/gemini-1.5-pro",
            "models/gemini-1.5-flash",
        ]:
            if m in models:
                return m
        
        return models[0] if models else None

    except Exception as e:
        print("Model fetch failed:", e)
        return None

MODEL_NAME = get_available_model()
print(f"\nUsing model: {MODEL_NAME}\n")

# ---------------- PDF LOADER ----------------
def load_pdf(file_path):
    reader = PdfReader(file_path)
    pages = []

    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        if text:
            pages.append((text, i))

    return pages

# ---------------- CHUNKING ----------------
def chunk_text(text, size=500, overlap=100):
    chunks = []
    start = 0

    while start < len(text):
        chunks.append(text[start:start+size])
        start += size - overlap

    return chunks

# ---------------- INGESTION ----------------
def ingest_pdf(file_path):
    print("Processing medical document...")

    pages = load_pdf(file_path)

    all_chunks = []
    metadatas = []
    ids = []

    # Extract just the filename for cleaner source display
    source_name = os.path.basename(file_path)

    for text, page_num in pages:
        chunks = chunk_text(text)

        for i, chunk in enumerate(chunks):
            all_chunks.append(chunk)
            metadatas.append({
                "source": source_name,
                "page": page_num + 1  # 1-indexed for display
            })
            ids.append(f"{file_path}_{page_num}_{i}")

    print("Embedding medical content...")

    embeddings = model.encode(all_chunks).tolist()

    collection.add(
        documents=all_chunks,
        embeddings=embeddings,
        metadatas=metadatas,
        ids=ids
    )

    print(f"Ingested {len(all_chunks)} chunks into medical knowledge base.\n")

# ---------------- RETRIEVAL ----------------
def retrieve(query, k=5):
    query_embedding = model.encode([query]).tolist()

    results = collection.query(
        query_embeddings=query_embedding,
        n_results=k,
        include=["documents", "metadatas", "distances"]
    )

    return results

# ---------------- MEDICAL RAG PROMPT ----------------
def build_prompt(context, query):
    return f"""You are MedAssist AI, a professional medical AI assistant. You provide accurate, evidence-based medical information using ONLY the provided medical literature and documents.

**Response Guidelines:**
1. Structure your response clearly with these sections when relevant:
   - **Overview**: Brief summary of the condition/topic
   - **Symptoms**: Key symptoms to watch for
   - **Possible Causes**: Evidence-based causes or risk factors
   - **Recommended Actions**: What steps to consider
   - **When to See a Doctor**: Red flags that require immediate medical attention

2. For medication queries, include:
   - Drug name (generic and brand)
   - Common dosage information from the literature
   - Known side effects
   - Drug interactions if mentioned in the documents

3. Use **bold** for medical terms and key findings
4. Use bullet points for symptoms and recommendations
5. Cite the source document and page number for every claim
6. If information is incomplete, clearly state what is and isn't covered in the documents
7. Assign a severity indicator when discussing conditions:
   - 🟢 **Mild** — Generally manageable with self-care
   - 🟡 **Moderate** — May require medical consultation
   - 🔴 **Severe** — Seek immediate medical attention

If the information is not found in the provided medical documents, say "I couldn't find this specific information in the uploaded medical literature. Please consult a healthcare professional for personalized advice."

Context from medical literature:
{context}

Patient/User Question: {query}

Medical Assessment:"""

# ---------------- MEDICAL GENERAL PROMPT ----------------
def build_general_prompt(query):
    return f"""You are MedAssist AI, a knowledgeable medical AI assistant. Answer the following health-related question using your general medical knowledge.

**Important Guidelines:**
- Provide accurate, evidence-based medical information
- Structure responses clearly with relevant sections (Overview, Symptoms, Causes, Actions, When to See a Doctor)
- Use **bold** for key medical terms
- Use bullet points for lists of symptoms, medications, or recommendations
- Include severity indicators when discussing conditions:
  - 🟢 **Mild** — Generally manageable with self-care
  - 🟡 **Moderate** — May require medical consultation  
  - 🔴 **Severe** — Seek immediate medical attention
- Be thorough but concise
- Do NOT diagnose — provide general information only
- Always recommend consulting a healthcare professional for personalized advice

Question: {query}

Medical Information:"""

# ---------------- SYMPTOM CHECK PROMPT ----------------
def build_symptom_prompt(context, symptoms):
    return f"""You are MedAssist AI, a medical AI assistant specializing in symptom analysis. Based on the provided medical literature, analyze the described symptoms.

**Your analysis should include:**
1. **Reported Symptoms**: List the symptoms described
2. **Possible Conditions**: What conditions these symptoms may be associated with (based on the medical literature)
3. **Severity Assessment**: 
   - 🟢 **Mild** — Likely manageable with self-care and monitoring
   - 🟡 **Moderate** — Medical consultation recommended
   - 🔴 **Severe** — Seek immediate medical attention
4. **Recommended Next Steps**: What the patient should consider doing
5. **Red Flags**: Any warning signs that require emergency care

**Important**: This is NOT a diagnosis. Only a qualified healthcare provider can diagnose conditions.

Cite the source document and page number for claims from the literature.
 
Medical Literature Context:
{context}

Reported Symptoms: {symptoms}

Symptom Analysis:"""

# ---------------- GEMINI ----------------
def ask_gemini(prompt):
    if not MODEL_NAME:
        return "No valid model available. Please check your API key."

    try:
        response = client_ai.models.generate_content(
            model=MODEL_NAME,
            contents=prompt
        )
        return response.text

    except Exception as e:
        print("\n⚠️ Gemini API failed:", e)
        return f"LLM unavailable: {str(e)}"

# ---------------- SEVERITY DETECTION ----------------
def detect_severity(answer):
    """Detect severity level from the AI response content."""
    answer_lower = answer.lower()
    
    if any(term in answer_lower for term in ["🔴", "severe", "emergency", "immediately", "call 911", "life-threatening", "urgent"]):
        return "severe"
    elif any(term in answer_lower for term in ["🟡", "moderate", "consult", "medical attention", "see a doctor"]):
        return "moderate"
    elif any(term in answer_lower for term in ["🟢", "mild", "self-care", "rest", "manageable"]):
        return "mild"
    
    return None

# ---------------- MAIN QUERY LOGIC ----------------
def answer_query(query):
    results = retrieve(query)

    # Empty DB case — no documents ingested at all
    if not results["documents"] or len(results["documents"][0]) == 0:
        print("\nNo medical documents found. Using Gemini general medical mode...\n")
        prompt = build_general_prompt(query)
        answer = ask_gemini(prompt)
        answer += MEDICAL_DISCLAIMER
        severity = detect_severity(answer)
        return answer, [], None, severity

    top_distance = results["distances"][0][0]
    print(f"\nTop match distance: {top_distance}")

    # Use a generous threshold — ChromaDB L2 distances can be large.
    # Anything under 1.5 is considered a relevant match.
    if top_distance < 1.5:
        print("Using Medical RAG mode...\n")

        docs = results["documents"][0]
        metas = results["metadatas"][0]

        context = ""
        sources = []

        for d, m in zip(docs, metas):
            context += d + "\n\n"
            sources.append(f"{m['source']} (page {m['page']})")

        prompt = build_prompt(context, query)
        answer = ask_gemini(prompt)
        answer += MEDICAL_DISCLAIMER

        # Normalize confidence: clamp between 0 and 1
        confidence = max(0, min(1, 1 - (top_distance / 1.5)))
        severity = detect_severity(answer)
        return answer, sources, confidence, severity

    else:
        print(f"Distance {top_distance} too high. Using Gemini medical fallback...\n")
        prompt = build_general_prompt(query)
        answer = ask_gemini(prompt)
        answer += MEDICAL_DISCLAIMER
        severity = detect_severity(answer)
        return answer, [], None, severity

# ---------------- SYMPTOM CHECK LOGIC ----------------
def check_symptoms(symptoms):
    results = retrieve(symptoms)

    if not results["documents"] or len(results["documents"][0]) == 0:
        prompt = build_general_prompt(f"Analyze these symptoms: {symptoms}")
        answer = ask_gemini(prompt)
        answer += MEDICAL_DISCLAIMER
        severity = detect_severity(answer)
        return answer, [], None, severity

    top_distance = results["distances"][0][0]

    if top_distance < 1.5:
        docs = results["documents"][0]
        metas = results["metadatas"][0]

        context = ""
        sources = []

        for d, m in zip(docs, metas):
            context += d + "\n\n"
            sources.append(f"{m['source']} (page {m['page']})")

        prompt = build_symptom_prompt(context, symptoms)
        answer = ask_gemini(prompt)
        answer += MEDICAL_DISCLAIMER

        confidence = max(0, min(1, 1 - (top_distance / 1.5)))
        severity = detect_severity(answer)
        return answer, sources, confidence, severity
    else:
        prompt = build_general_prompt(f"Analyze these symptoms: {symptoms}")
        answer = ask_gemini(prompt)
        answer += MEDICAL_DISCLAIMER
        severity = detect_severity(answer)
        return answer, [], None, severity

# ---------------- CLI ----------------
def main():
    while True:
        print("\n1. Upload Medical PDF")
        print("2. Ask Medical Question")
        print("3. Check Symptoms")
        print("4. Exit")

        choice = input("Enter choice: ")

        if choice == "1":
            path = input("Enter PDF path: ")
            ingest_pdf(path)

        elif choice == "2":
            query = input("Enter your medical question: ")
            answer, sources, confidence, severity = answer_query(query)

            print("\nMedical Assessment:\n", answer)

            if severity:
                print(f"\nSeverity: {severity.upper()}")

            if sources:
                print("\nSources:")
                for s in set(sources):
                    print("-", s)

                print(f"\nConfidence: {confidence:.2f}")

        elif choice == "3":
            symptoms = input("Describe your symptoms: ")
            answer, sources, confidence, severity = check_symptoms(symptoms)

            print("\nSymptom Analysis:\n", answer)

            if severity:
                print(f"\nSeverity: {severity.upper()}")

            if sources:
                print("\nMedical Sources:")
                for s in set(sources):
                    print("-", s)

        elif choice == "4":
            break

if __name__ == "__main__":
    main()