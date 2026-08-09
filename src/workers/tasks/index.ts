import { Worker } from '@/lib/queue/worker';
import processItemTask from './process-item';
import sendNotificationTask from './send-notification';
import extractCvDocumentTask from './extract-cv-document';
import sendOutreachFollowupTask from './send-outreach-followup';

export function registerAllTasks(worker: Worker): void {
  worker.registerTask('process-item', processItemTask);
  worker.registerTask('send-notification', sendNotificationTask);
  worker.registerTask('extract-cv-document', extractCvDocumentTask);
  worker.registerTask('send-outreach-followup', sendOutreachFollowupTask);
}
