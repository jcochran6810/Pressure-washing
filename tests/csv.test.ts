import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("emits headers when given records", () => {
    const csv = toCsv([{ a: 1, b: 2 }]);
    expect(csv).toBe("a,b\r\n1,2");
  });

  it("respects an explicit header order", () => {
    const csv = toCsv([{ a: 1, b: 2 }], ["b", "a"]);
    expect(csv).toBe("b,a\r\n2,1");
  });

  it("quotes fields containing commas, quotes, or newlines", () => {
    const csv = toCsv([{ a: "hello, world", b: 'said "hi"', c: "line1\nline2" }]);
    expect(csv).toContain('"hello, world"');
    expect(csv).toContain('"said ""hi"""');
    expect(csv).toContain('"line1\nline2"');
  });

  it("renders null/undefined as empty string", () => {
    const csv = toCsv([{ a: null, b: undefined, c: 0 }] as any);
    expect(csv).toBe("a,b,c\r\n,,0");
  });

  it("returns just headers for empty rows", () => {
    expect(toCsv([], ["a", "b"])).toBe("a,b");
    expect(toCsv([])).toBe("");
  });
});
