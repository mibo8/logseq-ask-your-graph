/**
 * Format the RAG prompt with context and question
 * @param context The retrieved context from vector search
 * @param question The user's question
 * @returns Formatted prompt string
 */
export function buildPrompt(context: string, question: string): string {
  return `You are an AI assistant providing answers based on the user's provided context.
  
    We have provided context information below.
    ---------------------
    ${context}
    ---------------------
    Given this information, please answer the question: ${question}
    If you don't know the answer, say "I don't know."
    Please write page name in the answer if it is relevant.
    If you write a page name in your answer, use the format [[Page Name]].

    Answer:`
}
