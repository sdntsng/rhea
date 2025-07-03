import { langsmithClient, LANGSMITH_PROJECT } from "../config/langsmith.config";
import { Run } from "langsmith";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { getToolById, ToolMetadata } from "../config/composio.tools";

// Interface for tool usage statistics
interface ToolUsageStats {
    totalCalls: number;
    successRate: number;
    averageLatency: number;
    errorTypes: Record<string, number>;
}

// Function to log tool usage
export async function logToolUsage(
    toolName: string,
    input: any,
    output: any,
    error?: Error,
    metadata?: Record<string, any>
) {
    try {
        await langsmithClient.createRun({
            name: toolName,
            run_type: "tool",
            inputs: { input },
            outputs: error ? undefined : { output },
            error: error ? error.message : undefined,
            project_name: LANGSMITH_PROJECT,
            extra: {
                metadata: {
                    tool_name: toolName,
                    timestamp: new Date().toISOString(),
                    ...metadata
                }
            }
        });
    } catch (e) {
        console.error("Error logging to LangSmith:", e);
    }
}

// Function to analyze tool usage patterns
export async function analyzeToolUsage(
    toolId: string,
    timeRange: { start: Date; end: Date }
): Promise<ToolUsageStats> {
    try {
        const runs: Run[] = [];
        for await (const run of langsmithClient.listRuns({
            projectName: LANGSMITH_PROJECT,
            startTime: timeRange.start,
            runType: "tool",
            filter: `eq(extra.metadata.tool_name, "${toolId}")`
        })) {
            runs.push(run);
        }

        const totalCalls = runs.length;
        const successfulCalls = runs.filter(run => !run.error).length;
        const errorTypes: Record<string, number> = {};
        let totalLatency = 0;

        for (const run of runs) {
            if (run.start_time && run.end_time) {
                const latency = new Date(run.end_time).getTime() - new Date(run.start_time).getTime();
                totalLatency += latency;
            }

            if (run.error) {
                const errorType = run.error.toString().split(':')[0].trim();
                errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
            }
        }

        return {
            totalCalls,
            successRate: totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0,
            averageLatency: totalCalls > 0 ? totalLatency / totalCalls : 0,
            errorTypes
        };
    } catch (e) {
        console.error("Error analyzing tool usage:", e);
        throw e;
    }
}

// Function to debug a specific tool run
export async function debugToolRun(runId: string): Promise<{
    run: Run;
    toolMetadata?: ToolMetadata;
    inputs: any;
    outputs?: any;
    error?: string;
    duration: number;
}> {
    try {
        const run = await langsmithClient.readRun(runId);
        const toolName = run.extra?.metadata?.tool_name as string | undefined;
        const toolMetadata = toolName ? getToolById(toolName) : undefined;
        
        const duration = run.end_time && run.start_time
            ? new Date(run.end_time).getTime() - new Date(run.start_time).getTime()
            : 0;

        return {
            run,
            toolMetadata,
            inputs: run.inputs,
            outputs: run.outputs,
            error: run.error?.toString(),
            duration
        };
    } catch (e) {
        console.error("Error debugging tool run:", e);
        throw e;
    }
}

// Function to wrap a tool with logging
export function withLogging(tool: DynamicStructuredTool): DynamicStructuredTool {
    const originalCall = tool.call.bind(tool);
    
    tool.call = async (input: any) => {
        const startTime = new Date();
        try {
            const output = await originalCall(input);
            await logToolUsage(tool.name, input, output, undefined, {
                duration: new Date().getTime() - startTime.getTime()
            });
            return output;
        } catch (error) {
            await logToolUsage(tool.name, input, undefined, error as Error, {
                duration: new Date().getTime() - startTime.getTime()
            });
            throw error;
        }
    };

    return tool;
}

// Function to get recent tool failures
export async function getRecentFailures(
    hours: number = 24
): Promise<Array<{ toolName: string; error: string; timestamp: string }>> {
    try {
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);

        const failedRuns: Run[] = [];
        for await (const run of langsmithClient.listRuns({
            projectName: LANGSMITH_PROJECT,
            startTime: startTime,
            runType: "tool",
            filter: "error IS NOT NULL"
        })) {
            failedRuns.push(run);
        }

        return failedRuns.map(run => ({
            toolName: run.extra?.metadata?.tool_name as string || 'unknown',
            error: run.error?.toString() || 'unknown error',
            timestamp: run.start_time?.toString() || 'unknown'
        }));
    } catch (e) {
        console.error("Error fetching recent failures:", e);
        throw e;
    }
} 