export type DiagnosticSeverity = "error" | "warning" | "info";

export interface Diagnostic {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  prototypeId?: number;
  pc?: number;
}

export class DiagnosticBag {
  private readonly items: Diagnostic[] = [];

  get all(): readonly Diagnostic[] {
    return this.items;
  }

  get errors(): Diagnostic[] {
    return this.items.filter((item) => item.severity === "error");
  }

  get hasErrors(): boolean {
    return this.items.some((item) => item.severity === "error");
  }

  push(diagnostic: Diagnostic): void {
    this.items.push(diagnostic);
  }

  error(code: string, message: string, extra?: Omit<Diagnostic, "severity" | "code" | "message">): void {
    this.push({ severity: "error", code, message, ...extra });
  }

  warning(code: string, message: string, extra?: Omit<Diagnostic, "severity" | "code" | "message">): void {
    this.push({ severity: "warning", code, message, ...extra });
  }

  info(code: string, message: string, extra?: Omit<Diagnostic, "severity" | "code" | "message">): void {
    this.push({ severity: "info", code, message, ...extra });
  }
}
