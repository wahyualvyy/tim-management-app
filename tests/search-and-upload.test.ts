import { describe, expect, it } from "vitest";
import { entry, entryId, matchesAllWords, nameSortKey, normalizeText, prefixRange, taskTerms, userTerms } from "@/lib/search-terms";
import { checkUpload, isInlineType, sanitizeFilename, sniff } from "@/lib/storage/policy";

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (s: string) => new TextEncoder().encode(s);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0);
const PDF = text("%PDF-1.7\n");
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04, 0, 0);

describe("search terms", () => {
  it("normalizes accents, case and separators", () => {
    expect(normalizeText("  Ánditó  SÚRYA|x ")).toBe("andito surya x");
  });

  it("never lets the separator into a term, so ids parse back", () => {
    const [term] = userTerms({ name: "A|B Hacker", username: "ab", email: "ab@x.io" });
    expect(term).not.toContain("|");
    expect(entryId(entry("budi santoso", "id-1"))).toBe("id-1");
  });

  it("builds prefix bounds and rejects empty queries", () => {
    expect(prefixRange("Bud")).toEqual({ min: "[bud", max: "[bud\u00ff" });
    expect(prefixRange("  !! ")).toBeNull();
  });

  it("indexes name words, username, email local part and full email", () => {
    const terms = userTerms({ name: "Budi Santoso", username: "budi.s", email: "Budi@Example.com" });
    expect(terms).toEqual(expect.arrayContaining(["budi santoso", "budi", "santoso", "budi.s", "budi@example.com"]));
  });

  it("indexes task ref, title words and labels", () => {
    expect(taskTerms({ title: "Perbaiki login Google", labels: ["auth", "urgent bug"] }, "WEB-12")).toEqual(
      expect.arrayContaining(["web-12", "perbaiki", "login", "google", "auth", "urgent", "bug"]),
    );
  });

  it("sorts names alphabetically regardless of case", () => {
    const keys = [nameSortKey("budi", "2"), nameSortKey("Andi", "1"), nameSortKey("citra", "3")].sort();
    expect(keys.map(entryId)).toEqual(["1", "2", "3"]);
  });

  it("verifies multi-word queries against the record", () => {
    expect(matchesAllWords("WEB-12 Perbaiki login Google", "login goo")).toBe(true);
    expect(matchesAllWords("WEB-12 Perbaiki login Google", "login github")).toBe(false);
  });
});

describe("upload policy", () => {
  it("detects content from magic bytes, not the name", () => {
    expect(sniff(PNG)).toBe("png");
    expect(sniff(PDF)).toBe("pdf");
    expect(sniff(ZIP)).toBe("zip");
    expect(sniff(text("halo, ini catatan"))).toBe("text");
  });

  it("refuses markup disguised as text", () => {
    expect(sniff(text("<html><script>alert(1)</script>"))).toBe("unknown");
    expect(sniff(text("   <svg onload=alert(1)>"))).toBe("unknown");
    expect(checkUpload("attachment", "text/plain", 30, text("<script>alert(1)</script>"))).toMatchObject({ ok: false });
  });

  it("refuses HTML, SVG and executables outright", () => {
    expect(checkUpload("attachment", "text/html", 10, text("hi"))).toMatchObject({ ok: false });
    expect(checkUpload("avatar", "image/svg+xml", 10, text("<svg/>"))).toMatchObject({ ok: false });
    expect(checkUpload("attachment", "application/x-msdownload", 10, bytes(0x4d, 0x5a))).toMatchObject({ ok: false });
  });

  it("refuses a mismatch between declared type and bytes", () => {
    expect(checkUpload("avatar", "image/png", 100, PDF)).toMatchObject({ ok: false });
    expect(checkUpload("attachment", "application/pdf", 100, PNG)).toMatchObject({ ok: false });
  });

  it("enforces per-kind types and size limits", () => {
    expect(checkUpload("avatar", "image/png", 1000, PNG)).toEqual({ ok: true });
    expect(checkUpload("avatar", "application/pdf", 1000, PDF)).toMatchObject({ ok: false });
    expect(checkUpload("avatar", "image/png", 6 * 1024 * 1024, PNG)).toMatchObject({ ok: false });
    expect(checkUpload("proof", "application/pdf", 9 * 1024 * 1024, PDF)).toEqual({ ok: true });
    expect(checkUpload("attachment", "application/zip", 21 * 1024 * 1024, ZIP)).toMatchObject({ ok: false });
    expect(checkUpload("attachment", "image/png", 0, PNG)).toMatchObject({ ok: false });
  });

  it("strips paths and unsafe characters from file names", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("C:\\Users\\x\\laporan akhir (1).pdf")).toBe("laporan_akhir_1_.pdf");
    expect(sanitizeFilename(".htaccess")).toBe("htaccess");
    expect(sanitizeFilename("")).toBe("berkas");
  });

  it("only shows images and PDF inline", () => {
    expect(isInlineType("image/png")).toBe(true);
    expect(isInlineType("application/pdf")).toBe(true);
    expect(isInlineType("text/plain")).toBe(false);
    expect(isInlineType("application/zip")).toBe(false);
  });
});
