declare const adapter: {
    pragma: (_sql: string) => undefined;
    exec: (sql: string) => void;
    prepare: (sql: string) => {
        all: (...params: unknown[]) => Record<string, unknown>[];
        get: (...params: unknown[]) => Record<string, unknown> | undefined;
        run: (...params: unknown[]) => {
            lastInsertRowid: any;
        };
    };
};
export default adapter;
//# sourceMappingURL=connection.d.ts.map