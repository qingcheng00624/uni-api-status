import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

interface LogRow {
  timestamp: string
  success: boolean
  model: string
  provider: string
  processTime: number
  firstResponseTime: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  text: string
}

function parseBoolean(value: string | null): boolean | null {
    if (value === null || value === undefined) {
        return null;
    }
    const lowerCaseValue = value.toLowerCase();
    if (lowerCaseValue === 'true') {
        return true;
    }
    if (lowerCaseValue === 'false') {
        return false;
    }
    return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const apiKey = searchParams.get("apiKey")
    const page = Number.parseInt(searchParams.get("page") || "1")
    const rawLimit = searchParams.get("limit") || "30";
    const limit = Math.min(Math.max(1, Number.parseInt(rawLimit)), 100);
    const model = searchParams.get("model")
    const provider = searchParams.get("provider")
    const statusParam = searchParams.get("status")

    if (!apiKey) {
      return NextResponse.json({ error: "API Key is required" }, { status: 400 })
    }

    try {
      let whereClauses: string[] = ["r.api_key = $1", "r.endpoint = $2"]
      const params: (string | number | boolean)[] = [apiKey, "POST /v1/chat/completions"]
      let paramIndex = 3;

      if (model) {
        whereClauses.push(`r.model = $${paramIndex++}`)
        params.push(model)
      }

      if (provider) {
        whereClauses.push(`r.provider = $${paramIndex++}`)
        params.push(provider)
      }

      const successStatus = parseBoolean(statusParam);
      if (successStatus !== null) {
          whereClauses.push(`c.success = $${paramIndex++}`)
          params.push(successStatus);
      }

      const whereClause = `WHERE ${whereClauses.join(" AND ")}`;

      const offset = (page - 1) * limit
      const queryLimit = limit + 1;

      const sql = `
        SELECT
          r.timestamp,
          BOOL_OR(COALESCE(c.success, false)) as success,
          r.model,
          r.provider,
          r.process_time as processTime,
          r.first_response_time as firstResponseTime,
          r.prompt_tokens as promptTokens,
          r.completion_tokens as completionTokens,
          r.total_tokens as totalTokens,
          r.text
        FROM request_stats r
        LEFT JOIN channel_stats c ON r.request_id = c.request_id
        ${whereClause}
        GROUP BY r.request_id, r.timestamp, r.model, r.provider, r.process_time, 
                 r.first_response_time, r.prompt_tokens, r.completion_tokens, 
                 r.total_tokens, r.text
        ORDER BY r.timestamp DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      const finalParams = [...params, queryLimit, offset];

      const results: LogRow[] = await query(sql, finalParams);

      const hasNextPage = results.length > limit
      const logs = hasNextPage ? results.slice(0, limit) : results

      return NextResponse.json({ logs, hasNextPage })

    } catch (dbError) {
      console.error("Database query error:", dbError);
      return NextResponse.json({ error: "Database query failed", details: (dbError as Error).message }, { status: 500 })
    }
  } catch (error) {
    console.error("Error fetching logs:", error)
    if (error instanceof Error) {
        return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}