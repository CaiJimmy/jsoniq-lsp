import { setWrapperResolutionOptions } from "server/wrapper/client.js";
import { WRAPPER_DOWNLOAD_PROGRESS_NOTIFICATION } from "./types.js";
import { Connection } from "vscode-languageserver/node.js";
import { DownloadProgress } from "server/wrapper/executable/download.js";

export { 
    WRAPPER_DOWNLOAD_PROGRESS_NOTIFICATION,
    type DownloadProgress,
}

export const initializeCustomNotifications = (connection: Connection): void => {
    setWrapperResolutionOptions({
        onProgress: (progress) => {
            connection.sendNotification(WRAPPER_DOWNLOAD_PROGRESS_NOTIFICATION, progress);
        },
    });
};
