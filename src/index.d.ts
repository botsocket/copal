/**
 * Parses a source string to a template where:
 *
 * @param source - The source string to parse.
 * @param options - Optional options.
 *
 * @returns A template.
 */
export function parse(source: string, options?: Options): internals.Template;

/**
 * Checks if a value is a valid template where:
 *
 * @param value - The value to check.
 *
 * @returns Whether the value is a valid template.
 */
export function isTemplate(value: unknown): value is internals.Template;

export interface Options {
    /**
     * An optional factory function that returns a resolver given the path.
     */
    reference?: (path: string) => (context: any) => unknown;

    /**
     * An optional string that is used to wrap the template if it is nested inside another. Defaults to `"`.
     *
     * @default '"'
     */
    wrap?: string;

    /**
     * An optional hash of constants and their values (can be of type number, boolean, string or `null`).
     */
    constants?: Record<string, internals.AllowedTypes>;

    /**
     * An optional hash of function names and their implementations.
     */
    functions?: Record<string, (...args: any[]) => internals.AllowedTypes>;
}

declare namespace internals {
    class Template {
        /**
         * The source of the template.
         */
        source: string;

        /**
         * Resolves run-time values and interpolates them into the current template where:
         *
         * @param context - The context to lookup.
         *
         * @returns The interpolated string.
         */
        resolve(context?: unknown): number | string;
    }

    type AllowedTypes = null | boolean | number | string;
}
