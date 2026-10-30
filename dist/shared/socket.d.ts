import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
export declare function initSocketIO(httpServer: HttpServer): Server;
export declare function getIO(): Server;
