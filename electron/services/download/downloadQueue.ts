export interface DownloadTask {
    id: string;
    run: () => Promise<void>;
    priority: number;
}

export class DownloadQueue {
    private queue: Array<{
        task: DownloadTask;
        resolve: () => void;
        reject: (err: unknown) => void
    }> = [];

    private active = new Set<string>();
    private maxConcurrent = 5;

    constructor(maxConcurrent: number = 5) {
        this.maxConcurrent = maxConcurrent;
    }

    public async add(run: () => Promise<void>, priority: number = 0, id: string = Math.random().toString(36)): Promise<void> {
        return new Promise((resolve, reject) => {
            const task: DownloadTask = { id, run, priority };
            // Insert based on priority (higher priority first)
            const index = this.queue.findIndex(item => item.task.priority < priority);
            if (index === -1) {
                this.queue.push({ task, resolve, reject });
            } else {
                this.queue.splice(index, 0, { task, resolve, reject });
            }
            this.process();
        });
    }

    private process() {
        if (this.active.size >= this.maxConcurrent) return;

        if (this.queue.length === 0) return;

        const item = this.queue.shift();
        if (!item) return;

        const { task, resolve, reject } = item;

        this.active.add(task.id);

        task.run()
            .then(resolve)
            .catch(reject)
            .finally(() => {
                this.active.delete(task.id);
                this.process();
            });

        // Try to start more if possible
        this.process();
    }

    public setMaxConcurrent(count: number) {
        this.maxConcurrent = count;
        this.process();
    }
}

export const downloadQueue = new DownloadQueue(5);
