// Authored AST-pass control that initially compiled before the wide-argument
// rewrite and exceeded 255 registers afterward on both official pins.
export function registerPressureChunk() {
  const lit = value => ({kind: "literal", value});
  const id = name => ({kind: "identifier", name});
  return {kind: "chunk", body: {kind: "block", statements: [
    {kind: "local", names: ["value"], definition: {prototypeId: 0, pc: 0, register: 0},
      values: [{kind: "call", callee: id("produce"), args: Array.from({length: 12}, (_, i) => lit(i + 1)), open: false}]},
    {kind: "return", values: [{kind: "call", callee: id("consume"),
      args: [...Array.from({length: 249}, () => lit(0)), id("value")], open: true}]},
  ]}};
}
