declare module 'pump' {
    import { Stream } from 'stream';

    /**
     * Pipe streams together and destroy all of them if one of them closes
     * @param streams Streams to pipe together
     * @param callback Optional callback when pipe completes or errors
     */
    function pump(...streams: (Stream | ((err?: Error) => void))[]): Stream;

    export = pump;
}
