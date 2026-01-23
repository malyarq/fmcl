declare module 'hyperswarm' {
    import { EventEmitter } from 'events';

    export default class Hyperswarm extends EventEmitter {
        /**
         * Join a topic on the DHT
         * @param topic 32-byte buffer representing the topic
         * @param opts Options for joining (server/client mode)
         */
        join(topic: Buffer, opts: { server: boolean; client: boolean }): {
            flushed(): Promise<void>;
        };

        /**
         * Leave a topic
         * @param topic 32-byte buffer representing the topic
         */
        leave(topic: Buffer): void;

        /**
         * Set of active peer connections
         */
        connections: Set<unknown>;

        /**
         * Emitted when a new peer connection is established
         */
        on(event: 'connection', listener: (conn: unknown) => void): this;
        off(event: 'connection', listener: (conn: unknown) => void): this;
        once(event: 'connection', listener: (conn: unknown) => void): this;
        removeAllListeners(event?: string): this;

        /**
         * Destroy the swarm
         */
        destroy(): Promise<void>;
    }
}
