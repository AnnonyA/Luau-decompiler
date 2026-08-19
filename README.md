# Luau decompiler

Decompilador de bytecode de Luau (Roblox) en TypeScript. No ejecuta nada: lee el proto, arma CFG/SSA y imprime Luau.

```
bytecode → decode → CFG → SSA → AST → printer
```

Soporta bytecode oficial **3–9**. Las versiones 10–13 se decodifican, pero la reconstrucción todavía está incompleta.

## Uso

```bash
npx luau-decompile decompile chunk.luac
npx luau-decompile disassemble chunk.luac
```

```ts
import { decompile } from "luau-decompiler";

const result = decompile(bytes);
if (result.ok) console.log(result.source);
```

```
npm test && npm run typecheck && npm run build
```

## Dónde estamos

El output ya se lee como Luau de verdad: cero `rN`, cero `upN`, cero comentarios inventados. Recompila la forma del programa (loops, if/else, métodos, packs, closures).

Sobre el fixture grande (`luac.bin`) y los dos ModuleScripts reales:

| | Antes | Ahora |
|---|---|---|
| Líneas (luac / IndexUI / Military) | 1127 / 1492 / 510 | **929 / 1381 / 510** |
| `rN` / `upN` / `--` / `: nil` | — | **0 / 0 / 0 / 0** |
| `+=` `-=` `*=` | 0 | **27 + 3 + 2** |
| `function_N` genéricos | 33 / 39 / 30 | **3 / 0 / 0** |
| Funciones de módulo duplicadas | 8 | **0** |

Cosas que ya quedaron humanas:

- `function module.X(...)` sin clonar el cuerpo al lado
- `self.value += n`, `function config:add`
- `return if cond then a else b` y `elseif` de verdad
- callbacks con nombre de evento: `onRenderStepped`, `onStopped`, `onActivated`, `onShake`
- `isEven` / `isOdd` se encuentran entre sí (antes un `value14()` que no existía)
- tipos útiles donde estamos seguros (`Players: Players`, no `: nil`)

## Contra Luacid

En varios ejes **ya estamos mejor**: más tipos (IndexUI 86 vs 33), métodos (`config:add`), if-expressions, nombres de callbacks, Military más corto (510 vs 574).

Luacid todavía gana en **nombres de locals**. Ellos dicen `LocalPlayer`, `Shared`, `Color32`. Nosotros decimos `player`, `shared`, `value` / `value2`. Semánticamente igual; se lee peor.

## Qué falta para superar a Luacid (y parecerse al source)

1. **Nombres que sigan al valor.** Hoy `result27 = math.clamp; result27 = result27(...)` es correcto pero feo. El source dice `math.clamp(seed, 0, 20)`.
2. **Mejores identificadores.** `value`, `config7`, `index20` → `seed`, `Counter`, `n`. Luacid ya hace una parte de esto.
3. **Tablas en un solo literal.** El original arma `CONFIG = { Numbers = {…}, Strings = {…} }`. Nosotros partimos en `config`, `config2`, `config3` y después las juntamos.
4. **Tipos en params.** `Original.txt` tiene `function module.RunEverything(seed: number, …)`. Nosotros casi no anotamos argumentos.
5. **Bindings sueltos.** Aún aparecen asignaciones a nombres nunca declarados (`result27`, `value150`) por reuso de registros.
6. **Alias de módulos.** Luacid escribe `local Shared = ReplicatedStorage.Shared`. Nosotros a veces vamos directo al path largo.

El norte no es “parecer un decompilador”. Es que `tests/generated/luac.decompiled.luau` se lea como `tests/Original.txt`.
