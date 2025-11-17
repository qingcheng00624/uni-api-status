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
          r.model,
          COUNT(DISTINCT r.request_id) as requests,
          COALESCE(SUM(CASE WHEN c.success = true THEN 1 ELSE 0 END), 0) as successes,
          COALESCE(SUM(CASE WHEN c.success = false OR c.success IS NULL THEN 1 ELSE 0 END), 0) as failures,
          COALESCE(
            CAST(SUM(CASE WHEN c.success = true THEN 1 ELSE 0 END) AS FLOAT) / NULLIF(COUNT(DISTINCT r.request_id), 0),
            0
          ) as successRate,
          COALESCE(SUM(r.total_tokens), 0) as totalTokens,
          COALESCE(SUM(r.prompt_tokens), 0) as promptTokens,
          COALESCE(SUM(r.completion_tokens), 0) as completionTokens,
          COALESCE(AVG(r.process_time), 0) as avgProcessTime,
          COALESCE(AVG(r.first_response_time), 0) as avgFirstResponseTime
        FROM request_stats r
        LEFT JOIN channel_stats c ON r.request_id = c.request_id
        WHERE r.api_key = $1 AND r.endpoint = $2
        GROUP BY r.model
        ORDER BY requests DESC
        `,
        [apiKey, "POST /v1/chat/completions"]
      )

      return NextResponse.json(results)
    } catch (dbError) {
      console.error("Database query error:", dbError);
      return NextResponse.json({ 
        error: "Database query failed", 
        details: (dbError as Error).message 
      }, { status: 500 })
    }
  } catch (error) {
    console.error("Error fetching model stats:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}