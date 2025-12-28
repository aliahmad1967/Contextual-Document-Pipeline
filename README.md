# Contextual Document Pipeline

A sophisticated React application that transforms raw text and images into structured, enriched insights and interactive knowledge graphs. Powered by Google's Gemini API for cloud performance or Ollama for local privacy.

## Overview

This application demonstrates a modern AI document processing pipeline. It takes raw input (text or images), parses it, segments it into semantic chunks, and enriches each chunk with AI-generated metadata. The final output includes structured data cards and a force-directed knowledge graph visualizing relationships between entities found in the document.

## Features

- **Multi-Modal Input**: 
  - Paste raw text directly.
  - Upload images for OCR processing.
- **Dual AI Providers**:
  - **Cloud**: Google Gemini (Flash & Pro) for high performance.
  - **Local**: Ollama support for offline/private processing.
- **Intelligent Pipeline**:
  - **Parsing**: Cleans and normalizes input text.
  - **Chunking**: Segments documents into manageable pieces.
  - **Enrichment**: Analyzes each chunk for context, sentiment, and keywords.
- **Entity Extraction**: Automatically identifies People, Organizations, and Locations.
- **Interactive Knowledge Graph**: Generates and visualizes a network of entity relationships using `react-force-graph`.
- **Summarization**: On-demand summarization for individual text chunks.
- **Data Export**: Download processed chunks or the full knowledge graph structure as JSON.

## Tech Stack

- **Frontend**: React 18, TypeScript
- **Styling**: Tailwind CSS
- **AI Integration**: 
  - Google GenAI SDK (`@google/genai`)
  - Local REST API integration for Ollama
- **Visualization**: `react-force-graph-2d`
- **Icons**: Lucide React

## Setup & Usage

### Prerequisites
- Node.js and npm/yarn.
- **For Cloud Mode**: A Google Cloud Project with the Gemini API enabled and an API Key.
- **For Local Mode**: [Ollama](https://ollama.com/) installed and running locally.

### Running the App

1. **Clone the repository**
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Configure API Key (For Gemini)**
   Set the `API_KEY` environment variable for Google Gemini access.
   ```env
   API_KEY=your_google_genai_api_key
   ```
4. **Start the development server**
   ```bash
   npm start
   ```

### Using Local AI (Ollama)

To use the application offline with Ollama:

1. **Install Ollama**: Download from [ollama.com](https://ollama.com).
2. **Pull a Model**: Run `ollama pull llama3` (or `mistral`). For image OCR, ensure you pull a vision model like `llava`.
3. **Enable CORS**: Ollama blocks browser requests by default. You must set the `OLLAMA_ORIGINS` environment variable when running the server.
   
   **Mac/Linux:**
   ```bash
   OLLAMA_ORIGINS="*" ollama serve
   ```
   
   **Windows (PowerShell):**
   ```powershell
   $env:OLLAMA_ORIGINS="*"; ollama serve
   ```

4. **Configure App**:
   - Open the app in your browser.
   - Click the **Settings (Gear Icon)** in the top right.
   - Select **Local Ollama**.
   - Enter your endpoint (default: `http://localhost:11434`) and model name (e.g., `llama3` or `llava`).

### User Guide

1. **Input Data**: 
   - Use the **Raw Text** panel to paste content.
   - Use the **Image/Document** panel to upload an image for OCR.
2. **Process**: Click "Process Text" (or upload an image) to start the pipeline.
3. **Visualize**: Watch the pipeline stages update in real-time.
   - **Parse** -> **Chunk** -> **Enrich** -> **Contextual Chunks**
4. **Explore Chunks**: 
   - Scroll through the generated cards.
   - Click "Summarize Chunk" to generate a bullet-point summary.
5. **Knowledge Graph**:
   - Once processing is complete, click **Generate Graph**.
   - Use **Visualize** to open the interactive graph explorer.
   - Click nodes to see connections, use the search bar to find specific entities, and zoom/pan to explore the network.
6. **Export**: Use the export buttons to download your data for external use.

## 🚀 Professional Workflow Example: Legal Contract Analysis

Here is an example of how a professional analyst might use this tool to dissect a **Service Level Agreement (SLA)** or **Research Paper**:

### 1. Configuration Strategy
*   **Privacy First**: For sensitive contracts, switch to **Local Ollama** mode (Settings > Local Ollama).
*   **Model Selection**: Use a high-context model like `llama3` or `mistral` to ensure subtle clauses are captured.

### 2. The Process
1.  **Ingestion**: Paste the raw text of the SLA into the "Raw Text" panel.
2.  **Pipeline Execution**: Click "Process Text". The system normalizes whitespace and chunks the document into semantic sections.
3.  **Semantic Review**:
    *   Scroll through **Contextual Chunks**.
    *   Look for chunks with **Negative Sentiment** (red tags) – these often indicate penalties, termination clauses, or liabilities.
    *   Use the **Summarize Chunk** button on complex legal paragraphs to get a bulleted simplification.

### 3. Knowledge Network Analysis
1.  Click **Generate Graph** then **Visualize**.
2.  **Cluster by Type**: Open Settings (Sliders icon) and enable "Cluster by Type". This visually separates *Organizations* (Parties involved) from *Locations* (Jurisdictions) and *Concepts* (Obligations).
3.  **Deep Dive**:
    *   Click on the node representing "Service Provider".
    *   Select **Isolate Subgraph** in the sidebar.
    *   Now you verify exactly what other entities (Deliverables, Penalties, Dates) are directly linked to the provider, filtering out the noise of the rest of the document.

### 4. Insight Export
*   Export the **Knowledge Graph JSON** to import into advanced visualization tools like Gephi.
*   Export the **Processed Chunks** to archive the enriched metadata alongside the original contract.

## License

MIT
