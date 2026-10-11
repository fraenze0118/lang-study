// 仅为让 tsc 能对 scripts/ 下的 Node 单测做类型检查。
// 运行时不使用这里的声明：tsx 直接解析真实的 node:test / node:assert。
// 这样避免为整个 React Native 应用引入 @types/node 的全局类型。
declare module 'node:test' {
  export function test(name: string, fn: () => void | Promise<void>): void;
}

declare module 'node:assert/strict' {
  interface StrictAssert {
    equal(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    ok(value: unknown, message?: string): void;
    notEqual(actual: unknown, expected: unknown, message?: string): void;
    match(value: string, regExp: RegExp, message?: string): void;
  }
  const assert: StrictAssert;
  export default assert;
}
