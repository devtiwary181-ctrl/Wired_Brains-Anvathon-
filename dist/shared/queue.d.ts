import { Queue } from 'bullmq';
export declare const notificationQueue: Queue<any, any, string, any, any, string, import("bullmq").RedisQueueBackend, import("bullmq").ConnectionOptions>;
export declare const dispatchQueue: Queue<any, any, string, any, any, string, import("bullmq").RedisQueueBackend, import("bullmq").ConnectionOptions>;
