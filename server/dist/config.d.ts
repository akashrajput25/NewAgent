export declare const config: {
    readonly port: number;
    readonly nodeEnv: string;
    readonly anthropicApiKey: string;
    readonly openaiApiKey: string;
    readonly aiModel: string;
    readonly aiBaseUrl: string | undefined;
    readonly dbPath: string;
    readonly uploadsDir: string;
    readonly generatedDir: string;
    readonly workspaceDir: string;
};
export type AIProvider = 'anthropic' | 'openai';
export declare function getActiveProvider(): AIProvider;
//# sourceMappingURL=config.d.ts.map