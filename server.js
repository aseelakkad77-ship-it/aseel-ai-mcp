import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const app = express();
app.use(express.json());

function createServer() {
  const server = new McpServer({
    name: "aseel-ai-mcp",
    version: "1.0.0"
  });

  server.tool(
    "ask_gemini",
    "Ask Google Gemini a question",
    { prompt: z.string() },
    async ({ prompt }) => {
      const key = process.env.GEMINI_API_KEY;

      if (!key) {
        return {
          content: [{ type: "text", text: "GEMINI_API_KEY is missing" }],
          isError: true
        };
      }

      try {
        const response = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": key
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [{ text: prompt }]
                }
              ]
            })
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || "Gemini API error");
        }

        const answer =
          data.candidates?.[0]?.content?.parts
            ?.map(part => part.text || "")
            .join("") || "No response";

        return {
          content: [{ type: "text", text: answer }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: error.message }],
          isError: true
        };
      }
    }
  );

  return server;
}

app.post("/mcp", async (req, res) => {
  const server = createServer();

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: "MCP server error" });
    }
  } finally {
    res.on("close", () => {
      transport.close();
      server.close();
    });
  }
});

app.get("/", (req, res) => {
  res.send("Aseel AI MCP Server is running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`MCP server running on port ${PORT}`);
});
