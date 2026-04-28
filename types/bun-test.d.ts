declare module "bun:test" {
  export type HookCallback = () => any | Promise<any>;
  export type TestCallback = (
    done?: (error?: any) => void,
  ) => any | Promise<any>;
  export interface MockFunction<
    T extends (...args: any[]) => any = (...args: any[]) => any,
  > {
    (...args: Parameters<T>): ReturnType<T>;
    mockImplementation?: (fn: T) => this;
    mockResolvedValue?: (value: unknown) => this;
    mockRejectedValue?: (value: unknown) => this;
    mockReturnValue?: (value: unknown) => this;
    mockReturnThis?: () => this;
  }

  export const test: (name: string, fn: TestCallback) => void;
  export const it: typeof test;
  export const describe: (name: string, fn: () => void) => void;
  export const expect: any;
  export const beforeAll: (fn: HookCallback) => void;
  export const beforeEach: (fn: HookCallback) => void;
  export const afterAll: (fn: HookCallback) => void;
  export const afterEach: (fn: HookCallback) => void;
  export const mock: <
    T extends (...args: any[]) => any = (...args: any[]) => any,
  >(
    impl?: T,
  ) => MockFunction<T>;
  export const vi: any;
  export const jest: any;
  export const setSystemTime: (time: number | Date) => void;
  export const restoreAllMocks: () => void;
  export const expectTypeOf: any;
}
