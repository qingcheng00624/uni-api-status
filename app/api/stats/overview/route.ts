import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const apiKey = searchParams.get("apiKey")

    if (!apiKey) {
      return NextResponse.json({ error: "API Key is required" }, { status: 400 })
    }

    try {
      const results = await query(
        `
        SELECT
          COUNT(DISTINCT r.request_id) as requests,
          COALESCE(SUM(r.total_tokens), 0) as totalTokens,
          COALESCE(SUM(r.prompt_tokens), 0) as promptTokens,
          COALESCE(SUM(r.completion_tokens), 0) as completionTokens,
          COALESCE(AVG(r.process_time), 0) as avgProcessTime,
          COALESCE(AVG(r.first_response_time), 0) as avgFirstResponseTime
        FROM request_stats r
        WHERE r.api_key = $1 AND r.endpoint = $2
        `,
        [apiKey, "POST /v1/chat/completions"],
      )

      const stats = results[0] || {
        requests: 0,
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        avgProcessTime: 0,
        avgFirstResponseTime: 0,
      }

      return NextResponse.json(stats)
    } catch (dbError) {
      console.error("Database query error:", dbError);
      return NextResponse.json({ 
        error: "Database query failed", 
        details: (dbError as Error).message 
      }, { status: 500 })
    }
  } catch (error) {
    console.error("Error fetching overview stats:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}