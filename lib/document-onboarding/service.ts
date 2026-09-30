import 'server-only';
import { DocumentOnboardingMaintenanceService } from '@/lib/document-onboarding/maintenance-service';
import { DocumentOnboardingManagementService } from '@/lib/document-onboarding/management-service';
import { DocumentOnboardingPublicService } from '@/lib/document-onboarding/public-service';

export {
  DocumentOnboardingError,
  type ManagerOnboardingDetail,
  type PublicOnboardingDetail,
} from '@/lib/document-onboarding/shared';

/** Compatibility facade for the independently testable onboarding use cases. */
export class DocumentOnboardingService {
  private readonly publicFlow = new DocumentOnboardingPublicService();
  private readonly managerFlow = new DocumentOnboardingManagementService();
  private readonly maintenanceFlow = new DocumentOnboardingMaintenanceService();

  create = this.publicFlow.create.bind(this.publicFlow);
  getPublic = this.publicFlow.getPublic.bind(this.publicFlow);
  saveDraft = this.publicFlow.saveDraft.bind(this.publicFlow);
  linkDocument = this.publicFlow.linkDocument.bind(this.publicFlow);
  completeStoredDocument = this.publicFlow.completeStoredDocument.bind(this.publicFlow);
  submit = this.publicFlow.submit.bind(this.publicFlow);

  getForManager = this.managerFlow.getForManager.bind(this.managerFlow);
  recordManagerView = this.managerFlow.recordManagerView.bind(this.managerFlow);
  review = this.managerFlow.review.bind(this.managerFlow);
  renew = this.managerFlow.renew.bind(this.managerFlow);
  cancel = this.managerFlow.cancel.bind(this.managerFlow);
  runReminders = this.maintenanceFlow.runReminders.bind(this.maintenanceFlow);
}
