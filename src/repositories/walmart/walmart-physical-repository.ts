import { DynamoDBJobRepository } from '../../repositories/generic-job-repository';
import type { WalmartJobRecord } from '../../types/walmart';

export class DynamoDBWalmartJobRepository extends DynamoDBJobRepository<WalmartJobRecord> {}
