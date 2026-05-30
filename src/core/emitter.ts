type Handler = (payload: unknown) => void;

// name별 구독자 그룹. on은 cleanup 함수 반환 — useEffect cleanup에 묶기 권장.
export class SubscriberTable {
    private subs = new Map<string, Set<Handler>>();

    on(name: string, handler: Handler): () => void {
        let set = this.subs.get(name);
        if (!set) {
            set = new Set();
            this.subs.set(name, set);
        }
        set.add(handler);
        return () => {
            set!.delete(handler);
            if (set!.size === 0) this.subs.delete(name);
        };
    }

    emit(name: string, payload: unknown): void {
        this.subs.get(name)?.forEach((h) => h(payload));
    }

    clear(): void {
        this.subs.clear();
    }

    size(name?: string): number {
        if (name === undefined) {
            let total = 0;
            for (const set of this.subs.values()) total += set.size;
            return total;
        }
        return this.subs.get(name)?.size ?? 0;
    }
}
