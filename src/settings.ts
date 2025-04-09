import { SettingSchemaDesc } from "@logseq/libs/dist/LSPlugin.user"

// Define the settings schema for the plugin
export const settings: SettingSchemaDesc[] = [
  {
    key: "ollamaHost",
    type: "string",
    title: "Ollama Host",
    description:
      "The host for the Ollama API (default: http://localhost:11434)",
    default: "http://localhost:11434",
  },
  {
    key: "llmModel",
    type: "string",
    title: "LLM Model",
    description: "The Ollama model to use for generating answers",
    default: "gemma3:4b",
  },
  {
    key: "embeddingsModel",
    type: "string",
    title: "Embeddings Model",
    description: "The Ollama model to use for generating embeddings",
    default: "mxbai-embed-large:latest",
  },
  {
    key: "closeVectorKey",
    type: "string",
    title: "CloseVector Key",
    description: "API key for CloseVector service",
    default: "",
  },
  {
    key: "closeVectorSecret",
    type: "string",
    title: "CloseVector Secret",
    description: "Secret for CloseVector service authentication",
    default: "",
  },
  {
    key: "minSimilarityScore",
    type: "number",
    title: "Minimum Similarity Score",
    description: "Minimum similarity score for retrieving context (0.0-1.0)",
    default: 0.6,
  },
  {
    key: "maxResults",
    type: "number",
    title: "Maximum Results",
    description: "Maximum number of context chunks to retrieve",
    default: 20,
  },
  {
    key: "chunkSize",
    type: "number",
    title: "Chunk Size",
    description: "Size of text chunks for indexing",
    default: 300,
  },
  {
    key: "chunkOverlap",
    type: "number",
    title: "Chunk Overlap",
    description: "Overlap between text chunks",
    default: 30,
  },
  {
    key: "returnReferencesForAsk",
    type: "enum",
    title: "Return references",
    description: "How to display references from your graph",
    enumChoices: ["No", "Block embeddings", "Block references"],
    enumPicker: "radio",
    default: "Block embeddings",
  },
  {
    key: "returnReferencesForSearch",
    type: "enum",
    title: "Return references",
    description: "How to display references from your graph",
    enumChoices: ["Block embeddings", "Block references"],
    enumPicker: "radio",
    default: "Block embeddings",
  },
]
