import { Document } from "langchain/document"
import { Ollama } from "@langchain/ollama"
import { OllamaEmbeddings } from "@langchain/ollama"
import { BlockEntity } from "@logseq/libs/dist/LSPlugin.user"
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter"
import { CloseVectorWeb } from "@langchain/community/vectorstores/closevector/web"
import { ScoreThresholdRetriever } from "langchain/retrievers/score_threshold"
import "@logseq/libs"
import { buildPrompt } from "./promptTemplates"

export class VectorIndex {
  private vectorStore: CloseVectorWeb | null = null
  private model: string
  private embeddingsModel: string
  private embeddings: OllamaEmbeddings
  private baseUrl: string
  private llm: Ollama
  private textSplitter: RecursiveCharacterTextSplitter

  constructor() {
    this.model = String(logseq.settings!.llmModel)
    this.embeddingsModel = String(logseq.settings!.embeddingsModel)
    this.baseUrl = String(logseq.settings!.ollamaHost)

    this.llm = new Ollama({
      model: this.model,
      baseUrl: this.baseUrl,
    })

    this.embeddings = new OllamaEmbeddings({
      model: this.embeddingsModel,
      baseUrl: this.baseUrl,
    })
    // Initialize text splitter with settings
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: Number(logseq.settings!.chunkSize),
      chunkOverlap: Number(logseq.settings!.chunkOverlap),
      separators: ["\n\n", "\n", ". ", ", ", " ", ""],
    })
  }

  public async init() {
    if (logseq.settings?.vectorStoreUuid) {
      
      this.vectorStore = await CloseVectorWeb.loadFromCloud({
        uuid: String(logseq.settings!.vectorStoreUuid),
        embeddings: this.embeddings,
        credentials: {
          key: String(logseq.settings!.closeVectorKey),
          secret: String(logseq.settings!.closeVectorSecret),
        },
        onProgress: (progress) => {
          console.log(`Upload progress: ${progress.loaded} / ${progress.total}`)
        },
      })
      console.log("Loaded existing vector store from cloud")
      logseq.UI.showMsg("Loaded existing vector store from cloud")
    }
  }

  public async indexGraph(): Promise<void> {
    console.log("Indexing...")
    logseq.UI.showMsg("Indexing your graph...", "info")

    try {
      // Get all journal pages
      const pages = await logseq.Editor.getAllPages()
      if (!pages) {
        console.error("No pages found")
        return
      } else {
        console.log(`Found ${pages.length} pages`)
      }

      // Collect all blocks from journal pages
      const allBlocks = []

      for (const page of pages) {
        const pageBlocks = await logseq.Editor.getPageBlocksTree(page.name)
        allBlocks.push(...pageBlocks)
      }

      console.log(`Retrieved ${allBlocks.length} blocks from journals`)
      // Create the index
      await this.createIndex(allBlocks)
      logseq.UI.showMsg("Graph indexed successfully", "success")
      console.log("Graph indexed successfully")
    } catch (error) {
      console.error("Error indexing blocks:", error)
      logseq.UI.showMsg("Failed to index journal blocks", "error")
      return
    }
  }

  /**
   * Clean content by removing wiki-style links and other formatting
   * @param content The content to clean
   * @returns The cleaned content
   */
  private cleanContent(content: string): string {
    if (!content) return ""

    // Strip double brackets from wiki-style links: [[Hello World]] -> Hello World
    return content.replace(/\[\[(.*?)\]\]/g, "$1")
  }

  /**
   * Process a block to include content from its children (one level only)
   */
  private async processBlockWithChildren(block: BlockEntity): Promise<string> {
    let content = block.content || ""

    if (block.children && block.children.length > 0) {
      for (const child of block.children) {
        // Check if child is a BlockEntity with content
        if (
          typeof child === "object" &&
          child !== null &&
          "content" in child &&
          typeof child.content === "string"
        ) {
          content += "\n" + child.content
        }
      }
    }
    return content
  }

  /**
   * Check if a block should be indexed
   * @param block The block to check
   * @returns True if the block should be indexed, false otherwise
   */
  private shouldIndexBlock(block: BlockEntity): boolean {
    // Skip blocks containing the "/ask" command
    if (block.content && block.content.startsWith("👤 ")) {
      return false
    }
    // Skip blocks with less than 20 characters
    if (!block.content || block.content.trim().length < 20) {
      return false
    }
    // Skip blocks without children but with a parent
    // A block with a parent has a "parent" property referencing the parent block
    if (!block.children?.length && block.parent) {
      return false
    }
    return true
  }

  async createIndex(blocks: BlockEntity[]): Promise<void> {
    // Filter blocks using the shouldIndexBlock method
    const blocksToIndex = blocks.filter((block) => this.shouldIndexBlock(block))
    console.log(
      `Found ${blocksToIndex.length} blocks for indexing after filtering`,
    )

    try {
      // Initialize the embeddings
      console.log("Initializing embeddings:", this.embeddingsModel)

      // Convert blocks to documents with proper metadata
      const documentPromises = blocksToIndex.map(async (block) => {
        const processedContent = await this.processBlockWithChildren(block)
        const cleanedContent = this.cleanContent(processedContent)
        const page = await logseq.Editor.getPage(block.page.id)
        const pageName = page ? page.name : "Unknown"
        return new Document({
          pageContent: cleanedContent,
          metadata: {
            uuid: block.uuid,
            pageName: pageName,
            pageId: block.page.id || 0,
          },
        })
      })

      // Wait for all document promises to resolve
      const initialDocuments = await Promise.all(documentPromises)

      console.log("Chunking documents...")

      // Split documents into chunks
      const chunkedDocuments: Document[] = []
      for (const doc of initialDocuments) {
        const chunks = await this.textSplitter.splitDocuments([doc])
        chunkedDocuments.push(...chunks)
      }

      console.log(
        `Created ${chunkedDocuments.length} chunks from ${initialDocuments.length} original documents`,
      )

      if (chunkedDocuments.length === 0) {
        throw new Error("No valid documents to index after chunking")
      }

      // Process chunks in batches of 50
      const batchSize = 200
      let vectorStore: CloseVectorWeb | null = null

      for (let i = 0; i < chunkedDocuments.length; i += batchSize) {
        const batch = chunkedDocuments.slice(i, i + batchSize)

        if (vectorStore === null) {
          // Initialize with first batch
          vectorStore = await CloseVectorWeb.fromDocuments(
            batch,
            this.embeddings,
          )
        } else {
          // Add subsequent batches to existing index
          await vectorStore.addDocuments(batch)
        }
      }
      
      let uuidFromSettings: string | undefined
      if (
        logseq.settings?.vectorStoreUuid && 
        String(logseq.settings.vectorStoreUuid) !== ""
      ) {
        uuidFromSettings = String(logseq.settings.vectorStoreUuid)
      }
      
      this.vectorStore = vectorStore

      await this.vectorStore!.saveToCloud({
        uuid: uuidFromSettings,
        description:
          String(logseq.settings!.embeddingsModel) +
          "-logseq-ask-your-graph-index",
        public: false,
        credentials: {
          key: String(logseq.settings!.closeVectorKey),
          secret: String(logseq.settings!.closeVectorSecret),
        },
        onProgress: (progress) => {
          console.log(`Upload progress: ${progress.loaded} / ${progress.total}`)
        },
      })
      const uuid = this.vectorStore!.instance.uuid

      // Save UUID to logseq settings for persistence between sessions
      logseq.updateSettings({
        vectorStoreUuid: uuid,
      })
      console.log(`Vector store UUID ${uuid} saved to settings`)

      console.log("Vector index created successfully with chunked documents")
    } catch (error) {
      console.error("Error creating vector index:", error)
      console.error(
        "Error details:",
        error instanceof Error ? error.message : JSON.stringify(error),
      )
      throw error
    }
  }

  async search(question: string): Promise<Document[]> {
    try {
      // Search for relevant documents
      const retriever = ScoreThresholdRetriever.fromVectorStore(
        this.vectorStore!,
        {
          minSimilarityScore: Number(logseq.settings!.minSimilarityScore),
          maxK: Number(logseq.settings!.maxResults),
          kIncrement: 2,
        },
      )
      const results = await retriever.invoke(question)
      return results
    } catch (error) {
      console.error("Error searching vector index:", error)
      throw error
    }
  }

  async query(question: string): Promise<{
    results: Document[]
    answer: string
  }> {
    try {
      const results = await this.search(question)
      if (results.length === 0) {
        console.log("No relevant documents found for the question.")
        return {
          results: [],
          answer: "I couldn't find an answer to your question.",
        }
      }

      // Format context from retrieved documents
      const context = results
        .map(
          (doc: Document) =>
            `Content: ${doc.pageContent}\nPage: [[${doc.metadata.pageName}]]`,
        )
        .join("\n\n")

      // Use the prompt template from prompt_templates.ts
      const prompt = buildPrompt(context, question)

      console.log("Prompt for LLM:", prompt)
      console.log("Using model:", this.model, "at", this.baseUrl)
      const answer = await this.llm.invoke(prompt)

      return {
        results,
        answer,
      }
    } catch (error) {
      console.error("Error querying vector index:", error)
      throw error
    }
  }
}
