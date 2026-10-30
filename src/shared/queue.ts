import { Queue, Worker, QueueOptions } from 'bullmq';
import { env } from '../config/env.js';
import { logger } from './logger.js';

const connection = {
  url: env.REDIS_URL,
};

const defaultQueueOptions: QueueOptions = {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
};

// Emergency Notification Queue (SMS, Push, Broadcasts)
export const notificationQueue = new Queue('emergency-notifications', defaultQueueOptions);

// Triage & Dispatch Processing Queue
export const dispatchQueue = new Queue('relief-dispatches', defaultQueueOptions);

logger.info('BullMQ Emergency Queues Initialized');
