import "@logseq/libs"
import { settings } from "./settings"
import { VectorIndex } from "./VectorIndex"

// Mock function for indexing the graph

async function main() {
  console.log("Plugin loaded")
  logseq.useSettingsSchema(settings)

  // Initialize the vector index
  const vectorIndex = new VectorIndex()
  await vectorIndex.init()

  // Register UI elements for the plugin - with fixed icon size
  logseq.App.registerUIItem("toolbar", {
    key: "ask-your-graph",
    template: `
      <a class="button" id="ask-your-graph"
      data-on-click="showIndexDialog"
      data-rect>
       <i class="ti ti-robot"></i> 
      </a>
    `,
  })

  // Register handlers for UI actions with a different approach
  logseq.provideModel({
    showIndexDialog() {
      // Add a small delay to avoid UI conflicts
      setTimeout(() => {
        vectorIndex.indexGraph()
      }, 100)
    },
  })

  // Register slash command for asking questions to your graph
  logseq.Editor.registerSlashCommand("ask", async () => {
    console.log("Ask command triggered")

    // Get the current block
    const currentBlock = await logseq.Editor.getCurrentBlock()
    if (!currentBlock) {
      console.error("No current block found")
      return
    }

    console.log("Current block:", currentBlock)

    try {
      // Extract the question (removing the "/ask" part)
      const blockContent = currentBlock.content
      const question = blockContent.replace("/ask", "").trim()

      if (!question) {
        await logseq.Editor.updateBlock(
          currentBlock.uuid,
          "/ask What's your question?",
        )
        return
      }

      // Format the question without the /ask command
      await logseq.Editor.updateBlock(currentBlock.uuid, `👤 ${question}`)

      // Show loading indicator
      await logseq.UI.showMsg(
        "Searching your graph for relevant information...",
        "info",
      )

      vectorIndex.query(question).then(async (result) => {
        console.log("Query result:", result)
        // Process the result and generate a response
        const answer =
          result.answer || "I couldn't find an answer to your question."
        // Insert the answer as a child block
        await logseq.Editor.insertBlock(
          currentBlock.uuid,
          `🤖 ${answer}`,
          { sibling: false }, // false means insert as a child
        )

        // Get the returnReferencesForAsk setting
        const returnReferences =
          logseq.settings?.returnReferencesForAsk || "Block embeddings"

        // Build a string of references from the result blocks based on settings
        if (
          result.results &&
          result.results.length > 0 &&
          returnReferences !== "No"
        ) {
          let referencesString = "🔍 "

          for (const block of result.results) {
            if (block.metadata.uuid) {
              if (returnReferences === "Block embeddings") {
                referencesString += `{{embed ((${block.metadata.uuid}))}}\n`
              } else if (returnReferences === "Block references") {
                referencesString += `((${block.metadata.uuid}))\n`
              }
            }
          }

          // Insert a single block with all the references if they exist
          if (referencesString.length > 2 && returnReferences !== "No") {
            await logseq.Editor.insertBlock(
              currentBlock.uuid,
              referencesString,
              { sibling: false, focus: false }, // false means insert as a child
            )
          }
        }
        await logseq.Editor.exitEditingMode()
      })

      console.log("Question processed:", question)
    } catch (error) {
      console.error("Error processing question:", error)
    }
  })

  // Register slash command for searching the graph semantically
  logseq.Editor.registerSlashCommand("search", async () => {
    console.log("Search command triggered")

    // Get the current block
    const currentBlock = await logseq.Editor.getCurrentBlock()
    if (!currentBlock) {
      console.error("No current block found")
      return
    }

    console.log("Current block:", currentBlock)

    try {
      // Extract the search query (removing the "/search" part)
      const blockContent = currentBlock.content
      const searchQuery = blockContent.replace("/search", "").trim()

      if (!searchQuery) {
        await logseq.Editor.updateBlock(
          currentBlock.uuid,
          "/search What are you looking for?",
        )
        return
      }

      // Format the search query without the /search command
      await logseq.Editor.updateBlock(currentBlock.uuid, `👤 ${searchQuery}`)

      // Show loading indicator
      await logseq.UI.showMsg(
        "Searching your graph for relevant information...",
        "info",
      )

      // Use search instead of query to avoid LLM processing
      vectorIndex
        .search(searchQuery)
        .then(async (results) => {
          console.log("Search results:", results)

          // Get the returnReferences setting
          const returnReferences =
            logseq.settings?.returnReferencesForSearch || "Block embeddings"

          // If no results found, inform the user
          if (!results || results.length === 0) {
            await logseq.Editor.insertBlock(
              currentBlock.uuid,
              "📚 No relevant results found in your graph.",
              { sibling: false },
            )
            return
          }

          // Build a string of references from the results based on settings
          let referencesString = "📚 Search results:\n"

          for (const block of results) {
            if (block.metadata && block.metadata.uuid) {
              if (returnReferences === "Block embeddings") {
                referencesString += `{{embed ((${block.metadata.uuid}))}}\n`
              } else if (returnReferences === "Block references") {
                referencesString += `((${block.metadata.uuid}))\n`
              }
            }
          }

          // Insert a block with all the references
          await logseq.Editor.insertBlock(currentBlock.uuid, referencesString, {
            sibling: false,
            focus: false,
          })
          await logseq.Editor.exitEditingMode()
        })
        .catch((error) => {
          console.error("Error during search:", error)
          logseq.UI.showMsg(
            "Error searching your graph. Check console for details.",
            "error",
          )
        })

      console.log("Search query processed:", searchQuery)
    } catch (error) {
      console.error("Error processing search:", error)
    }
  })

  console.log("Plugin initialized")
}

// Bootstrap the plugin
logseq.ready(main).catch(console.error)
