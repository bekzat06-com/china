import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("экранирует кавычки, разделители и формулы; числа с запятой", () => {
    const csv = toCsv(["a", "b"], [["x;y", 1.5], ['he said "hi"', null], ["=HYPERLINK(1)", -3]]);
    expect(csv.startsWith("﻿a;b\r\n")).toBe(true);
    expect(csv).toContain('"x;y";1,5');
    expect(csv).toContain('"he said ""hi""";');
    expect(csv).toContain("'=HYPERLINK(1);-3");
  });
});
