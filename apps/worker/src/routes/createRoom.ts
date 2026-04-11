type DbRunResult = {
    success: boolean;
};

type DbStatement = {
    bind(...values: unknown[]): DbStatement;
    run(): Promise<DbRunResult>;
};