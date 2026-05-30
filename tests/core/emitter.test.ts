import { describe, expect, it, vi } from "vitest";
import { SubscriberTable } from "../../src/core/emitter";

describe("SubscriberTable", () => {
    it("delivers emitted payload to all subscribers of a name", () => {
        const table = new SubscriberTable();
        const a = vi.fn();
        const b = vi.fn();

        table.on("PHOTO_TAKEN", a);
        table.on("PHOTO_TAKEN", b);
        table.emit("PHOTO_TAKEN", { uri: "x" });

        expect(a).toHaveBeenCalledWith({ uri: "x" });
        expect(b).toHaveBeenCalledWith({ uri: "x" });
    });

    it("does not call subscribers of other names", () => {
        const table = new SubscriberTable();
        const handler = vi.fn();

        table.on("PHOTO_TAKEN", handler);
        table.emit("APP_FOREGROUND", { timestamp: 1 });

        expect(handler).not.toHaveBeenCalled();
    });

    it("on returns a cleanup that unsubscribes the specific handler", () => {
        const table = new SubscriberTable();
        const a = vi.fn();
        const b = vi.fn();

        const offA = table.on("PHOTO_TAKEN", a);
        table.on("PHOTO_TAKEN", b);
        offA();
        table.emit("PHOTO_TAKEN", { uri: "y" });

        expect(a).not.toHaveBeenCalled();
        expect(b).toHaveBeenCalled();
    });

    it("emit on a name with zero subscribers is a silent no-op", () => {
        const table = new SubscriberTable();
        expect(() => table.emit("NOPE", {})).not.toThrow();
    });

    it("deduplicates the same handler instance (Set semantics)", () => {
        const table = new SubscriberTable();
        const handler = vi.fn();

        table.on("X", handler);
        table.on("X", handler);
        table.emit("X", 1);

        expect(handler).toHaveBeenCalledOnce();
    });

    it("clear removes every subscription", () => {
        const table = new SubscriberTable();
        const a = vi.fn();
        const b = vi.fn();
        table.on("X", a);
        table.on("Y", b);

        table.clear();
        table.emit("X", 1);
        table.emit("Y", 2);

        expect(a).not.toHaveBeenCalled();
        expect(b).not.toHaveBeenCalled();
        expect(table.size()).toBe(0);
    });

    it("size reports per-name and total counts", () => {
        const table = new SubscriberTable();
        table.on("X", vi.fn());
        table.on("X", vi.fn());
        table.on("Y", vi.fn());

        expect(table.size("X")).toBe(2);
        expect(table.size("Y")).toBe(1);
        expect(table.size("Z")).toBe(0);
        expect(table.size()).toBe(3);
    });
});
