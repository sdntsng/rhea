import { LangchainToolSet } from "composio-core";
import { DynamicStructuredTool } from "@langchain/core/tools";

// Interface for tool metadata
export interface ToolMetadata {
    id: string;
    name: string;
    description: string;
    category: ToolCategory;
    integration: IntegrationType;
}

// Enum for tool categories
export enum ToolCategory {
    COLLABORATION = "collaboration",
    COMMUNICATION = "communication",
    SCHEDULING = "scheduling",
    FILE_MANAGEMENT = "file_management",
    DEVELOPMENT = "development"
}

// Enum for integration types
export enum IntegrationType {
    LINEAR = "linear",
    NOTION = "notion",
    GMAIL = "gmail",
    DISCORD = "discord",
    GOOGLE_CALENDAR = "google_calendar",
    GOOGLE_DRIVE = "google_drive",
    GOOGLE_DOCS = "google_docs",
    GOOGLE_SHEETS = "google_sheets",
    GITHUB = "github"
}

// Tool definitions with metadata
export const TOOL_DEFINITIONS: Record<string, ToolMetadata> = {
    // Collaboration Tools
    "linear": {
        id: "ac_5lqeuTORg1A_",
        name: "Linear",
        description: "Manage tasks and issues in Linear",
        category: ToolCategory.COLLABORATION,
        integration: IntegrationType.LINEAR
    },
    "notion": {
        id: "ac_MO518vzGymSg",
        name: "Notion",
        description: "Work with Notion documents and databases",
        category: ToolCategory.COLLABORATION,
        integration: IntegrationType.NOTION
    },
    
    // Communication Tools
    "gmail": {
        id: "ac_lgSF7tFbccJK",
        name: "Gmail",
        description: "Send and manage emails through Gmail",
        category: ToolCategory.COMMUNICATION,
        integration: IntegrationType.GMAIL
    },
    "discord": {
        id: "ac_Bu_ucWUI3FRs",
        name: "Discord Bot",
        description: "Interact with Discord channels and users",
        category: ToolCategory.COMMUNICATION,
        integration: IntegrationType.DISCORD
    },

    // Scheduling Tools
    "google_calendar": {
        id: "ac_LB6Cvg7Gy0Ts",
        name: "Google Calendar",
        description: "Manage calendar events and meetings",
        category: ToolCategory.SCHEDULING,
        integration: IntegrationType.GOOGLE_CALENDAR
    },

    // File Management Tools
    "google_drive": {
        id: "ac_qhbL6EiR1n_i",
        name: "Google Drive",
        description: "Manage files and folders in Google Drive",
        category: ToolCategory.FILE_MANAGEMENT,
        integration: IntegrationType.GOOGLE_DRIVE
    },
    "google_docs": {
        id: "ac_VO4VfGHRA4lU",
        name: "Google Docs",
        description: "Create and edit Google Documents",
        category: ToolCategory.FILE_MANAGEMENT,
        integration: IntegrationType.GOOGLE_DOCS
    },
    "google_sheets": {
        id: "ac_UHQFciB7qLQJ",
        name: "Google Sheets",
        description: "Work with spreadsheets in Google Sheets",
        category: ToolCategory.FILE_MANAGEMENT,
        integration: IntegrationType.GOOGLE_SHEETS
    },

    // Development Tools
    "github": {
        id: "ac_0CxTIU1beI4Y",
        name: "GitHub",
        description: "Manage repositories and issues on GitHub",
        category: ToolCategory.DEVELOPMENT,
        integration: IntegrationType.GITHUB
    }
};

// Helper function to get tools by category
export function getToolsByCategory(category: ToolCategory): ToolMetadata[] {
    return Object.values(TOOL_DEFINITIONS).filter(tool => tool.category === category);
}

// Helper function to get tool by ID
export function getToolById(id: string): ToolMetadata | undefined {
    return Object.values(TOOL_DEFINITIONS).find(tool => tool.id === id);
}

// Initialize Composio toolset with filtering
export async function initializeTools(
    toolset: LangchainToolSet,
    toolNames?: string[]
): Promise<DynamicStructuredTool[]> {
    try {
        let integrationsToFetch: IntegrationType[] = [];

        if (toolNames) {
            const toolIntegrations = toolNames.map(name => {
                const tool = Object.values(TOOL_DEFINITIONS).find(t => t.name.toLowerCase() === name.toLowerCase());
                return tool ? tool.integration : undefined;
            }).filter(Boolean) as IntegrationType[];
            integrationsToFetch = [...new Set(toolIntegrations)];
        } else {
            integrationsToFetch = Object.values(TOOL_DEFINITIONS).map(tool => tool.integration);
        }
        

        // Fetch the executable tools
        console.log('Fetching tools from Composio...');
        const tools = await toolset.getTools({ apps: integrationsToFetch });
        console.log('Successfully fetched tools from Composio.');
        
        let filteredTools = tools;
        if (toolNames) {
            filteredTools = tools.filter(tool => toolNames.includes(tool.name));
        }

        // Wrap tools with logging
        return filteredTools.map(withLogging);
    } catch (error) {
        console.error("Error initializing Composio tools:", error);
        return [];
    }
}

// Function to wrap a tool with logging
function withLogging(tool: DynamicStructuredTool): DynamicStructuredTool {
    console.log(`Wrapping tool: ${tool.name}`);
    const originalCall = tool.call.bind(tool);
    
    tool.call = async (input: any) => {
        const startTime = new Date();
        try {
            const output = await originalCall(input);
            // Assuming logToolUsage is defined elsewhere and works correctly
            // logToolUsage(tool.name, input, output, undefined, {
            //     duration: new Date().getTime() - startTime.getTime()
            // });
            return output;
        } catch (error) {
            // logToolUsage(tool.name, input, undefined, error as Error, {
            //     duration: new Date().getTime() - startTime.getTime()
            // });
            throw error;
        }
    };

    return tool;
} 