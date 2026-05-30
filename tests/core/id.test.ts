import { describe, expect, it } from "vitest";
import { createIdGenerator } from "../../src/core/id";

describe("createIdGenerator", () => {
    it("produces sequential ids with default prefix", () => {
        const next = createIdGenerator();
        expect(next()).toBe("r-1");
        expect(next()).toBe("r-2");
        expect(next()).toBe("r-3");
    });

    it("respects custom prefix", () => {
        const next = createIdGenerator("msg");
        expect(next()).toBe("msg-1");
        expect(next()).toBe("msg-2");
    });

    it("isolates counters across generators", () => {
        const a = createIdGenerator("a");
        const b = createIdGenerator("b");
        expect(a()).toBe("a-1");
        expect(b()).toBe("b-1");
        expect(a()).toBe("a-2");
    });
});
