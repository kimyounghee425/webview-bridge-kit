import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PendingRequestTable } from "../../src/core/pending";

describe("PendingRequestTable", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it("settles an entry by id and removes it", () => {
        const table = new PendingRequestTable();
        const resolve = vi.fn();
        table.add({
            id: "r-1",
            resolve,
            reject: vi.fn(),
            timeout: 1000,
            onTimeout: vi.fn(),
        });
        expect(table.size()).toBe(1);

        table.settle("r-1", (entry) => entry.resolve({ ok: true }));

        expect(resolve).toHaveBeenCalledWith({ ok: true });
        expect(table.size()).toBe(0);
    });

    it("clears the timer on settle so onTimeout never fires", () => {
        const table = new PendingRequestTable();
        const onTimeout = vi.fn();
        table.add({
            id: "r-1",
            resolve: vi.fn(),
            reject: vi.fn(),
            timeout: 1000,
            onTimeout,
        });

        table.settle("r-1", () => {});
        vi.advanceTimersByTime(2000);

        expect(onTimeout).not.toHaveBeenCalled();
    });

    it("fires onTimeout and removes entry when timeout elapses", () => {
        const table = new PendingRequestTable();
        const onTimeout = vi.fn();
        table.add({
            id: "r-1",
            resolve: vi.fn(),
            reject: vi.fn(),
            timeout: 1000,
            onTimeout,
        });

        vi.advanceTimersByTime(1000);

        expect(onTimeout).toHaveBeenCalledOnce();
        expect(table.size()).toBe(0);
    });

    it('does not start a timer when timeout is "none"', () => {
        const table = new PendingRequestTable();
        const onTimeout = vi.fn();
        table.add({
            id: "r-1",
            resolve: vi.fn(),
            reject: vi.fn(),
            timeout: "none",
            onTimeout,
        });

        vi.advanceTimersByTime(60_000);

        expect(onTimeout).not.toHaveBeenCalled();
        expect(table.size()).toBe(1);
    });

    it("settle on unknown id is a silent no-op (zombie response)", () => {
        const table = new PendingRequestTable();
        const fn = vi.fn();
        table.settle("does-not-exist", fn);
        expect(fn).not.toHaveBeenCalled();
    });

    it("rejectAll rejects all pending entries with the provided error", () => {
        const table = new PendingRequestTable();
        const rejectA = vi.fn();
        const rejectB = vi.fn();
        table.add({
            id: "r-1",
            resolve: vi.fn(),
            reject: rejectA,
            timeout: 1000,
            onTimeout: vi.fn(),
        });
        table.add({
            id: "r-2",
            resolve: vi.fn(),
            reject: rejectB,
            timeout: "none",
            onTimeout: vi.fn(),
        });

        const err = new Error("disposed");
        table.rejectAll(err);

        expect(rejectA).toHaveBeenCalledWith(err);
        expect(rejectB).toHaveBeenCalledWith(err);
        expect(table.size()).toBe(0);
    });
});
