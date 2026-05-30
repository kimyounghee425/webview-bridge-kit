// Transport는 string boundary만 책임. envelope 직렬화/역직렬화는 core가 담당.
export type Transport = {
    send(serialized: string): void;
    onMessage(handler: (serialized: string) => void): () => void;
};
