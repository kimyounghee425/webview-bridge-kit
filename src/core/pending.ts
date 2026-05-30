type PendingEntry = {
    resolve: (data: unknown) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout> | null;
};

export type AddOptions = {
    id: string;
    resolve: (data: unknown) => void;
    reject: (err: Error) => void;
    timeout: number | "none";
    onTimeout: () => void;
};

// in-flight request의 resolver를 보관. timeout/none/dispose 모두 책임 일원화.
export class PendingRequestTable {
    private table = new Map<string, PendingEntry>();

    add(opts: AddOptions): void {
        const timer =
            opts.timeout === "none"
                ? null
                : setTimeout(() => {
                      this.table.delete(opts.id);
                      opts.onTimeout();
                  }, opts.timeout);
        this.table.set(opts.id, {
            resolve: opts.resolve,
            reject: opts.reject,
            timer,
        });
    }

    // entry가 있으면 timer 정리 + 제거 + fn 실행. 없으면 무시 (좀비 응답).
    settle(id: string, fn: (entry: PendingEntry) => void): void {
        const entry = this.table.get(id);
        if (!entry) return;
        if (entry.timer !== null) clearTimeout(entry.timer);
        this.table.delete(id);
        fn(entry);
    }

    // dispose 시 호출. 모든 pending을 동일 에러로 reject + 정리.
    rejectAll(err: Error): void {
        for (const entry of this.table.values()) {
            if (entry.timer !== null) clearTimeout(entry.timer);
            entry.reject(err);
        }
        this.table.clear();
    }

    size(): number {
        return this.table.size;
    }
}
