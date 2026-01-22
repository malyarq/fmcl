import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import stream from 'stream';

const pipeline = promisify(stream.pipeline);

export class DownloadManager {
    /**
     * Download a single file from URL to destination.
     * @param url Source URL
     * @param dest Destination absolute path
     */
    public static async downloadSingle(url: string, dest: string): Promise<void> {
        // Ensure directory exists
        const dir = path.dirname(dest);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(dest);

        await pipeline(response.data, writer);
    }
}
