// counter 기반 id 생성기. 한 인스턴스 안에서만 unique 보장 (모듈 싱글톤 가정).
export function createIdGenerator(prefix = "r"): () => string {
    let counter = 0;
    return () => `${prefix}-${++counter}`;
}
