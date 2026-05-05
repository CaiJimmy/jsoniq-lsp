import { setWrapperResolutionOptions, WrapperMemoryUsage } from "server/wrapper/client.js";
import { WRAPPER_DOWNLOAD_PROGRESS_NOTIFICATION, WRAPPER_MEMORY_USAGE_NOTIFICATION } from "./types.js";
import { Connection } from "vscode-languageserver/node.js";
import { DownloadProgress } from "server/wrapper/executable/download.js";

export { 
    WRAPPER_DOWNLOAD_PROGRESS_NOTIFICATION,
    type DownloadProgress,

    WRAPPER_MEMORY_USAGE_NOTIFICATION,
    type WrapperMemoryUsage,
}

export const initializeCustomNotifications = (connection: Connection): void => {
    setWrapperResolutionOptions({
        onProgress: (progress) => {
            connection.sendNotification(WRAPPER_DOWNLOAD_PROGRESS_NOTIFICATION, progress);
        },
        memoryUsageReporter: (usage) => {
            connection.sendNotification(WRAPPER_MEMORY_USAGE_NOTIFICATION, usage);
        }
    });
};
